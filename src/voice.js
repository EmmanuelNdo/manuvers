/* Manuvers : la voix de Lambert.
   Synthèse Piper entièrement locale (voice-worker.js, modèle dans voices/), passée dans un filtre de droïde
   (WebAudio), avec niveau sonore transmis à l'avatar pour animer la bouche. Repli automatique sur la
   synthèse vocale du système si WebAssembly, le worker ou le modèle ne sont pas disponibles.
   Expose window.createVoice({ getAudio, onLevel, onState }) : speak(text, { onstart, onend }), cancel(),
   preload(), setTimbre(0..1), state(). Et window.droidChain(ctx, amount) pour les essais hors ligne. */
(function(){
"use strict";

const MODEL = "voices/fr_FR-tom-medium.onnx";
const PITCH = 1.06;    // un droïde de protocole parle un peu plus haut...
const LENGTH = 0.97;   // ...et un peu plus vite (compensé de la hausse de hauteur)
const GAP = 0.14;      // respiration entre deux phrases, en secondes

/* Filtre de droïde : coupe-bas, présence métallique, résonance de boîtier (filtre en peigne)
   et une pointe de modulation en anneau. amount : 0 (voix nette) à 1 (très métallique). */
window.droidChain = function(ctx, amount){
  const input = ctx.createGain();
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 170; hp.Q.value = 0.7;
  const pres = ctx.createBiquadFilter(); pres.type = "peaking"; pres.frequency.value = 2600; pres.Q.value = 1.1;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
  input.connect(hp).connect(pres).connect(lp);
  const dry = ctx.createGain(); lp.connect(dry);
  const comb = ctx.createDelay(0.05); comb.delayTime.value = 0.0062;
  const fb = ctx.createGain(), combOut = ctx.createGain();
  lp.connect(comb); comb.connect(fb).connect(comb); comb.connect(combOut);
  const ring = ctx.createGain(); ring.gain.value = 0;
  const osc = ctx.createOscillator(); osc.frequency.value = 42; osc.connect(ring.gain); osc.start();
  const ringOut = ctx.createGain(); lp.connect(ring); ring.connect(ringOut);
  const sum = ctx.createGain(); dry.connect(sum); combOut.connect(sum); ringOut.connect(sum);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.15;
  const output = ctx.createGain(); output.gain.value = 1.1;
  sum.connect(comp).connect(output);
  function set(a){
    a = Math.max(0, Math.min(1, a));
    pres.gain.value = 2 + 5*a; lp.frequency.value = 8500 - 2500*a;
    dry.gain.value = 1 - 0.3*a; fb.gain.value = 0.45*a; combOut.gain.value = 0.5*a; ringOut.gain.value = 0.18*a;
  }
  set(amount);
  return { input, output, set };
};

/* Texte écrit pour l'œil, prononcé pour l'oreille */
function normalize(text){
  return String(text || "")
    .replace(/https?:\/\/\S+/g, "le lien")
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "")
    .replace(/\bLB-93\b/g, "elle bé quatre-vingt-treize")
    .replace(/\bLambert-93\b/g, "Lambert quatre-vingt-treize")
    .replace(/\b(\d{1,2}) ?h ?(\d{2})\b/g, "$1 heures $2")
    .replace(/\b(\d{1,2}) ?h\b/g, "$1 heures")
    .replace(/(\d) ?%/g, "$1 pour cent")
    .replace(/\bGeoAI\b/gi, "Géo A I")
    .replace(/\b(?=[A-Z]*[A-Z])([A-Z]{2,4})\b/g, m => m.split("").join(" "))
    .replace(/[«»"“”()[\]]/g, " ")
    .replace(/\s+/g, " ").trim();
}

window.createVoice = function(opts){
  let worker = null, st = "off", timbre = 0.6, reqId = 0, job = null;
  let chain = null, chainCtx = null, analyser = null, levelBuf = null, meterOn = false;
  const setState = s => { st = s; if(opts.onState) opts.onState(s); };

  function ensureWorker(){
    if(worker || st === "failed") return;
    if(typeof WebAssembly !== "object" || typeof Worker !== "function" || typeof BigInt64Array !== "function"){ setState("failed"); return; }
    try{ worker = new Worker("voice-worker.js"); }catch(e){ setState("failed"); return; }
    setState("loading");
    worker.onmessage = onMessage;
    worker.onerror = e => { console.warn("Voix Piper :", e.message || e); fail(); };
    worker.postMessage({ type:"init", model:MODEL });
  }
  function fail(){
    setState("failed");
    if(worker){ worker.terminate(); worker = null; }
    if(job && !job.started){ const j = job; job = null; system(j.text, j); }
  }
  function onMessage(e){
    const m = e.data;
    if(m.type === "ready"){ setState("ready"); return; }
    if(m.type === "error"){
      console.warn("Voix Piper :", m.message);
      if(!m.id) return fail();
      if(job && job.id === m.id) end(job);
      return;
    }
    if(m.type === "chunk" && job && job.id === m.id) schedule(job, m);
  }
  function graph(ctx){
    if(chainCtx === ctx) return;
    chain = window.droidChain(ctx, timbre);
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024; levelBuf = new Float32Array(analyser.fftSize);
    chain.output.connect(analyser); chain.output.connect(ctx.destination);
    chainCtx = ctx;
  }
  function schedule(j, m){
    const ctx = opts.getAudio && opts.getAudio();
    if(!ctx || ctx.state !== "running"){ if(m.last) end(j); return; }
    graph(ctx);
    if(m.pcm.length){
      const buf = ctx.createBuffer(1, m.pcm.length, m.sampleRate);
      buf.copyToChannel(m.pcm, 0);
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = PITCH;
      src.connect(chain.input);
      const t = Math.max(ctx.currentTime + 0.03, j.next);
      src.start(t); j.next = t + buf.duration/PITCH + GAP; j.sources.push(src);
      if(!j.started){ j.started = true; setTimeout(() => { if(job === j && j.onstart) j.onstart(); }, Math.max(0, (t - ctx.currentTime)*1000)); meter(); }
      if(m.last) src.onended = () => end(j);
    } else if(m.last){
      const last = j.sources[j.sources.length - 1];
      if(last) last.onended = () => end(j); else end(j);
    }
  }
  function end(j){
    if(j.done) return; j.done = true;
    if(job === j) job = null;
    if(opts.onLevel) opts.onLevel(0);
    if(j.onend) j.onend();
  }
  function meter(){
    if(meterOn) return; meterOn = true;
    (function tick(){
      if(!job || !analyser){ meterOn = false; if(opts.onLevel) opts.onLevel(0); return; }
      analyser.getFloatTimeDomainData(levelBuf);
      let s = 0; for(let i = 0; i < levelBuf.length; i++) s += levelBuf[i]*levelBuf[i];
      if(opts.onLevel) opts.onLevel(Math.min(1, Math.sqrt(s/levelBuf.length)*6));
      requestAnimationFrame(tick);
    })();
  }

  // Repli : voix du système, avec le phrasé de Lambert
  function system(text, j){
    if(!window.speechSynthesis) return j && j.onend && j.onend();
    try{
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "fr-FR"; u.rate = 1.06; u.pitch = 1.15;
      const voices = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith("fr"));
      const v = voices.find(v => /thomas/i.test(v.name)) || voices.find(v => /fr-fr/i.test(v.lang)) || voices[0];
      if(v) u.voice = v;
      u.onstart = () => j && j.onstart && j.onstart();
      u.onend = u.onerror = () => j && j.onend && j.onend();
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }catch(e){ if(j && j.onend) j.onend(); }
  }

  function cancel(){
    if(job){
      const j = job; job = null;
      j.sources.forEach(s => { s.onended = null; try{ s.stop(); }catch(e){} });
      end(j);
    }
    if(worker) worker.postMessage({ type:"cancel" });
    if(window.speechSynthesis) try{ speechSynthesis.cancel(); }catch(e){}
  }

  return {
    preload(){ ensureWorker(); },
    state(){ return st; },
    setTimbre(a){ timbre = a; if(chain) chain.set(a); },
    cancel,
    speak(text, cb){
      cb = cb || {};
      cancel();
      text = normalize(text);
      if(!text) return cb.onend && cb.onend();
      ensureWorker();
      const j = { id:++reqId, text, onstart:cb.onstart, onend:cb.onend, started:false, done:false, next:0, sources:[] };
      if(st === "failed") return system(text, j);
      job = j;
      worker.postMessage({ type:"speak", id:j.id, text, lengthScale:LENGTH*PITCH });
    },
    normalize
  };
};
})();
