/* Manuvers : synthèse vocale Piper, entièrement locale, dans un worker pour ne pas gêner l'animation 3D.
   Phonétisation : piper_phonemize (espeak-ng compilé en WebAssembly). Inférence : onnxruntime-web.
   Messages reçus :  { type:"init", model }  puis  { type:"speak", id, text, lengthScale, speaker }
   Messages envoyés : ready | error | chunk { id, pcm, sampleRate, last } (une phrase à la fois, pour parler sans attendre la fin). */
"use strict";
importScripts("vendor/piper/piper_phonemize.js", "vendor/onnx/ort.wasm.min.js");

let ready = null, session = null, config = null, phonemizer = null, onLine = null, busy = Promise.resolve();

function init(model){
  return ready = ready || (async () => {
    ort.env.wasm.numThreads = 1;              // pas d'isolation cross-origin sur GitHub Pages : un seul fil
    ort.env.wasm.wasmPaths = new URL("vendor/onnx/", self.location.href).href;
    const get = (url, kind) => fetch(url).then(r => { if(!r.ok) throw new Error(url + " : " + r.status); return r[kind](); });
    const [cfg, onnx, data, wasm] = await Promise.all([
      get(model + ".json", "json"), get(model, "arrayBuffer"),
      get("vendor/piper/piper_phonemize.data", "arrayBuffer"), get("vendor/piper/piper_phonemize.wasm", "arrayBuffer")
    ]);
    config = cfg;
    session = await ort.InferenceSession.create(onnx, { executionProviders:["wasm"], graphOptimizationLevel:"all" });
    phonemizer = await createPiperPhonemize({
      print: line => { if(onLine) onLine(line); },
      printErr: () => {},
      wasmBinary: wasm,
      getPreloadedPackage: () => data,
      locateFile: f => "vendor/piper/" + f
    });
  })();
}

// Phonèmes vers identifiants selon la table du modèle (elle diffère d'un modèle à l'autre) : ^ _ (phonème _)* $
function toIds(phonemes){
  const map = config.phoneme_id_map, pad = map._ || [0];
  const ids = [...(map["^"] || [1]), ...pad];
  for(const p of phonemes || []){ const id = map[p]; if(id){ ids.push(...id, ...pad); } }
  ids.push(...(map.$ || [2]));
  return ids;
}

function phonemize(text){
  return new Promise((resolve, reject) => {
    onLine = line => { onLine = null; try{ resolve(toIds(JSON.parse(line).phonemes)); }catch(e){ reject(e); } };
    try{ phonemizer.callMain(["-l", config.espeak.voice, "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]); }
    catch(e){ onLine = null; reject(e); }
  });
}

async function synth(text, lengthScale, speaker){
  const ids = await phonemize(text);
  if(!ids || !ids.length) return new Float32Array(0);
  const inf = config.inference || {};
  const i64 = a => BigInt64Array.from(a.map(n => BigInt(n)));
  const feeds = {
    input: new ort.Tensor("int64", i64(ids), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", i64([ids.length]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([inf.noise_scale ?? 0.667, lengthScale || inf.length_scale || 1, inf.noise_w ?? 0.8]), [3])
  };
  const map = config.speaker_id_map || {};
  if(Object.keys(map).length) feeds.sid = new ort.Tensor("int64", i64([map[speaker] ?? 0]), [1]);
  const out = await session.run(feeds);
  return new Float32Array(out[session.outputNames[0]].data);
}

// Découpe en phrases, en regroupant les très courtes pour garder une intonation naturelle
function sentences(text){
  const parts = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?…:;])\s+/);
  const out = [];
  for(const p of parts){ if(out.length && (out[out.length-1].length < 28 || p.length < 12)) out[out.length-1] += " " + p; else out.push(p); }
  return out.filter(s => /[\p{L}\p{N}]/u.test(s));
}

let current = 0;
self.onmessage = async e => {
  const m = e.data;
  if(m.type === "init"){
    try{ await init(m.model); postMessage({ type:"ready", sampleRate:config.audio.sample_rate }); }
    catch(err){ postMessage({ type:"error", message:String(err && err.message || err) }); }
    return;
  }
  if(m.type === "cancel"){ current = 0; return; }
  if(m.type === "speak"){
    current = m.id;
    busy = busy.then(async () => {
      if(current !== m.id) return;
      try{
        await ready;
        const list = sentences(m.text);
        for(let i = 0; i < list.length; i++){
          if(current !== m.id) return;
          const pcm = await synth(list[i], m.lengthScale, m.speaker);
          postMessage({ type:"chunk", id:m.id, pcm, sampleRate:config.audio.sample_rate, last:i === list.length - 1 }, [pcm.buffer]);
        }
        if(!list.length) postMessage({ type:"chunk", id:m.id, pcm:new Float32Array(0), sampleRate:config.audio.sample_rate, last:true });
      }catch(err){ postMessage({ type:"error", id:m.id, message:String(err && err.message || err) }); }
    });
  }
};
