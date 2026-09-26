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
  quips:true, chatty:true, quiet:true, quietFrom:"21:30", quietTo:"07:30", met:false,
  keepAwake:true, awakeFrom:"08:30", awakeTo:"19:00", weekdays:true
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
function showNext(){
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
  const quip = [r.quip, r.outro].filter(Boolean).join(" ");
  if(!ev.silent){
    if(r.sound) chime(ev.type);
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
function handle(ev){ ev.date = ev.date || new Date(); logEvent(ev); enqueue(ev); }

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
/* Voix : le phrasé de Lambert est un peu plus aigu et vif que la voix système par défaut. */
let talkTimer = null;
function talkFor(text){
  clearTimeout(talkTimer);
  if(!text || !text.trim()) return;
  avatar.setTalking(true);
  talkTimer = setTimeout(() => avatar.setTalking(false), Math.min(7000, 900 + text.length*38));
}
function speak(parts){
  const text = parts.filter(Boolean).map(s => s.trim().replace(/[.!?…]?$/, m => m || ".")).join(" ");
  if(!S.voice || !window.speechSynthesis || !text) return talkFor(text);
  try{
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR"; u.rate = 1.06; u.pitch = 1.15;
    const voices = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith("fr"));
    const v = voices.find(v => /thomas/i.test(v.name)) || voices.find(v => /fr-fr/i.test(v.lang)) || voices[0];
    if(v) u.voice = v;
    u.onstart = () => { clearTimeout(talkTimer); avatar.setTalking(true); };
    u.onend = u.onerror = () => avatar.setTalking(false);
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch(e){ talkFor(text); }
}

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

/* ---------- Vie au repos : gestes et remarques spontanées ---------- */
let lastActivity = Date.now(), nextBored = Date.now() + 45000, nextRemark = Date.now() + 8*60000;
setInterval(() => {
  if(current || avatar.busy() || persona.sulking()) return;
  const now = Date.now();
  if(S.chatty && S.quips && now > nextRemark && now - lastActivity > 5*60000 && !(S.quiet && inQuietHours())){
    nextRemark = now + (12 + Math.random()*14)*60000;
    enqueue({ type:"persona", title:"", message:persona.remark(new Date()), date:new Date(), silent:true, action:"look" });
    return;
  }
  if(!S.bored || now < nextBored) return;
  const r = Math.random();
  gesture(r < 0.35 ? "look" : r < 0.6 ? "stretch" : r < 0.85 ? "inspect" : "tap");
  nextBored = now + 30000 + Math.random()*30000;
}, 2000);

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

const CHECKS = { optSound:"sound", optVoice:"voice", optBored:"bored", optAutostart:"autostart", optAwake:"keepAwake", optWeekdays:"weekdays", optClick:"clickThrough", optQuips:"quips", optChatty:"chatty", optQuiet:"quiet" };
function syncForm(){
  $("server").value = S.server; $("topic").value = S.topic; $("token").value = S.token;
  $("mode").value = S.mode; $("awakeFrom").value = S.awakeFrom; $("awakeTo").value = S.awakeTo;
  $("quietFrom").value = S.quietFrom; $("quietTo").value = S.quietTo;
  for(const [id, k] of Object.entries(CHECKS)) $(id).checked = !!S[k];
}
for(const [id, k] of Object.entries(CHECKS)){
  $(id).addEventListener("change", () => {
    S[k] = $(id).checked; save();
    if(k === "sound") ensureAudio();
    if(k === "autostart" && invoke) invoke("set_autostart", { enabled:S.autostart }).catch(e => console.warn(e));
    if(k === "keepAwake" || k === "weekdays"){ awakeOn = null; updateAwake(); }
    if(k === "clickThrough") applyScreen();
  });
}
["awakeFrom","awakeTo"].forEach(id => $(id).addEventListener("change", () => { S[id] = $(id).value; save(); awakeOn = null; updateAwake(); }));
["quietFrom","quietTo"].forEach(id => $(id).addEventListener("change", () => { S[id] = $(id).value; save(); }));
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
  connect();
  setTimeout(() => {
    if(current || queue.length) return;
    const g = persona.greeting(new Date(), !S.met);
    S.met = true; save();
    handle({ type:"persona", title:g.title, message:g.message, silent:true, action:"bow" });
  }, 900);
})();
})();
