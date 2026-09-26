# Brancher vos automatisations sur Manuvers

Toutes les sources parlent à Manuvers de la même façon : un message publié sur votre sujet ntfy.

| Champ ntfy | Rôle dans Manuvers |
|---|---|
| `Title` | Titre de la bulle |
| corps du message | Texte de la bulle (une ou deux phrases) |
| `Tags` | Réaction : `info` (signe de la main), `success` ou `prospect` (saut de joie), `alerte` ou `relance` (inquiétude), `news` ou `veille` (se penche vers vous) |
| `Priority: 4` ou `5` | Force la réaction « À traiter » |
| `Click` | Lien affiché dans la bulle (fiche Kleos, document, mail) |
| `Authorization: Bearer <jeton>` | Si votre sujet est protégé |

Remplacez `VOTRE_SUJET` par le sujet affiché dans les réglages de Manuvers.

## 1. Tâches planifiées Claude

Ajoutez cette consigne à la fin du prompt de chaque tâche :

> Quand la tâche est terminée, préviens mon avatar Manuvers : envoie une requête POST à https://ntfy.sh/ avec ce corps JSON : {"topic": "VOTRE_SUJET", "title": "<nom court de la tâche>", "message": "<résumé d'une phrase en français>", "tags": ["<info, success, alerte ou news selon le résultat>"]}. Si le résultat demande une action de ma part, ajoute "priority": 4. N'inclus aucune donnée sensible sur un client.

Le format JSON évite tout souci d'accents dans les titres.

## 2. Sessions Claude Code sur le Mac (hooks)

Dans `~/.claude/settings.json`, ajoutez :

```json
{
  "hooks": {
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -H 'Title: Claude Code vous attend' -H 'Tags: alerte' -d 'Une session a besoin de votre validation.' https://ntfy.sh/VOTRE_SUJET > /dev/null"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -H 'Title: Claude Code a terminé' -H 'Tags: info' -d \"Travail terminé dans $(basename \"$PWD\").\" https://ntfy.sh/VOTRE_SUJET > /dev/null"
          }
        ]
      }
    ]
  }
}
```

Le hook `Stop` se déclenche à la fin de chaque réponse : si c'est trop bavard, gardez seulement `Notification`.

## 3. Kleos

Kleos a été construit avec Claude Code : demandez-lui d'appeler cette fonction aux bons moments (nouveau prospect, proposition acceptée, relance échue).

Les deux exemples publient en JSON, ce qui gère correctement les accents.

Node :

```js
async function notifierManuvers({ titre, message, type = "info", lien, priorite }) {
  const corps = { topic: process.env.MANUVERS_TOPIC, title: titre, message, tags: [type] };
  if (lien) corps.click = lien;
  if (priorite) corps.priority = priorite;
  const headers = { "Content-Type": "application/json" };
  if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
  try {
    await fetch(process.env.NTFY_SERVER || "https://ntfy.sh", { method: "POST", headers, body: JSON.stringify(corps) });
  } catch (e) {
    console.warn("Manuvers injoignable :", e.message); // ne jamais bloquer Kleos pour l'avatar
  }
}
```

Python :

```python
import os, requests

def notifier_manuvers(titre, message, type_="info", lien=None, priorite=None):
    corps = {"topic": os.environ["MANUVERS_TOPIC"], "title": titre, "message": message, "tags": [type_]}
    if lien:
        corps["click"] = lien
    if priorite:
        corps["priority"] = priorite
    headers = {}
    if os.getenv("NTFY_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['NTFY_TOKEN']}"
    try:
        requests.post(os.getenv("NTFY_SERVER", "https://ntfy.sh"), json=corps, headers=headers, timeout=5)
    except requests.RequestException as e:
        print("Manuvers injoignable :", e)
```

## 4. Depuis le terminal

```bash
bash scripts/notify-test.sh VOTRE_SUJET success "Devis accepté" "La commune a validé la formation."
```

## Confidentialité

Sur ntfy.sh public, toute personne qui connaît le sujet peut lire les messages. Gardez des messages génériques (« Nouveau prospect dans Kleos ») plutôt que des noms de clients, ou passez à un sujet réservé avec jeton, voire à un serveur ntfy auto-hébergé.
