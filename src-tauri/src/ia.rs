// Manuvers : les secrets et les deux appels réseau qui en ont besoin.
//
// La clé de l'API Claude et le jeton Kleos vivent dans le trousseau macOS, et ne
// passent jamais par la fenêtre web : le JavaScript demande un appel, le Rust y ajoute
// le secret et rend la réponse. Un script injecté dans la page (ou la version GitHub
// Pages, publique) ne peut donc rien lire.
//
// Trois services seulement, à adresse fixe ou réglée : l'API Claude, le serveur MCP
// de Kleos, et le serveur OAuth qu'il annonce. Rien d'autre ne sort d'ici.

use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const SERVICE: &str = "fr.datando.manuvers";
const CLE_ANTHROPIC: &str = "anthropic";
const CLE_KLEOS: &str = "kleos";
const API_CLAUDE: &str = "https://api.anthropic.com/v1/messages";
/// Port de retour du navigateur après la connexion à Kleos (8765 sert déjà à l'aperçu).
const PORT_RETOUR: u16 = 8766;
const CHEMIN_RETOUR: &str = "/oauth/kleos";

fn maintenant() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn entree(nom: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, nom).map_err(|e| e.to_string())
}

fn lire_secret(nom: &str) -> Option<String> {
    entree(nom).ok()?.get_password().ok().filter(|s| !s.is_empty())
}

fn ecrire_secret(nom: &str, valeur: &str) -> Result<(), String> {
    entree(nom)?.set_password(valeur).map_err(|e| e.to_string())
}

fn effacer_secret(nom: &str) {
    if let Ok(e) = entree(nom) {
        let _ = e.delete_credential();
    }
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .user_agent("Manuvers (Lambert)")
        .build()
        .map_err(|e| e.to_string())
}

// ── Clé de l'API Claude ────────────────────────────────────────────────────
// Toutes les commandes qui touchent au trousseau sont asynchrones : une commande
// synchrone tourne sur le fil principal, et si macOS demande l'accès au trousseau
// dans une fenêtre cachée derrière le plein écran, toute l'application se fige.

/// Enregistre la clé dans le trousseau. Le champ de saisie est vidé côté page juste après.
#[tauri::command]
pub async fn cle_claude_enregistrer(cle: String) -> Result<(), String> {
    let cle = cle.trim();
    if !cle.starts_with("sk-ant-") {
        return Err("Ce n'est pas une clé de l'API Claude : elle commence par « sk-ant- ».".into());
    }
    ecrire_secret(CLE_ANTHROPIC, cle)
}

#[tauri::command]
pub async fn cle_claude_presente() -> bool {
    lire_secret(CLE_ANTHROPIC).is_some()
}

#[tauri::command]
pub async fn cle_claude_effacer() {
    effacer_secret(CLE_ANTHROPIC);
}

#[derive(Serialize)]
pub struct Reponse {
    status: u16,
    corps: Value,
}

/// Un appel à l'API Messages. Le corps est préparé par la page ; la clé est ajoutée ici.
#[tauri::command]
pub async fn claude_messages(corps: Value, betas: Option<Vec<String>>) -> Result<Reponse, String> {
    let cle = lire_secret(CLE_ANTHROPIC).ok_or("Aucune clé de l'API Claude dans le trousseau.")?;
    let mut req = client()?
        .post(API_CLAUDE)
        .header("x-api-key", cle)
        .header("anthropic-version", "2023-06-01")
        .json(&corps);
    if let Some(b) = betas.filter(|b| !b.is_empty()) {
        req = req.header("anthropic-beta", b.join(","));
    }
    let res = req.send().await.map_err(|e| format!("API Claude injoignable : {e}"))?;
    let status = res.status().as_u16();
    let corps = res.json::<Value>().await.unwrap_or(Value::Null);
    Ok(Reponse { status, corps })
}

// ── Kleos : OAuth 2.1 avec PKCE, retour sur 127.0.0.1 ──────────────────────

#[derive(Serialize, Deserialize, Clone)]
struct JetonKleos {
    mcp: String,
    client_id: String,
    token_endpoint: String,
    access_token: String,
    refresh_token: Option<String>,
    expire_a: u64,
}

fn lire_jeton() -> Option<JetonKleos> {
    serde_json::from_str(&lire_secret(CLE_KLEOS)?).ok()
}

fn ecrire_jeton(j: &JetonKleos) -> Result<(), String> {
    ecrire_secret(CLE_KLEOS, &serde_json::to_string(j).map_err(|e| e.to_string())?)
}

fn aleatoire(n: usize) -> String {
    let mut b = vec![0u8; n];
    rand::thread_rng().fill_bytes(&mut b);
    URL_SAFE_NO_PAD.encode(b)
}

fn origine(url: &str) -> Result<String, String> {
    let u = url::Url::parse(url).map_err(|e| format!("Adresse Kleos invalide : {e}"))?;
    if u.scheme() != "https" && u.host_str() != Some("localhost") {
        return Err("L'adresse de Kleos doit être en https.".into());
    }
    Ok(u.origin().ascii_serialization())
}

async fn json_get(c: &reqwest::Client, url: &str) -> Option<Value> {
    let r = c.get(url).send().await.ok()?;
    if !r.status().is_success() {
        return None;
    }
    r.json::<Value>().await.ok()
}

/// Les métadonnées du serveur OAuth, aux adresses que prévoit la RFC 8414 pour un
/// émetteur avec chemin (celui de Supabase finit par /auth/v1), puis aux variantes.
async fn metadonnees_oauth(c: &reqwest::Client, emetteur: &str) -> Result<Value, String> {
    let u = url::Url::parse(emetteur).map_err(|e| e.to_string())?;
    let base = u.origin().ascii_serialization();
    let chemin = u.path().trim_end_matches('/');
    let essais = [
        format!("{base}/.well-known/oauth-authorization-server{chemin}"),
        format!("{base}{chemin}/.well-known/oauth-authorization-server"),
        format!("{base}/.well-known/openid-configuration{chemin}"),
        format!("{base}{chemin}/.well-known/openid-configuration"),
    ];
    for e in essais.iter() {
        if let Some(v) = json_get(c, e).await {
            if v.get("authorization_endpoint").is_some() && v.get("token_endpoint").is_some() {
                return Ok(v);
            }
        }
    }
    Err("Serveur OAuth de Kleos introuvable.".into())
}

fn texte(v: &Value, cle: &str) -> Result<String, String> {
    v.get(cle).and_then(|x| x.as_str()).map(String::from).ok_or(format!("« {cle} » manquant dans la réponse OAuth"))
}

/// Attend le retour du navigateur sur 127.0.0.1 et rend le code d'autorisation.
fn attendre_code(etat: &str) -> Result<String, String> {
    let ecoute = TcpListener::bind(("127.0.0.1", PORT_RETOUR))
        .map_err(|e| format!("Port {PORT_RETOUR} occupé : {e}"))?;
    // Non bloquant : sans ça, `accept` attendrait indéfiniment et le délai de cinq
    // minutes ne serait jamais vérifié.
    ecoute.set_nonblocking(true).map_err(|e| e.to_string())?;
    let limite = SystemTime::now() + Duration::from_secs(300);
    loop {
        if SystemTime::now() > limite {
            return Err("Connexion à Kleos abandonnée : aucun retour du navigateur en cinq minutes.".into());
        }
        let mut flux = match ecoute.accept() {
            Ok((f, _)) => f,
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(200));
                continue;
            }
            Err(e) => return Err(e.to_string()),
        };
        let _ = flux.set_nonblocking(false);
        let _ = flux.set_read_timeout(Some(Duration::from_secs(5)));
        let mut tampon = [0u8; 4096];
        let n = flux.read(&mut tampon).unwrap_or(0);
        let requete = String::from_utf8_lossy(&tampon[..n]);
        let ligne = requete.lines().next().unwrap_or("");
        let cible = ligne.split_whitespace().nth(1).unwrap_or("");
        if !cible.starts_with(CHEMIN_RETOUR) {
            let _ = flux.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
            continue;
        }
        let u = url::Url::parse(&format!("http://127.0.0.1{cible}")).map_err(|e| e.to_string())?;
        let param = |k: &str| u.query_pairs().find(|(c, _)| c == k).map(|(_, v)| v.to_string());
        let (message, resultat) = match (param("code"), param("state"), param("error")) {
            (_, _, Some(err)) => ("Kleos a refusé la connexion. Vous pouvez fermer cet onglet.", Err(format!("Kleos a refusé : {err}"))),
            (Some(code), Some(s), _) if s == etat => ("Lambert est connecté à Kleos. Vous pouvez fermer cet onglet.", Ok(code)),
            _ => ("Réponse inattendue. Vous pouvez fermer cet onglet et réessayer.", Err("Retour OAuth invalide (état différent).".into())),
        };
        let page = format!(
            "<!doctype html><meta charset=utf-8><title>Manuvers</title><body style=\"font:16px system-ui;padding:3em\"><p>{message}</p>"
        );
        let _ = flux.write_all(
            format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{page}", page.len()).as_bytes(),
        );
        return resultat;
    }
}

/// Connecte Lambert à Kleos : découverte, inscription du client, accord dans le
/// navigateur, échange du code. Les jetons vont au trousseau.
#[tauri::command]
pub async fn kleos_connecter(mcp: String) -> Result<(), String> {
    let c = client()?;
    let base = origine(&mcp)?;

    // 1. Qui délivre les jetons pour ce serveur MCP (RFC 9728).
    let ressource = json_get(&c, &format!("{base}/.well-known/oauth-protected-resource"))
        .await
        .ok_or("Kleos ne publie pas ses métadonnées OAuth.")?;
    let emetteur = ressource
        .get("authorization_servers")
        .and_then(|a| a.get(0))
        .and_then(|x| x.as_str())
        .ok_or("Aucun serveur d'autorisation annoncé par Kleos.")?
        .to_string();
    let meta = metadonnees_oauth(&c, &emetteur).await?;
    let auth = texte(&meta, "authorization_endpoint")?;
    let token = texte(&meta, "token_endpoint")?;
    let redirect = format!("http://127.0.0.1:{PORT_RETOUR}{CHEMIN_RETOUR}");

    // 2. Un client déjà inscrit est réutilisé ; sinon inscription dynamique (RFC 7591).
    let client_id = match lire_jeton().filter(|j| j.mcp == mcp && j.token_endpoint == token) {
        Some(j) => j.client_id,
        None => {
            let inscription = texte(&meta, "registration_endpoint")
                .map_err(|_| "Kleos n'accepte pas l'inscription automatique de clients.".to_string())?;
            let r = c
                .post(&inscription)
                .json(&json!({
                    "client_name": "Manuvers (Lambert)",
                    "redirect_uris": [redirect],
                    "grant_types": ["authorization_code", "refresh_token"],
                    "response_types": ["code"],
                    "token_endpoint_auth_method": "none"
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let v: Value = r.json().await.map_err(|e| e.to_string())?;
            texte(&v, "client_id")?
        }
    };

    // 3. Accord dans le navigateur, avec PKCE.
    let verificateur = aleatoire(48);
    let defi = URL_SAFE_NO_PAD.encode(Sha256::digest(verificateur.as_bytes()));
    let etat = aleatoire(24);
    let mut url = url::Url::parse(&auth).map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect)
        .append_pair("code_challenge", &defi)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", &etat)
        .append_pair("resource", &mcp);

    let etat_attendu = etat.clone();
    let attente = tauri::async_runtime::spawn_blocking(move || attendre_code(&etat_attendu));
    ouvrir_navigateur(url.as_str())?;
    let code = attente.await.map_err(|e| e.to_string())??;

    // 4. Échange du code contre les jetons.
    let v: Value = c
        .post(&token)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code.as_str()),
            ("redirect_uri", redirect.as_str()),
            ("client_id", client_id.as_str()),
            ("code_verifier", verificateur.as_str()),
            ("resource", mcp.as_str()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let jeton = JetonKleos {
        mcp,
        client_id,
        token_endpoint: token,
        access_token: texte(&v, "access_token")?,
        refresh_token: v.get("refresh_token").and_then(|x| x.as_str()).map(String::from),
        expire_a: maintenant() + v.get("expires_in").and_then(|x| x.as_u64()).unwrap_or(3600),
    };
    ecrire_jeton(&jeton)
}

fn ouvrir_navigateur(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let commande = "open";
    #[cfg(not(target_os = "macos"))]
    let commande = "xdg-open";
    std::process::Command::new(commande).arg(url).spawn().map(|_| ()).map_err(|e| e.to_string())
}

async fn rafraichir(c: &reqwest::Client, j: &JetonKleos) -> Result<JetonKleos, String> {
    let rt = j.refresh_token.clone().ok_or("Session Kleos expirée : reconnectez Lambert dans les réglages.")?;
    let r = c
        .post(&j.token_endpoint)
        .form(&[("grant_type", "refresh_token"), ("refresh_token", rt.as_str()), ("client_id", j.client_id.as_str())])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !r.status().is_success() {
        return Err("Session Kleos expirée : reconnectez Lambert dans les réglages.".into());
    }
    let v: Value = r.json().await.map_err(|e| e.to_string())?;
    let neuf = JetonKleos {
        access_token: texte(&v, "access_token")?,
        // Le jeton de rafraîchissement tourne à chaque usage chez Supabase.
        refresh_token: v.get("refresh_token").and_then(|x| x.as_str()).map(String::from).or(j.refresh_token.clone()),
        expire_a: maintenant() + v.get("expires_in").and_then(|x| x.as_u64()).unwrap_or(3600),
        ..j.clone()
    };
    ecrire_jeton(&neuf)?;
    Ok(neuf)
}

#[derive(Serialize)]
pub struct EtatKleos {
    connecte: bool,
    mcp: Option<String>,
}

#[tauri::command]
pub async fn kleos_etat() -> EtatKleos {
    let j = lire_jeton();
    EtatKleos { connecte: j.is_some(), mcp: j.map(|j| j.mcp) }
}

#[tauri::command]
pub async fn kleos_deconnecter() {
    effacer_secret(CLE_KLEOS);
}

#[derive(Serialize)]
pub struct ReponseMcp {
    status: u16,
    session: Option<String>,
    corps: String,
}

/// Une requête JSON-RPC vers le serveur MCP de Kleos, avec le jeton du trousseau.
/// Le jeton est rafraîchi s'il expire dans la minute, ou après un 401.
#[tauri::command]
pub async fn kleos_mcp(requete: Value, session: Option<String>) -> Result<ReponseMcp, String> {
    let c = client()?;
    let mut j = lire_jeton().ok_or("Lambert n'est pas connecté à Kleos.")?;
    if j.expire_a <= maintenant() + 60 {
        j = rafraichir(&c, &j).await?;
    }
    for essai in 0..2 {
        let mut req = c
            .post(&j.mcp)
            .bearer_auth(&j.access_token)
            .header("Accept", "application/json, text/event-stream")
            .header("MCP-Protocol-Version", "2025-06-18")
            .json(&requete);
        if let Some(s) = &session {
            req = req.header("Mcp-Session-Id", s);
        }
        let res = req.send().await.map_err(|e| format!("Kleos injoignable : {e}"))?;
        if res.status().as_u16() == 401 && essai == 0 {
            j = rafraichir(&c, &j).await?;
            continue;
        }
        let status = res.status().as_u16();
        let session = res.headers().get("mcp-session-id").and_then(|v| v.to_str().ok()).map(String::from);
        let corps = res.text().await.unwrap_or_default();
        return Ok(ReponseMcp { status, session, corps });
    }
    Err("Kleos refuse le jeton de Lambert : reconnectez-le dans les réglages.".into())
}
