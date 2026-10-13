/* Manuvers : logique de l'application (réglages, notifications, bulle, sons, écran).
   Fonctionne dans l'application Tauri et aussi dans un simple navigateur (sans les fonctions d'écran). */
(function(){
"use strict";

const $ = id => document.getElementById(id);
const TAURI = window.__TAURI__ || null;
const invoke = TAURI && TAURI.core ? TAURI.core.invoke : null;
const listen = TAURI && TAURI.event ? TAURI.event.listen : null;
if(invoke) document.documentElement.classList.add("tauri");

/* ---------- Réglages ---------- */
function randomTopic(){ const a = "abcdefghjkmnpqrstuvwxyz23456789"; let s = "manuvers-"; for(let i = 0; i < 12; i++) s += a[Math.floor(Math.random()*a.length)]; return s; }
const DEFAULTS = {
  server:"https://ntfy.sh", topic:"", token:"", lastId:"",
  mode:"scene", monitor:"", clickThrough:false,
  sound:true, voice:false, bored:true, autostart:true,
  quips:true, chatty:true, quiet:true, quietFrom:"21:30", quietTo:"07:30", met:false, timbre:0.6,
  claude:true,
  keepAwake:true, awakeFrom:"08:30", awakeTo:"19:00", weekdays:true,
  iaModele:"claude-opus-5-5", iaQuips:true, kleosUrl:"https://admin.datando.fr/api/mcp"
};
const S = (() => {
  let saved = {};
  try{ saved = JSON.parse(localStorage.getItem("manuvers:settings") || "{}"); }catch(e){}
  const s = Object.assign({}, DEFAULTS, saved);
  try{ const q = new URLSearchParams(location.search).get("topic"); if(q) s.topic = q; }catch(e){}
  if(!s.topic) s.topic = randomTopic();
  return s;
})();
function save(){ try{ localStorage.setItem("manuvers:settings", JSON.stringify(S)); }catch(e){} }
save();

const TYPES = {
  persona: { label:"Lambert",        color:null,     action:null,    rank:0 },
  info:    { label:"Automatisation", color:0x3fb0ff, action:"wave",  rank:1 },
  news:    { label:"Veille",         color:0xa98bff, action:"lean",  rank:2 },
  success: { label:"Bonne nouvelle", color:0x4fe0a0, action:"jump",  rank:3 },
  alerte:  { label:"À traiter",      color:0xffb23e, action:"fret",  rank:4 }
};

/* ---------- Avatar et personnalité ---------- */
const stage = $("stage");
const avatar = window.createAvatar($("scene"), stage);
const persona = window.createPersona();
$("brandName").textContent = persona.NAME;
$("brandId").textContent = persona.ID;
function gesture(name){ if(!name) return; avatar.play(name); servo(name); }

/* ---------- Horloge ---------- */
function tickClock(){
  const d = new Date();
  $("clock").textContent = d.toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long" }) + " · " + d.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
}
tickClock(); setInterval(tickClock, 15000);

/* ---------- Statut ---------- */
function setStatus(state, text){
  $("status").dataset.state = state;
  const short = { ok:"À l'écoute", connecting:"Connexion…", retry:"Reconnexion…", error:"Problème", off:"Non connecté" }[state] || state;
  $("statusText").textContent = short;
  $("status").title = text || short;
  $("connHint").textContent = text || "";
}

/* ---------- Bulle et file d'attente ---------- */
const bubble = $("bubble");
let current = null, hideTimer = null, typeTimer = null;
const queue = [];
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function fmtTime(d){ return d.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" }); }

function placeBubble(){
  if(bubble.hidden) return;
  const W = stage.clientWidth, H = stage.clientHeight, bw = bubble.offsetWidth, bh = bubble.offsetHeight;
  const y = avatar.rigY();
  const side = avatar.toScreen(0.62, 2.35 + y*0.5);
  const enter = bubble.classList.contains("enter") ? " enter" : "";
  if(avatar.isWide() && side.x + bw + 16 <= W){
    bubble.className = "bubble side" + enter;
    const top = Math.min(Math.max(side.y - 44, 80), H - bh - 16);
    bubble.style.transform = `translate(${side.x}px, ${top}px)`;
    bubble.style.setProperty("--tail", Math.max(16, Math.min(bh - 28, side.y - top - 8)) + "px");
  } else {
    const headTop = avatar.toScreen(0, 2.95 + y);
    bubble.className = "bubble top" + enter;
    const left = Math.min(Math.max(headTop.x - bw/2, 12), W - bw - 12);
    const top = Math.max(headTop.y - bh - 18, 12);
    bubble.style.transform = `translate(${left}px, ${top}px)`;
    bubble.style.setProperty("--tail", Math.max(16, Math.min(bw - 32, headTop.x - left - 8)) + "px");
  }
}
avatar.onFrame(placeBubble);

function enqueue(ev){
  queue.push(ev); updateQueue();
  if(current && current.silent){ closeBubble(); return; }
  if(!current) showNext();
}
function updateQueue(){
  const q = $("queue"); q.hidden = queue.length === 0;
  q.textContent = queue.length + (queue.length > 1 ? " notifications en attente" : " notification en attente");
}
async function showNext(){
  const ev = queue.shift(); updateQueue();
  if(!ev){ current = null; avatar.setMood(null); return; }
  current = ev;
  const T = TYPES[ev.type];
  lastActivity = Date.now();
  avatar.setMood(T.color);
  // Lambert décide du geste, du commentaire, et s'il accepte de parler
  let r = { quip:ev.quip || "", outro:"", action:ev.action !== undefined ? ev.action : T.action, voice:true, sound:true };
  if(!ev.silent && ev.type !== "persona"){
    r = persona.react(ev, { quiet:S.quiet && inQuietHours(), date:new Date() });
    if(ev.quip) r.quip = ev.quip;
    if(!S.quips){ r.quip = ""; r.outro = ""; r.action = T.action; }
  }
  if(!ev.silent) avatar.setSulk(false);
  gesture(r.action);
  if(!ev.silent && r.sound) chime(ev.type);
  // Commentaire écrit par Claude, s'il arrive à temps ; sinon la réplique habituelle.
  if(!ev.silent && r.ordinaire && S.quips && S.iaQuips && ia.pret()){
    const ecrit = await ia.commenter(ev, 5000);
    if(current !== ev) return;
    if(ecrit) r.quip = ecrit;
  }
  const quip = [r.quip, r.outro].filter(Boolean).join(" ");
  if(!ev.silent){
    if(r.voice && S.voice) speak([r.quip, ev.title, ev.message, r.outro]);
    else talkFor(quip + " " + (ev.message || ""));
  } else talkFor(ev.message || "");

  $("bubbleType").className = "chip t-" + ev.type; $("bubbleType").textContent = T.label;
  $("bubbleTime").textContent = ev.late ? "reçue à " + fmtTime(ev.date) : fmtTime(ev.date);
  $("bubbleTitle").textContent = ev.title || (ev.type === "persona" ? "" : T.label);
  $("bubbleTitle").hidden = !$("bubbleTitle").textContent;
  $("bubbleQuip").textContent = quip; $("bubbleQuip").hidden = !quip;
  const link = $("bubbleLink");
  if(ev.click){ link.href = ev.click; link.hidden = false; } else link.hidden = true;
  const msg = $("bubbleMsg"); msg.textContent = "";
  bubble.hidden = false; bubble.classList.remove("enter"); void bubble.offsetWidth; bubble.classList.add("enter");
  if(S.clickThrough && S.mode === "floating" && invoke) invoke("set_click_through", { enabled:false }).catch(() => {});
  const text = ev.message || ""; let i = 0;
  clearInterval(typeTimer);
  if(reduce) msg.textContent = text;
  else typeTimer = setInterval(() => { i += 2; msg.textContent = text.slice(0, i); if(i >= text.length) clearInterval(typeTimer); }, 22);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(closeBubble, ev.type === "persona" ? Math.max(6000, text.length*60 + 3000) : Math.max(9000, (text.length + quip.length)*55 + 7000));
}
function closeBubble(){
  clearTimeout(hideTimer); clearInterval(typeTimer);
  bubble.hidden = true; current = null; avatar.setTalking(false);
  if(queue.length) setTimeout(showNext, 700);
  else {
    avatar.setMood(null);
    if(S.clickThrough && S.mode === "floating" && invoke) invoke("set_click_through", { enabled:true }).catch(() => {});
  }
}
bubble.addEventListener("click", e => { if(e.target.closest("a")) return; closeBubble(); });

/* ---------- Journal ---------- */
const history = [];
function logEvent(ev){
  history.unshift(ev); if(history.length > 60) history.pop();
  const li = document.createElement("li");
  li.className = "t-" + ev.type;
  li.innerHTML = '<time></time><div class="bar"><b></b><span class="m"></span></div>';
  li.querySelector("time").textContent = fmtTime(ev.date);
  li.querySelector("b").textContent = ev.title || TYPES[ev.type].label;
  li.querySelector(".m").textContent = ev.message || "";
  const log = $("log"); log.prepend(li);
  while(log.children.length > 60) log.lastChild.remove();
  renderRecent();
}
function renderRecent(){
  const ol = $("recentList"); ol.innerHTML = "";
  const items = history.filter(e => !e.silent).slice(0, 4);
  $("recent").hidden = items.length === 0;
  for(const ev of items){
    const li = document.createElement("li"); li.className = "t-" + ev.type;
    li.innerHTML = "<time></time><b></b>";
    li.querySelector("time").textContent = fmtTime(ev.date);
    li.querySelector("b").textContent = ev.title || TYPES[ev.type].label;
    li.title = ev.message || "";
    ol.appendChild(li);
  }
}
function handle(ev){ ev.date = ev.date || new Date(); logEvent(ev); if(!ev.silent && !ev.test) ia.noterEvenement(ev); enqueue(ev); }

/* ---------- Sons (synthétisés) et voix ---------- */
let audio = null;
function ensureAudio(){
  try{ audio = audio || new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ audio = null; }
  if(audio && audio.state === "suspended") audio.resume().catch(() => {});
  setTimeout(() => { $("soundBtn").hidden = !S.sound || !audio || audio.state === "running"; }, 300);
}
$("soundBtn").addEventListener("click", () => { ensureAudio(); setTimeout(() => chime("info"), 100); });
window.addEventListener("pointerdown", ensureAudio, { once:true });
function tone(f, start, dur, type, gain){
  const o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + start;
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}
function chime(type){
  if(!S.sound) return;
  if(!audio) ensureAudio();
  if(!audio || audio.state !== "running") return;
  const seq = {
    info:    [[659,0,.35],[880,.12,.5]],
    success: [[523,0,.3],[659,.09,.3],[784,.18,.3],[1047,.27,.7]],
    alerte:  [[440,0,.25],[349,.16,.35],[440,.5,.25],[349,.66,.4]],
    news:    [[988,0,.25],[784,.1,.6]]
  }[type] || [];
  seq.forEach(([f,s,d]) => tone(f, s, d, type === "alerte" ? "square" : "triangle", type === "alerte" ? 0.05 : 0.16));
}
/* Petit bruit de servomoteur à chaque geste : c'est un droïde, il s'entend bouger. */
function servo(name){
  if(!S.sound || !audio || audio.state !== "running" || (S.quiet && inQuietHours())) return;
  const t0 = audio.currentTime, dur = { poke:0.18, no:0.35, jump:0.3 }[name] || 0.28;
  const o = audio.createOscillator(), f = audio.createBiquadFilter(), g = audio.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(150, t0); o.frequency.linearRampToValueAtTime(230 + Math.random()*60, t0 + dur*0.6); o.frequency.linearRampToValueAtTime(170, t0 + dur);
  f.type = "bandpass"; f.frequency.value = 1100; f.Q.value = 2.5;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.035, t0 + 0.03); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  o.connect(f).connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}
/* Voix : Piper en local avec filtre de droïde (voice.js), bouche animée par le niveau sonore réel. */
const VOICE_STATE = { off:"", loading:"Chargement de la voix de Lambert…", ready:"Voix de Lambert prête, calculée sur cet appareil.", failed:"Voix locale indisponible ici : la voix du système prend le relais." };
const voice = window.createVoice({
  getAudio:() => audio,
  onLevel:v => avatar.setVoiceLevel(v),
  onState:st => { $("voiceHint").textContent = VOICE_STATE[st] || ""; }
});
let talkTimer = null;
function talkFor(text){
  clearTimeout(talkTimer);
  if(!text || !text.trim()) return;
  avatar.setTalking(true);
  talkTimer = setTimeout(() => avatar.setTalking(false), Math.min(7000, 900 + text.length*38));
}
function speak(parts){
  const text = parts.filter(Boolean).map(s => s.trim().replace(/[.!?…:]?$/, m => m || ".")).join(" ");
  if(!S.voice || !text || !audio || audio.state !== "running") return talkFor(text);
  talkFor(text);   // la bouche bouge pendant le calcul de la première phrase
  voice.speak(text, {
    onstart:() => { clearTimeout(talkTimer); avatar.setTalking(true); },
    onend:() => avatar.setTalking(false)
  });
}

/* ---------- Parler à Lambert (API Claude et Kleos) ---------- */
const ia = window.createAssistant({ invoke, getSettings:() => S, persona });
let confirmation = null;

/* Conversation : maintenir Espace (ou le bouton du micro) pour parler, touche T pour écrire.
   Seulement dans l'application et avec une clé au trousseau : c'est la coque native qui parle à Claude. */
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false, convoBusy = false;
const iaPrete = () => !$("talkBtn").hidden;
function talkOpen(focus){ if(!iaPrete()) return; $("talk").hidden = false; if(focus) setTimeout(() => $("talkInput").focus(), 30); }
function talkClose(){ if(!listening && !convoBusy && !confirmation) $("talk").hidden = true; }
function talkState(t){ $("talkState").textContent = t || "À vous"; }
const etatIa = t => talkState(t);

function majIa(etat){
  const pret = !!(etat && etat.cle);
  $("talkBtn").hidden = !pret;
  if(!pret) $("talk").hidden = true;
  document.documentElement.classList.toggle("ia", pret);
  $("iaCleEtat").textContent = pret ? "Clé enregistrée dans le trousseau du Mac." : "Aucune clé : Lambert garde ses répliques habituelles.";
  $("kleosEtat").textContent = etat && etat.kleos ? "Kleos connecté : Lambert lit et écrit vos fiches. Il demande votre « oui » avant d'effacer ou d'envoyer quoi que ce soit à un tiers." : "Kleos non connecté.";
  const c = ia.consommation();
  $("iaConso").textContent = c.appels ? `Ce mois-ci sur cet appareil : ${c.appels} appel(s), environ ${c.cout.toFixed(2).replace(".", ",")} $.` : "";
  $("memoire").hidden = !(pret && etat.kleos);
}

/* La 0.4 gardait la clé dans les réglages de la page : elle part au trousseau, puis disparaît d'ici. */
async function reprendreAncienneCle(){
  const ancienne = S.apiKey;
  for(const k of ["apiKey", "kleosToken", "model"]) delete S[k];
  save();
  if(ancienne && invoke){ try{ await ia.enregistrerCle(ancienne); }catch(e){ console.warn("Clé de la 0.4 :", e); } }
}

/* La mémoire de Lambert : son carnet, relu et élagué depuis les réglages. */
async function lireCarnet(){
  const ul = $("carnet");
  $("memoireEtat").textContent = "Lecture du carnet…";
  try{
    const liste = await ia.souvenirs();
    ul.replaceChildren(...liste.map(s => {
      const li = document.createElement("li");
      const t = document.createElement("span"); t.textContent = s.texte;
      const b = document.createElement("button"); b.className = "btn ghost"; b.textContent = "Oublier";
      b.addEventListener("click", async () => {
        b.disabled = true;
        try{ await ia.oublier(s.id); li.remove(); }
        catch(e){ b.disabled = false; $("memoireEtat").textContent = "Impossible d'oublier : " + e; }
      });
      li.append(t, b); return li;
    }));
    $("memoireEtat").textContent = liste.length ? `${liste.length} souvenir(s).` : "Carnet vide.";
  }catch(e){ $("memoireEtat").textContent = "Lecture impossible : " + e; }
}
async function effacerMemoire(quoi, question){
  if(!confirm(question)) return;
  try{
    await ia.effacerMemoire(quoi);
    $("memoireEtat").textContent = quoi === "journal" ? "Journal effacé." : "Mémoire effacée.";
    if(quoi !== "journal") $("carnet").replaceChildren();
  }catch(e){ $("memoireEtat").textContent = "Effacement impossible : " + e; }
}
function demanderConfirmation(d){
  return new Promise(resolve => {
    confirmation = resolve;
    $("confirmText").textContent = d.annonce || ("Lambert veut utiliser « " + d.outil + " ».");
    $("confirmArgs").textContent = JSON.stringify(d.arguments || {}, null, 2);
    $("confirm").hidden = false;
    const phrase = (d.annonce ? d.annonce + " " : "") + "Je confirme ?";
    avatar.setActivity(null); convoBubble(phrase); talkOpen(false); talkState("Oui ou non ?");
    if(S.voice || S.sound) speak([phrase]);
  });
}
function repondreConfirmation(ok){
  if(!confirmation) return false;
  const r = confirmation; confirmation = null;
  $("confirm").hidden = true;
  r(ok);
  return true;
}
$("confirmYes").addEventListener("click", () => repondreConfirmation(true));
$("confirmNo").addEventListener("click", () => repondreConfirmation(false));

function startListening(){
  if(!iaPrete()) return;
  ensureAudio(); voice.cancel(); talkOpen(!Rec);
  if(!Rec){ talkState("Pas de reconnaissance vocale ici : écrivez"); return; }
  if(listening) return;
  try{ rec = new Rec(); }catch(e){ talkOpen(true); talkState("Écrivez"); return; }
  rec.lang = "fr-FR"; rec.interimResults = true; rec.continuous = false;
  rec.onresult = e => { let t = ""; for(const r of e.results) t += r[0].transcript; $("talkInput").value = t; };
  // Le code d'erreur reste affiché : c'est lui qui dit, sur le Mac, ce qui coince.
  rec.onerror = e => talkState((e.error === "not-allowed" || e.error === "service-not-allowed" ? "Micro refusé" : e.error === "no-speech" ? "Je n'ai rien entendu" : "Micro indisponible") + " (" + e.error + ") : touche T pour écrire");
  rec.onend = () => {
    listening = false; $("micBtn").classList.remove("on");
    const t = $("talkInput").value.trim();
    if(t) sendToLambert(t, true); else if(!convoBusy) talkState();
  };
  listening = true; $("micBtn").classList.add("on"); $("talkInput").value = ""; talkState("J'écoute…");
  avatar.setActivity(null);
  try{ rec.start(); }catch(e){ listening = false; $("micBtn").classList.remove("on"); talkState("Écrivez"); talkOpen(true); }
}
function stopListening(){ if(rec && listening) try{ rec.stop(); }catch(e){} }
function convoBubble(text){
  $("bubbleType").className = "chip t-persona"; $("bubbleType").textContent = persona.NAME;
  $("bubbleTime").textContent = fmtTime(new Date());
  $("bubbleTitle").textContent = ""; $("bubbleTitle").hidden = true;
  $("bubbleQuip").hidden = true; $("bubbleLink").hidden = true;
  $("bubbleMsg").textContent = text;
  if(bubble.hidden){ bubble.hidden = false; bubble.classList.remove("enter"); void bubble.offsetWidth; bubble.classList.add("enter"); }
  clearTimeout(hideTimer); clearInterval(typeTimer);
}
async function sendToLambert(text, aLOral){
  text = String(text || "").trim(); if(!text) return;
  $("talkInput").value = "";
  // Pendant une confirmation, un « oui » ou un « non » y répond.
  if(confirmation){
    const oui = window.reponseOuiNon(text);
    if(oui !== null) repondreConfirmation(oui); else talkState("Répondez « oui » ou « non », je vous prie.");
    return;
  }
  if(convoBusy){ talkState("Un instant, je termine ma réponse précédente."); return; }
  voice.cancel(); ensureAudio();
  convoBusy = true; lastActivity = Date.now();
  talkOpen(false); talkState("Vous : " + (text.length > 60 ? text.slice(0, 57) + "…" : text));
  current = { type:"persona", convo:true, date:new Date() };
  avatar.setMood(null); avatar.setActivity("muse");
  convoBubble("…");
  const finish = reply => {
    convoBusy = false; avatar.setActivity(null);
    convoBubble(reply);
    current = { type:"persona", convo:true, date:new Date() };
    talkState();
    if((S.voice || aLOral) && !(S.quiet && inQuietHours())) speak([reply]); else talkFor(reply);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if(current && current.convo){ closeBubble(); talkClose(); } }, Math.max(12000, reply.length*70 + 6000));
  };
  try{
    const reponse = await ia.converser(text, {
      confirmer:demanderConfirmation,
      etat:t => { talkState(t); if(t && /Kleos/.test(t)) $("bubbleMsg").textContent = "Je consulte Kleos…"; }
    });
    finish(reponse || "…");
  }catch(err){
    console.warn("Conversation :", err);
    ia.reinitialiser();
    const msg = String(err && err.message ? err.message : err || "");
    finish(/401|authentication|invalid x-api-key/i.test(msg) ? "Ma clé d'accès est refusée. Vérifiez-la dans les réglages, je vous prie."
      : /cl[ée] absente|aucune cl[ée]|no key/i.test(msg) ? "Il me manque ma clé d'accès à Claude. Réglages, section Intelligence de Lambert."
      : "Liaison perdue avec mon cerveau. " + msg + " Je réessaierai.");
  }finally{
    majIa(await ia.rafraichir());
  }
}
$("talk").addEventListener("submit", e => { e.preventDefault(); sendToLambert($("talkInput").value, false); });
$("micBtn").addEventListener("click", () => { if(listening) stopListening(); else startListening(); });
$("talkBtn").addEventListener("click", () => { if(Rec) startListening(); else { talkOpen(true); talkState("Pas de reconnaissance vocale ici : écrivez"); } });
window.addEventListener("keydown", e => {
  if(!iaPrete()) return;
  if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)){ if(e.key === "Escape" && document.activeElement.id === "talkInput"){ document.activeElement.blur(); talkClose(); } return; }
  if(!drawer.hidden) return;
  if(e.code === "Space" && !e.repeat && Rec){ e.preventDefault(); startListening(); }
  if(e.key === "t" || e.key === "T"){ e.preventDefault(); talkOpen(true); talkState(); }
});
window.addEventListener("keyup", e => { if(e.code === "Space" && listening) stopListening(); });

/* Réglages de l'intelligence */
$("iaCleBtn").addEventListener("click", async () => {
  const cle = $("iaCle").value; $("iaCle").value = "";
  try{ majIa(await ia.enregistrerCle(cle)); }catch(e){ $("iaCleEtat").textContent = String(e); }
});
$("iaCleEffacer").addEventListener("click", async () => { majIa(await ia.effacerCle()); });
$("iaCleTester").addEventListener("click", async () => {
  $("iaCleEtat").textContent = "Test en cours…";
  try{ $("iaCleEtat").textContent = "La clé fonctionne : " + await ia.testerCle() + " a répondu."; }
  catch(e){ $("iaCleEtat").textContent = "La clé ne fonctionne pas : " + (e && e.message ? e.message : e); }
});
$("iaModele").addEventListener("change", () => { S.iaModele = $("iaModele").value; save(); });
$("optIaQuips").addEventListener("change", () => { S.iaQuips = $("optIaQuips").checked; save(); });
$("kleosBtn").addEventListener("click", async () => {
  S.kleosUrl = $("kleosUrl").value.trim() || DEFAULTS.kleosUrl; save();
  $("kleosEtat").textContent = "Votre navigateur s'ouvre : connectez-vous à Kleos et acceptez l'accès de Manuvers.";
  try{ majIa(await ia.connecterKleos(S.kleosUrl)); }
  catch(e){ $("kleosEtat").textContent = "Connexion impossible : " + e; }
});
$("kleosOff").addEventListener("click", async () => { majIa(await ia.deconnecterKleos()); });
$("carnetLire").addEventListener("click", lireCarnet);
$("journalEffacer").addEventListener("click", () => effacerMemoire("journal", "Effacer tout le journal de vos conversations avec Lambert ? Son carnet est conservé."));
$("memoireEffacer").addEventListener("click", () => effacerMemoire("tout", "Effacer le carnet et le journal de Lambert ? Il ne se souviendra plus de rien."));

/* ---------- ntfy ---------- */
function classify(tags, priority){
  const t = (tags || []).map(s => String(s).toLowerCase());
  const has = list => t.some(x => list.includes(x));
  if(has(["alerte","alert","warning","rotating_light","relance","urgent"]) || (priority || 3) >= 4) return "alerte";
  if(has(["success","succes","prospect","tada","partying_face","white_check_mark","bravo"])) return "success";
  if(has(["news","veille","newspaper"])) return "news";
  return "info";
}
let missed = [], missedTimer = null;
function onNtfyMessage(m){
  const ev = { type:classify(m.tags, m.priority), title:m.title || "", message:m.message || "", click:m.click || "", priority:m.priority || 3, date:m.time ? new Date(m.time*1000) : new Date() };
  if(Date.now() - ev.date.getTime() > 120000){
    // Message arrivé pendant une absence (Mac en veille, application fermée) : on les regroupe.
    ev.late = true; missed.push(ev);
    clearTimeout(missedTimer); missedTimer = setTimeout(flushMissed, 1500);
    return;
  }
  handle(ev);
}
function flushMissed(){
  const list = missed.sort((a, b) => a.date - b.date); missed = [];
  if(!list.length) return;
  if(list.length === 1){ handle(list[0]); return; }
  list.forEach(ev => { ev.silentLog = true; logEvent(ev); });
  const top = list.reduce((a, b) => TYPES[b.type].rank >= TYPES[a.type].rank ? b : a);
  const titles = list.slice(-3).reverse().map(e => e.title || TYPES[e.type].label).join(" · ");
  enqueue({ type:top.type, date:new Date(), title:"Pendant votre absence", message:list.length + " notifications reçues. Les dernières : " + titles + ". Le détail est dans le journal.", quip:persona.digest() });
}
const client = new window.NtfyClient({
  onMessage:onNtfyMessage,
  onStatus:setStatus,
  getLastId:() => S.lastId,
  setLastId:id => { S.lastId = id; save(); }
});
function connect(){
  if(!/^[A-Za-z0-9_-]{6,64}$/.test(S.topic)){ setStatus("error", "Sujet invalide : 6 à 64 caractères, lettres, chiffres, tiret ou tiret bas."); return; }
  updateSnippet();
  client.start({ server:S.server, topic:S.topic, token:S.token });
}
function updateSnippet(){
  const base = (S.server || "https://ntfy.sh").replace(/\/+$/, "");
  $("curlSnippet").textContent =
`curl \\
  -H "Title: Veille GeoAI de 13h" \\
  -H "Tags: news" \\${S.token ? '\n  -H "Authorization: Bearer VOTRE_JETON" \\' : ""}
  -d "3 articles retenus aujourd'hui" \\
  ${base}/${S.topic}`;
}

/* ---------- Sessions Claude Code (application uniquement) : lecture locale des transcriptions ---------- */
const claudeWatch = invoke && window.createSessionWatcher ? window.createSessionWatcher({
  invoke,
  onEvent:ev => handle(ev),
  onSummary:c => {
    const el = $("claudeStatus"), parts = [];
    if(c.blocked) parts.push(c.blocked + (c.blocked > 1 ? " vous attendent" : " vous attend"));
    if(c.working) parts.push(c.working + " au travail");
    el.hidden = !parts.length;
    el.dataset.state = c.blocked ? "retry" : "ok";
    $("claudeText").textContent = "Claude Code : " + parts.join(" · ");
  }
}) : null;
function updateClaude(){ if(!claudeWatch) return; if(S.claude) claudeWatch.start(); else claudeWatch.stop(); }

/* ---------- Écran (application uniquement) ---------- */
let monitorSig = "";
async function refreshMonitors(){
  if(!invoke) return [];
  let list = [];
  try{ list = await invoke("list_monitors"); }catch(e){ return []; }
  const sel = $("monitor"); const keep = S.monitor;
  sel.innerHTML = '<option value="">Automatique : premier écran externe</option>';
  for(const m of list){
    const o = document.createElement("option");
    o.value = m.name; o.textContent = `${m.name} (${m.width} × ${m.height}${m.primary ? ", principal" : ""})`;
    sel.appendChild(o);
  }
  sel.value = list.some(m => m.name === keep) ? keep : "";
  const sig = list.map(m => m.name + m.width + "x" + m.height).sort().join("|");
  const changed = monitorSig && sig !== monitorSig;
  monitorSig = sig;
  return { list, changed };
}
async function applyScreen(){
  document.documentElement.dataset.mode = S.mode;
  avatar.resize();
  if(!invoke) return;
  try{
    await invoke("apply_mode", { mode:S.mode, monitor:S.monitor || null });
    await invoke("set_click_through", { enabled: S.mode === "floating" && S.clickThrough && !current });
  }catch(e){ console.warn("Affichage :", e); }
  setTimeout(() => avatar.resize(), 1200);
}
async function nextMonitor(){
  const r = await refreshMonitors(); if(!r.list || !r.list.length) return;
  const i = r.list.findIndex(m => m.name === S.monitor);
  S.monitor = r.list[(i + 1) % r.list.length].name; S.mode = "scene"; save(); syncForm(); applyScreen();
}
setInterval(async () => { const r = await refreshMonitors(); if(r && r.changed) applyScreen(); }, 15000);

/* ---------- Écran allumé ---------- */
let awakeOn = null;
function inAwakeHours(){
  const d = new Date(), day = d.getDay();
  if(S.weekdays && (day === 0 || day === 6)) return false;
  const hm = d.getHours()*60 + d.getMinutes();
  const toMin = s => { const [h, m] = (s || "0:0").split(":").map(Number); return h*60 + m; };
  const a = toMin(S.awakeFrom), b = toMin(S.awakeTo);
  return a <= b ? hm >= a && hm < b : hm >= a || hm < b;
}
function inQuietHours(){
  const d = new Date(), hm = d.getHours()*60 + d.getMinutes();
  const toMin = s => { const [h, m] = (s || "0:0").split(":").map(Number); return h*60 + m; };
  const a = toMin(S.quietFrom), b = toMin(S.quietTo);
  return a <= b ? hm >= a && hm < b : hm >= a || hm < b;
}
async function updateAwake(){
  if(!invoke) return;
  const want = S.keepAwake && inAwakeHours();
  if(want === awakeOn) return;
  try{ await invoke("set_keep_awake", { enabled:want }); awakeOn = want; }catch(e){ console.warn("Veille :", e); }
}
setInterval(updateAwake, 60000);

/* ---------- Vie autonome : entre deux notifications, Lambert vit sa vie ----------
   Tablette 70 % du temps, puis lecture, méditation, entretien, étirements ; veille pendant les heures de silence.
   De temps en temps, une réplique liée à ce qu'il fait (punchlines.js), et parfois il vous montre sa tablette. */
const LIFE = [["tablet", 70], ["book", 8], ["muse", 7], ["polish", 4], ["oil", 4], ["stretch", 4], ["idle", 3]];
const LIFE_TIME = { tablet:[70, 200], book:[60, 150], muse:[25, 45], polish:[25, 45], oil:[20, 35], stretch:[14, 15], idle:[15, 30] };
let lastActivity = Date.now(), lifeUntil = 0, lifeResume = Date.now() + 5000, nextLine = Date.now() + 75000;
function pickLife(){
  let r = Math.random()*100;
  for(const [name, weight] of LIFE){ if((r -= weight) < 0) return name; }
  return "tablet";
}
setInterval(() => {
  const now = Date.now();
  if(listening || convoBusy){ lifeResume = now + 8000; return; }
  if(current && !current.silent){ if(!current.convo && avatar.activity()) avatar.setActivity(null); lifeResume = now + 5000; return; }
  if(!S.bored){ if(avatar.activity()) avatar.setActivity(null); return; }
  if(persona.sulking() || now < lifeResume) return;
  const quiet = S.quiet && inQuietHours();
  if(quiet){ if(avatar.activity() !== "sleep") avatar.setActivity("sleep"); return; }
  if(now > lifeUntil || avatar.activity() === "sleep"){
    const a = pickLife();
    avatar.setActivity(a === "idle" ? null : a);
    const [lo, hi] = LIFE_TIME[a];
    lifeUntil = now + (lo + Math.random()*(hi - lo))*1000;
    return;
  }
  if(S.chatty && S.quips && !current && now > nextLine && now - lastActivity > 90000){
    nextLine = now + (4 + Math.random()*5)*60000;
    const a = avatar.activity();
    const line = persona.activityLine(a, new Date());
    if(a === "tablet" && Math.random() < 0.45){ avatar.tabletShow(true); setTimeout(() => avatar.tabletShow(false), 6000); }
    enqueue({ type:"persona", title:"", message:line, date:new Date(), silent:true, action:null });
    if(S.voice) speak([line]);
  }
}, 1000);

/* ---------- Clic sur le droïde ---------- */
$("scene").addEventListener("pointerdown", e => {
  if(!avatar.hit(e.clientX, e.clientY)) return;
  if(current && !current.silent) return;
  lastActivity = Date.now();
  const r = persona.poke(new Date());
  if(r.sulk){ avatar.setSulk(true); setTimeout(() => avatar.setSulk(false), r.sulk); }
  if(current) { clearTimeout(hideTimer); bubble.hidden = true; current = null; }
  enqueue({ type:"persona", title:"", message:r.quip, date:new Date(), silent:true, action:r.action });
  if(S.voice && !(S.quiet && inQuietHours())) speak([r.quip]);
});

/* ---------- Tiroir de réglages ---------- */
const drawer = $("drawer");
function openDrawer(open){
  drawer.hidden = open === undefined ? !drawer.hidden : !open;
  if(!drawer.hidden){ syncForm(); refreshMonitors(); if(invoke && S.clickThrough) invoke("set_click_through", { enabled:false }).catch(() => {}); }
}
$("settingsBtn").addEventListener("click", () => openDrawer());
$("closeDrawer").addEventListener("click", () => openDrawer(false));
window.addEventListener("keydown", e => {
  if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if(e.key === "r" || e.key === "R") openDrawer();
  if(e.key === "Escape") openDrawer(false);
});

const CHECKS = { optClaude:"claude", optSound:"sound", optVoice:"voice", optBored:"bored", optAutostart:"autostart", optAwake:"keepAwake", optWeekdays:"weekdays", optClick:"clickThrough", optQuips:"quips", optChatty:"chatty", optQuiet:"quiet" };
function syncForm(){
  $("server").value = S.server; $("topic").value = S.topic; $("token").value = S.token;
  $("mode").value = S.mode; $("awakeFrom").value = S.awakeFrom; $("awakeTo").value = S.awakeTo;
  $("quietFrom").value = S.quietFrom; $("quietTo").value = S.quietTo;
  $("timbre").value = Math.round(S.timbre*100);
  for(const [id, k] of Object.entries(CHECKS)) $(id).checked = !!S[k];
  $("iaModele").value = S.iaModele; $("optIaQuips").checked = !!S.iaQuips; $("kleosUrl").value = S.kleosUrl;
}
for(const [id, k] of Object.entries(CHECKS)){
  $(id).addEventListener("change", () => {
    S[k] = $(id).checked; save();
    if(k === "sound") ensureAudio();
    if(k === "claude") updateClaude();
    if(k === "voice"){ if(S.voice){ ensureAudio(); voice.preload(); setTimeout(() => speak(["Voix activée. Lambert, à votre écoute."]), 400); } else voice.cancel(); }
    if(k === "autostart" && invoke) invoke("set_autostart", { enabled:S.autostart }).catch(e => console.warn(e));
    if(k === "keepAwake" || k === "weekdays"){ awakeOn = null; updateAwake(); }
    if(k === "clickThrough") applyScreen();
  });
}
["awakeFrom","awakeTo"].forEach(id => $(id).addEventListener("change", () => { S[id] = $(id).value; save(); awakeOn = null; updateAwake(); }));
["quietFrom","quietTo"].forEach(id => $(id).addEventListener("change", () => { S[id] = $(id).value; save(); }));
$("timbre").addEventListener("input", () => { S.timbre = $("timbre").value/100; voice.setTimbre(S.timbre); });
$("timbre").addEventListener("change", () => { save(); if(S.voice){ ensureAudio(); speak(["Voici mon timbre. " + persona.SEAL]); } });
voice.setTimbre(S.timbre);
$("mode").addEventListener("change", () => { S.mode = $("mode").value; save(); applyScreen(); });
$("monitor").addEventListener("change", () => { S.monitor = $("monitor").value; save(); if(S.mode === "scene") applyScreen(); });
$("connectBtn").addEventListener("click", () => {
  const server = $("server").value.trim() || "https://ntfy.sh";
  const topic = $("topic").value.trim();
  const changed = server !== S.server || topic !== S.topic;
  S.server = server; S.topic = topic; S.token = $("token").value.trim();
  if(changed) S.lastId = "";
  save(); connect();
});
document.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => {
  const el = $(b.dataset.copy), txt = el.textContent;
  const done = () => { b.textContent = "Copié"; setTimeout(() => b.textContent = "Copier", 1500); };
  const fallback = () => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Sélectionné"; setTimeout(() => b.textContent = "Copier", 1500); };
  try{ navigator.clipboard.writeText(txt).then(done, fallback); }catch(e){ fallback(); }
}));

/* ---------- Simulations ---------- */
const SAMPLES = {
  info:    { title:"Brief du matin prêt", message:"Votre point du jour est disponible : 3 rendez-vous et 2 mails à traiter en priorité." },
  success: { title:"Nouveau prospect dans Kleos", message:"Une responsable SIG a rempli le formulaire de contact. La fiche est créée, la note de découverte vous attend." },
  alerte:  { title:"Relances en retard", message:"2 propositions sont sans réponse depuis plus de 10 jours. Un brouillon de relance est prêt." },
  news:    { title:"Veille GeoAI de 13h", message:"3 articles retenus aujourd'hui, dont une nouveauté sur la segmentation d'images satellite." }
};
function simulate(type){ handle({ type, title:SAMPLES[type].title + " (test)", message:SAMPLES[type].message, test:true }); }
document.querySelectorAll("[data-sim]").forEach(b => b.addEventListener("click", () => { ensureAudio(); simulate(b.dataset.sim); }));

/* ---------- Menu de la barre des menus ---------- */
if(listen){
  listen("tray", e => {
    switch(e.payload){
      case "mode-scene": S.mode = "scene"; save(); applyScreen(); break;
      case "mode-floating": S.mode = "floating"; save(); applyScreen(); break;
      case "next-monitor": nextMonitor(); break;
      case "toggle-sound": S.sound = !S.sound; save(); syncForm(); if(S.sound) chime("info"); break;
      case "test": simulate(["info","success","alerte","news"][Math.floor(Math.random()*4)]); break;
      case "settings": openDrawer(true); break;
    }
  });
}

/* ---------- Démarrage ---------- */
(async function boot(){
  syncForm(); updateSnippet(); renderRecent();
  await refreshMonitors();
  await applyScreen();
  if(invoke) invoke("set_autostart", { enabled:S.autostart }).catch(e => console.warn("Démarrage auto :", e));
  updateAwake();
  ensureAudio();
  if(S.voice) voice.preload();
  connect();
  await reprendreAncienneCle();
  majIa(await ia.rafraichir());
  updateClaude();
  setTimeout(() => {
    if(current || queue.length) return;
    const g = persona.greeting(new Date(), !S.met);
    S.met = true; save();
    handle({ type:"persona", title:g.title, message:g.message, silent:true, action:"bow" });
  }, 900);
})();
})();
