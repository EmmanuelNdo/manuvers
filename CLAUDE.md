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
  voice.js            Voix de Lambert : Piper local + filtre de droïde (WebAudio), repli sur la voix système
  voice-worker.js     Worker de synthèse : phonétisation espeak-ng (WASM) puis inférence ONNX, phrase par phrase
  voices/             Modèle de voix Piper (fr_FR-tom-medium, 44,1 kHz)
  sessions.js         Suivi des sessions Claude Code (application) : état déduit des transcriptions locales
  ntfy.js             Client ntfy robuste : flux JSON, jeton, rattrapage "since", reconnexion
  assistant.js        Lambert branché sur l'API Claude : commentaires écrits, conversation avec les outils
                      de Kleos (client MCP), mémoire dans Kleos, vie commune, journal de consommation,
                      reponseOuiNon() pour les confirmations
  app.js              Réglages, file de notifications, sons, voix, écrans, veille, menu
  vendor/three.min.js Three.js r128 (UMD) embarqué : pas de CDN
  vendor/onnx/        onnxruntime-web (WASM), vendor/piper/ : phonétiseur Piper ; licences dans vendor/LICENCES.md
  fonts/              Polices woff2 embarquées (OFL)
src-tauri/            Coque native Tauri v2, volontairement mince
  src/main.rs         Commandes : list_monitors, apply_mode, set_click_through, set_keep_awake, set_autostart, claude_sessions
                      + icône de barre des menus (événement "tray" émis vers le frontend)
  src/ia.rs           Secrets au trousseau macOS (clé de l'API Claude, jetons Kleos) et les appels qui en ont
                      besoin : claude_messages, kleos_mcp, kleos_connecter (OAuth 2.1 + PKCE, retour sur
                      127.0.0.1:8766). Aucune clé ne passe par la page.
  Info.plist          Textes des autorisations micro et reconnaissance vocale (fusionné par Tauri)
  Entitlements.plist  Droit au micro : l'app est signée avec le « hardened runtime », qui coupe le micro sans ce droit
  tauri.conf.json     Fenêtre transparente sans bordure, macOSPrivateApi, CSP stricte
.github/workflows/release-mac.yml  Compile l'app Mac universelle et la publie sur Releases (étiquette vX.Y.Z)
scripts/notify-test.sh  Envoi d'une notification de test
docs/INTEGRATIONS.md    Brancher tâches planifiées, hooks Claude Code, Kleos
```

Flux : une automatisation publie un message sur un sujet ntfy → `ntfy.js` le reçoit → `app.js` le classe (info, success, alerte, news selon les tags et la priorité) → `persona.js` choisit le commentaire et le geste de Lambert (wave, jump, fret, lean), ou refuse de parler (heures de silence) → l'avatar joue le geste avec un bruit de servomoteur, un son synthétisé retentit, une bulle affiche titre, message et commentaire, la voix lit le tout si activée.

Les réglages sont stockés dans le `localStorage` du webview (clé `manuvers:settings`) : serveur, sujet, jeton, dernier identifiant reçu, mode, écran, options.

## Règles du projet

- Interface en français, vouvoiement. Jamais de tiret cadratin (U+2014) dans les textes : utiliser deux-points, virgule ou point.
- Aucune ressource externe au chargement : tout est local (Three.js, polices). Connexions sortantes : ntfy depuis la page ; l'API Claude et Kleos depuis la coque native seulement (ia.rs), parce qu'elles portent des secrets.
- Toute commande Rust qui touche au trousseau ou au disque est `async` : une commande synchrone tourne sur le fil principal, et une demande d'accès au trousseau cachée derrière le plein écran figerait toute l'application.
- Garder le Rust minimal : placement des fenêtres, fonctions système, et garde des secrets (ia.rs : trousseau et appels signés). La logique, y compris celle de la conversation, reste en JavaScript.
- Aucune clé ni aucun jeton dans le dépôt, dans `localStorage` ou dans la page : trousseau uniquement. Le dépôt et sa version GitHub Pages sont publics.
- Lambert lit et écrit dans Kleos sans demander : c'est le choix de Manu. Deux exceptions passent par le panneau de confirmation (`aConfirmer` d'assistant.js) : ce qui efface (annotation MCP `destructiveHint`, dont `lambert_effacer`) et ce qui part chez un tiers (`envoyer_*`, un devis envoyé au client).
- La mémoire de Lambert vit dans Kleos (tables `lambert_souvenirs` et `lambert_messages`), jamais sur le Mac : le carnet est relu au début de chaque conversation et placé dans la consigne, chaque échange est consigné au journal sans jamais retarder la réponse. Réglages, section « Mémoire de Lambert » : relire le carnet, oublier un souvenir, effacer le journal ou tout.
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

- Application seulement, avec une clé au trousseau : on parle à Lambert en maintenant Espace (ou le bouton du micro), on lui écrit avec la touche T. Reconnaissance vocale du système quand elle existe (`SpeechRecognition`), sinon clavier. Pose de réflexion pendant qu'il pense.
- `assistant.js` demande l'appel, `ia.rs` y ajoute la clé : `claude-opus-5-5` par défaut (effort `low`, réponses courtes lues par la voix), repli serveur `fallbacks: "default"` (bêta `server-side-fallback-2026-07-01`).
- Prompt système : le personnage et le carnet (relu une fois par conversation, avec point de cache), puis un contexte variable hors cache : vie commune (jours, conversations, notifications) et 12 dernières notifications, gardées sur l'appareil (`manuvers:memoire`, aucun secret).
- Kleos : client MCP en JavaScript, requêtes signées par `ia.rs` (jetons OAuth au trousseau). Les outils viennent de `tools/list`.
- Mémoire dans Kleos : carnet (`lambert_souvenirs`), journal de toutes les conversations (`lambert_messages`), et Journal du CEO alimenté par `journal_ceo_noter` quand Manu parle de sa journée. Les souvenirs locaux de la 0.4 sont versés une fois dans le carnet. La clé saisie dans les réglages de la 0.4 part au trousseau au premier lancement, puis disparaît des réglages.

## Sessions Claude Code (application)

- Comme Agent Standup, Lambert lit les transcriptions que Claude Code écrit déjà (`~/.claude/projects/*/*.jsonl`, ou `$CLAUDE_CONFIG_DIR/projects`) : lecture seule, rien n'est envoyé, aucun jeton consommé. La commande Rust `claude_sessions` renvoie la fin des 20 transcriptions les plus récentes ; `sessions.js` en déduit l'état toutes les 4 secondes.
- Il prévient (bulle, voix, geste) quand une session vous attend (question `AskUserQuestion`, plan `ExitPlanMode`, ou modification en attente d'accord depuis 15 s) et quand une session rend la main après au moins 20 s de travail. Une pastille en haut compte les sessions au travail et celles qui vous attendent.
- Réglage « Sessions Claude Code » ; indisponible dans la version navigateur (pas d'accès aux fichiers).

## Installation sur le Mac (simple)

1. Ouvrir https://github.com/EmmanuelNdo/manuvers/releases/latest et télécharger `Manuvers-<version>-mac.zip`.
2. Ouvrir le .zip, glisser Manuvers dans Applications.
3. Premier lancement : l'application n'est pas signée par Apple. Fermer l'avertissement, puis Réglages Système > Confidentialité et sécurité > Ouvrir quand même. Ou : `xattr -dr com.apple.quarantine /Applications/Manuvers.app`.
4. Publier une nouvelle version : mettre à jour la version (package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml), puis pousser une étiquette `vX.Y.Z` sur `main`. Le workflow « App Mac » compile et joint le .zip à la version.

## Installation sur le Mac depuis les sources (développement)

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
- [ ] Trousseau : après « Enregistrer dans le trousseau », l'entrée `fr.datando.manuvers` / `anthropic` apparaît dans Trousseaux d'accès ; macOS peut demander l'autorisation au premier accès.
- [ ] Micro : `webkitSpeechRecognition` dans WKWebView. Les demandes d'autorisation micro et reconnaissance vocale doivent apparaître au premier appui sur « Parler » (textes dans Info.plist). Si le bouton « Parler » n'apparaît pas, l'API n'est pas exposée dans cette version de WebKit : il faudra passer par SFSpeechRecognizer côté natif.
- [ ] Connexion Kleos : le navigateur s'ouvre, l'accord Kleos renvoie vers `http://127.0.0.1:8766/oauth/kleos`, et les réglages affichent « Kleos connecté ». Prérequis côté Supabase : inscription dynamique des clients OAuth autorisée (c'est elle que Claude utilise déjà).

## Lambert et l'API Claude (V3, en cours)

- Réglages, section « Intelligence de Lambert » : la clé de l'API Claude part au trousseau (service `fr.datando.manuvers`), le modèle se choisit (Opus 5.5 par défaut, effort bas pour la vitesse), « Connecter Kleos » ouvre le navigateur sur l'accord OAuth de Kleos.
- Commentaires : pour une réaction ordinaire (`persona.react` renvoie `ordinaire`), `assistant.commenter` demande un commentaire à Claude, l'attend cinq secondes au plus, le vérifie (pas de tiret cadratin, pas de tutoiement, 260 caractères au plus) et retombe sur la réplique fixe sinon. Les refus de nuit, l'urgence et la lassitude ne sont jamais réécrits.
- Conversation : bouton « Parler » en haut, barre d'espace maintenue, ou touche T. Lambert lit et écrit dans Kleos seul ; effacer ou envoyer à un tiers attend « Oui, allez-y » ou un « oui » au micro. Historique effacé après dix minutes de silence ou quarante messages (jamais tronqué en cours : cela invaliderait le raisonnement déjà fourni).
- Mémoire : « retiens que… » ajoute un souvenir sans confirmation ; une nouvelle conversation le connaît. Réglages, « Mémoire de Lambert » : le carnet s'affiche, « Oublier » le retire de Kleos, « Effacer le journal » et « Tout effacer » demandent confirmation.
- Coût : journal par mois dans `localStorage` (`manuvers:consommation`, des compteurs, aucun contenu), affiché dans les réglages.

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
- **V3, première étape** : conversation vocale ou écrite avec Claude, mémoire persistante et souvenirs, Kleos par MCP.
- **0.4** : application Mac téléchargeable depuis Releases (compilée par GitHub Actions), suivi local des sessions Claude Code.
- **0.5 (actuelle)** : clé de l'API et jetons Kleos au trousseau, connexion OAuth à Kleos, mémoire de Lambert dans Kleos (carnet, journal, Journal du CEO), commentaires écrits par Claude.
- **V2** : avatar personnel au format VRM (VRoid Studio) chargé avec `@pixiv/three-vrm` (à embarquer localement), animations Mixamo, humeurs par source (Kleos, veille, mails), clic sur la bulle pour ouvrir la fiche Kleos, résumé vocal du matin.
- **V3, suite** : Notion par son propre serveur MCP, mot d'éveil « Lambert », transcription locale (Whisper) si la reconnaissance du système ne suffit pas, réponse en flux.
- Sécurisation : sujet réservé avec jeton sur ntfy.sh, ou serveur ntfy auto-hébergé (Docker sur un petit VPS).
