# Composants embarqués

Tout est servi localement : aucune ressource n'est chargée depuis Internet.
Pour régénérer le SDK : `npm i @anthropic-ai/sdk esbuild`, puis `esbuild entry.js --bundle --minify --format=iife --platform=browser --target=es2020`, avec `entry.js` : `import Anthropic from "@anthropic-ai/sdk"; window.Anthropic = Anthropic;`.

| Dossier | Composant | Licence |
|---|---|---|
| `three.min.js` | Three.js r128 | MIT |
| `anthropic-sdk.js` | SDK Anthropic pour TypeScript 0.128.0, regroupé pour le navigateur (esbuild, IIFE exposant `window.Anthropic`) | MIT |
| `onnx/` | onnxruntime-web 1.30.0 (build WebAssembly) | MIT |
| `piper/` | piper_phonemize (@diffusionstudio/piper-wasm 1.0.0), qui embarque espeak-ng et ses données | MIT (enveloppe), GPL-3.0 (espeak-ng) |
| `../voices/fr_FR-tom-medium.onnx` | Voix Piper « tom », qualité medium, 44,1 kHz | AGPL-3.0 (jeu de données, voir https://huggingface.co/rhasspy/piper-voices) |

Voix alternatives testées pour Lambert : `fr_FR-upmc-medium` (locuteur pierre, CC BY-SA 4.0) et `fr_FR-gilles-low` (CC0).
Pour changer de voix : déposer le `.onnx` et son `.onnx.json` dans `src/voices/` et modifier `MODEL` dans `src/voice.js`.
