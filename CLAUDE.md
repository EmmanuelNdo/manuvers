# Manuvers

Avatar 3D compagnon, le droïde LB-93 dit Lambert, qui vit sur un écran dédié et réagit en temps réel aux automatisations de Manu (tâches planifiées Claude, Kleos, sessions Claude Code). Nom : clin d'œil au Bobiverse (« Je suis Légion ») : se multiplier.

Utilisateur : Manu (Emmanuel Ndofunsu), MacBook Pro Apple Silicon, écran externe dédié à l'avatar.

## Architecture

```
src/                  Frontend statique, servi tel quel par Tauri (aucun bundler)
  index.html          Structure : scène, bulle, dernières notifications, tiroir de réglages
  styles.css          Styles, thèmes clair/sombre, mode flottant transparent
  avatar.js           Lambert en 3D, procédural (Three.js) : window.createAvatar(canvas, stage)
  persona.js          Personnalité de Lambert : répliques, refus, bouderie, remarques (aucun DOM)
  punchlines.js       Les cent punchlines de sa vie quotidienne, par activité (tablette, lecture, philosophie...)
  brain.js            Conversation (V3) : Claude via le SDK embarqué, mémoire persistante, outils de souvenir, MCP Kleos
  voice.js            Voix de Lambert : Piper local + filtre de droïde (WebAudio), repli sur la voix système
  voice-worker.js     Worker de synthèse : phonétisation espeak-ng (WASM) puis inférence ONNX, phrase par phrase
  voices/             Modèle de voix Piper (fr_FR-tom-medium, 44,1 kHz)
  ntfy.js             Client ntfy robuste : flux JSON, jeton, rattrapage "since", reconnexion
  app.js              Réglages, file de notifications, sons, voix, écrans, veille, menu
  vendor/three.min.js Three.js r128 (UMD) embarqué : pas de CDN
  vendor/anthropic-sdk.js  SDK Anthropic regroupé pour le navigateur (window.Anthropic)
  vendor/onnx/        onnxruntime-web (WASM), vendor/piper/ : phonétiseur Piper ; licences dans vendor/LICENCES.md
  fonts/              Polices woff2 embarquées (OFL)
src-tauri/            Coque native Tauri v2, volontairement mince
  src/main.rs         Commandes : list_monitors, apply_mode, set_click_through, set_keep_awake, set_autostart
                      + icône de barre des menus (événement "tray" émis vers le frontend)
  tauri.conf.json     Fenêtre transparente sans bordure, macOSPrivateApi, CSP stricte
  Info.plist          Autorisations macOS du micro et de la reconnaissance vocale
scripts/notify-test.sh  Envoi d'une notification de test
docs/INTEGRATIONS.md    Brancher tâches planifiées, hooks Claude Code, Kleos
```

Flux : une automatisation publie un message sur un sujet ntfy → `ntfy.js` le reçoit → `app.js` le classe (info, success, alerte, news selon les tags et la priorité) → `persona.js` choisit le commentaire et le geste de Lambert (wave, jump, fret, lean), ou refuse de parler (heures de silence) → l'avatar joue le geste avec un bruit de servomoteur, un son synthétisé retentit, une bulle affiche titre, message et commentaire, la voix lit le tout si activée.

Les réglages sont stockés dans le `localStorage` du webview (clé `manuvers:settings`) : serveur, sujet, jeton, dernier identifiant reçu, mode, écran, options.

## Règles du projet

- Interface en français, vouvoiement. Jamais de tiret cadratin (U+2014) dans les textes : utiliser deux-points, virgule ou point.
- Aucune ressource externe au chargement : tout est local (Three.js, polices, voix, SDK). Connexions sortantes : ntfy, et l'API Anthropic uniquement quand on converse avec Lambert (clé saisie dans les réglages, jamais commitée).
- Garder le Rust minimal : placement des fenêtres et fonctions système. La logique reste en JavaScript.
- Le frontend doit continuer à fonctionner dans un simple navigateur (`npm run preview`), sans les fonctions d'écran.
- Ne jamais commiter de jeton ntfy ni de sujet réel.

## Lambert (LB-93) : le personnage

Droïde de protocole et de cartographie, première réplique de la Légion Manuvers. Comme les répliques du Bobiverse, il a choisi son nom : Lambert, pour la projection Lambert-93, « qui conserve les angles. Moi aussi. »

- Caractère : poli et pointilleux comme C-3PO, fier et franc comme L3-37. Inquiet de nature, pince-sans-rire, jamais servile : il refuse « maître », « robot », « mascotte ».
- Phrasé : phrases courtes, vouvoiement, probabilités absurdement précises (« 3,7 %, j'ai arrondi à la hausse »), vocabulaire de géomètre (géoïde, ellipsoïde, reprojection, à deux centimètres près).
- Signature : il clôt ce qui n'est pas négociable par « C'est cartographié. » À réserver aux refus et aux affirmations fermes, pas à chaque phrase.
- Il sait dire non : silence la nuit sauf priorité 5, bouderie après cinq clics en douze secondes, lassitude à la troisième alerte identique en deux heures, « allez vous coucher » après minuit.
- Apparence : droïde longiligne et usé, au standard de L3-37 : plaques de céramique ivoire patinée (rayures, poussière) à inserts vert carte et demi-disques ocre, cuivre, acier, mécanique graphite, câbles apparents à la taille, au cou et le long des jambes. Tête en soucoupe à visière sombre, yeux en barres lumineuses (inclinées selon l'humeur), voyant de parole dans la visière, monocle de visée sur le bord avant droit du dôme, prisme de géomètre sur une tourelle. Avant-bras gauche bleu dépareillé (pièce de rechange assumée), plaque gravée de courbes de niveau avec rose des vents, petit écran d'état. Les lumières prennent la couleur de l'humeur.
- Vie autonome, façon Tamagotchi : entre deux notifications, `app.js` lui choisit une activité (`avatar.setActivity`) : tablette 70 % du temps (il fait défiler, rit tout seul, vous montre parfois l'écran), lecture (pages qui tournent), méditation la main sous le menton, entretien (chiffon, burette), étirements, ou simple attente. Pendant les heures de silence : veille, tête baissée, yeux éteints. Une notification interrompt tout, il reprend ensuite.
- Environ toutes les cinq minutes, une réplique liée à ce qu'il fait, tirée de `punchlines.js`.
- Ajouter des répliques dans `punchlines.js` (vie quotidienne) ou dans `LINES` de `persona.js` (réactions), en respectant ces règles et l'absence de tiret cadratin.
- Voix : Piper « tom » calculé sur l'appareil, un peu plus aigu et vif (`PITCH`, `LENGTH` dans `voice.js`), passé dans un filtre de droïde réglable (« Timbre de droïde » dans les réglages). `normalize()` adapte le texte à l'oral (LB-93, heures, pourcentages, sigles). La bouche suit le niveau sonore réel.

## Conversation (V3)

- On parle à Lambert en maintenant Espace (ou le bouton Parler), on lui écrit avec la touche T. Reconnaissance vocale du navigateur quand elle existe (`SpeechRecognition`), sinon clavier.
- `brain.js` appelle `claude-opus-5` (effort `low`, réponses courtes lues par la voix) en flux, avec repli serveur `fallbacks: "default"` (bêta `server-side-fallback-2026-07-01`). Modèle réglable : Opus 5, Sonnet 5, Haiku 4.5.
- Le prompt système reprend le personnage ci-dessus, puis un contexte variable : date, vie commune (jours, conversations, notifications par type), souvenirs, dernières notifications.
- Mémoire persistante (`localStorage`, clé `manuvers:memoire`) : 40 derniers messages du fil, souvenirs notés par Lambert lui-même (outils `se_souvenir`, `oublier_souvenir`), statistiques, 20 dernières notifications. Bouton « Effacer sa mémoire » dans les réglages.
- Kleos : connecteur MCP de l'API (`mcp_servers` + `mcp_toolset`, bêta `mcp-client-2025-11-20`) si l'adresse du serveur est renseignée. Toute écriture dans Kleos passe par une confirmation orale de Manu. Les connecteurs de claude.ai (Gmail, Notion) ne sont pas accessibles par l'API : il faudra leurs propres serveurs MCP et jetons.

## Installation sur le Mac (première fois)

1. Outils :
   - `xcode-select -p` ; si absent : `xcode-select --install` (attendre la fin de l'installation graphique).
   - Rust : `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y`, puis `source "$HOME/.cargo/env"`.
   - Node 18 ou plus : `node -v` ; sinon `brew install node`.
2. Dépendances : `npm install`
3. Test en développement : `npm run dev` (première compilation : quelques minutes).
4. Application finale : `npm run build`, puis copier `src-tauri/target/release/bundle/macos/Manuvers.app` dans `/Applications` (remplacer l'ancienne version si besoin).
5. Lancer Manuvers depuis `/Applications`. Au premier lancement :
   - l'application s'inscrit au démarrage de session (réglage « Lancer Manuvers à l'ouverture de session ») ;
   - elle se place en plein écran sur le premier écran externe, sinon sur l'écran principal ;
   - ouvrir les réglages (touche R ou menu Manuvers dans la barre des menus) pour relever le sujet ntfy généré.
6. Vérifier avec `bash scripts/notify-test.sh <sujet> success "Test" "Bonjour"`.

Compilée localement, l'application n'a pas d'attribut de quarantaine. Si macOS la bloque malgré tout : `xattr -dr com.apple.quarantine /Applications/Manuvers.app`.

## Points à vérifier sur macOS (non testables depuis Linux)

Le Rust a été vérifié avec `cargo check` sous Linux et le frontend testé dans Chromium (réception ntfy réelle et rattrapage). À contrôler sur le Mac :

- [ ] Plein écran sur l'écran externe via `apply_mode("scene")` : la fenêtre doit d'abord être déplacée sur l'écran cible, puis passer en plein écran. Si macOS l'ouvre sur le mauvais écran, augmenter le délai avant `set_fullscreen(true)` ou utiliser une fenêtre sans bordure à la taille de l'écran au lieu du plein écran natif.
- [ ] Mode flottant : fond réellement transparent (nécessite `macOSPrivateApi: true`, déjà activé).
- [ ] Son : WKWebView peut exiger un clic avant de jouer de l'audio. Le bouton « Activer le son » apparaît alors ; vérifier qu'un clic suffit et que le son continue ensuite.
- [ ] Voix de Lambert (Piper) dans WKWebView : l'indication « Voix de Lambert prête » doit apparaître dans les réglages après activation. Sinon, la voix du système prend le relais (voir la console web). Vérifier aussi que la première phrase arrive en moins de deux secondes.
- [ ] Conversation dans WKWebView : la reconnaissance vocale (`webkitSpeechRecognition`) et l'autorisation micro (Info.plist) fonctionnent-elles ? Sinon, la saisie au clavier (touche T) reste disponible.
- [ ] `caffeinate` : pendant les heures réglées, `pgrep -fl caffeinate` doit montrer le processus lié à Manuvers.
- [ ] Icône de barre des menus lisible en mode clair et sombre (sinon générer une icône « template » monochrome).
- [ ] Débrancher puis rebrancher l'écran externe : Manuvers se replie sur l'écran principal puis revient (vérification toutes les 15 s).

## Commandes utiles

- `npm run dev` : développement avec rechargement.
- `npm run build` : produit `Manuvers.app` ; `npm run build:dmg` produit aussi un .dmg.
- `npm run preview` : frontend seul dans le navigateur sur http://localhost:8765 (ajouter `?topic=...`).
- `bash scripts/notify-test.sh <sujet> <info|success|alerte|news> "Titre" "Message"`.
- Version en ligne : `.github/workflows/pages.yml` publie `src/` sur GitHub Pages à chaque push sur `main` (Settings > Pages > Source : « GitHub Actions »). Ouvrir `https://emmanuelndo.github.io/manuvers/?topic=...`. Sans Tauri : pas de choix d'écran, de mode flottant ni de maintien de l'écran allumé.

## Feuille de route

- **V1** : avatar procédural, 4 réactions, bulle, sons, voix, ntfy robuste, modes scène et flottant, démarrage auto, écran maintenu allumé.
- **V1.1** : Lambert, droïde LB-93 : personnalité, commentaires, refus, bouderie, remarques spontanées, heures de silence, gestes expressifs, servomoteurs.
- **V1.2** : voix locale Piper avec filtre de droïde et bouche synchronisée sur le son ; design usé au standard L3-37.
- **V1.3** : vie autonome (tablette, lecture, méditation, entretien, étirements, veille), accessoires, cent punchlines.
- **V3, première étape (actuelle)** : conversation vocale ou écrite avec Claude, mémoire persistante et souvenirs, Kleos par MCP.
- **V2** : avatar personnel au format VRM (VRoid Studio) chargé avec `@pixiv/three-vrm` (à embarquer localement), animations Mixamo, humeurs par source (Kleos, veille, mails), clic sur la bulle pour ouvrir la fiche Kleos, résumé vocal du matin.
- **V3, suite** : mails et Notion par leurs propres serveurs MCP, mot d'éveil « Lambert », transcription locale (Whisper) si la reconnaissance du système ne suffit pas, clé d'API dans le trousseau macOS.
- Sécurisation : sujet réservé avec jeton sur ntfy.sh, ou serveur ntfy auto-hébergé (Docker sur un petit VPS).
