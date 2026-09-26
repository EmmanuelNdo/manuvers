/* Manuvers : l'avatar 3D de LB-93, dit Lambert (Three.js r128, chargé localement depuis vendor/).
   Droïde de protocole et de cartographie, entièrement procédural, dans l'esprit des droïdes
   usés et bricolés : plaques de céramique ivoire patinée à inserts vert carte, cuivre, acier,
   mécanique graphite et câbles apparents (taille, cou, jambes), tête en soucoupe à visière et yeux
   en barres lumineuses, monocle de visée sur le bord du dôme, prisme de géomètre, avant-bras gauche
   bleu dépareillé (pièce de rechange), plaque gravée de courbes de niveau et rose des vents.
   Expose window.createAvatar(canvas, stage) qui renvoie une petite API :
   play(action), busy(), setMood(couleur|null), setTalking(bool), setVoiceLevel(0..1), setSulk(bool), hit(x, y),
   toScreen(x, y), rigY(), isWide(), onFrame(cb), resize().
   Actions : wave, jump, fret, lean, no, poke, bow, look, inspect, tap, stretch. */
(function(){
"use strict";

window.createAvatar = function(canvas, stage){
  const IDLE_COLOR = 0xff9a2e;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // Environnement de reflets calculé localement : un ciel dégradé et deux panneaux lumineux.
  (function environment(){
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 32, 16);
    const pos = geo.attributes.position, cols = [];
    const sky = new THREE.Color(0xdfe8f5), ground = new THREE.Color(0x3a3530), c = new THREE.Color();
    for(let i = 0; i < pos.count; i++){ c.copy(ground).lerp(sky, Math.min(1, Math.max(0, pos.getY(i)/10*0.9 + 0.5))); cols.push(c.r, c.g, c.b); }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.BackSide })));
    const panel = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color:new THREE.Color(k, k*0.96, k*0.9), side:THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
    panel(7, 3, 2, 6, 5, 5); panel(3, 6, -7, 2, 1, 2.2); panel(4, 2, 0, -1, 8, 1.2);
    scene.environment = pmrem.fromScene(env, 0.03).texture;
    pmrem.dispose();
  })();

  scene.add(new THREE.HemisphereLight(0xe8eeff, 0x3a3228, 0.3));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.25); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9cc8ff, 0.9); rim.position.set(-4, 3, -3); scene.add(rim);

  // Matières : céramique ivoire patinée, inserts vert carte, cuivre, acier, mécanique graphite, gaines
  function grimeTexture(){
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, 512, 512);
    let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
    for(let i = 0; i < 160; i++){               // voiles de poussière
      const x = rnd()*512, y = rnd()*512, r = 8 + rnd()*46;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(92,78,58,${0.02 + rnd()*0.05})`); gr.addColorStop(1, "rgba(92,78,58,0)");
      g.fillStyle = gr; g.fillRect(x - r, y - r, r*2, r*2);
    }
    for(let i = 0; i < 1400; i++){              // piqûres
      g.fillStyle = `rgba(60,52,40,${0.05 + rnd()*0.16})`;
      g.fillRect(rnd()*512, rnd()*512, 1 + rnd()*1.6, 1 + rnd()*1.6);
    }
    g.lineCap = "round";
    for(let i = 0; i < 90; i++){                // rayures
      const x = rnd()*512, y = rnd()*512, a = rnd()*Math.PI, l = 6 + rnd()*34;
      g.strokeStyle = rnd() < 0.5 ? `rgba(70,60,48,${0.18 + rnd()*0.25})` : `rgba(255,255,255,${0.35 + rnd()*0.3})`;
      g.lineWidth = 0.6 + rnd()*1.1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a)*l, y + Math.sin(a)*l); g.stroke();
    }
    for(let i = 0; i < 26; i++){                // éclats de peinture
      const x = rnd()*512, y = rnd()*512;
      g.fillStyle = `rgba(120,110,98,${0.25 + rnd()*0.3})`;
      g.beginPath(); g.ellipse(x, y, 2 + rnd()*7, 1 + rnd()*4, rnd()*3, 0, Math.PI*2); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.anisotropy = 4;
    return t;
  }
  const grime = grimeTexture();
  const ivory = new THREE.MeshStandardMaterial({ color:0xe6dccb, map:grime, roughness:0.52, metalness:0.04, envMapIntensity:0.75 });
  const olive = new THREE.MeshStandardMaterial({ color:0x55643f, map:grime, roughness:0.6, metalness:0.05, envMapIntensity:0.6 });
  const ochre = new THREE.MeshStandardMaterial({ color:0xd09a2c, roughness:0.45, metalness:0.1 });
  const copper = new THREE.MeshStandardMaterial({ color:0xb86a32, roughness:0.3, metalness:0.9 });
  const steel = new THREE.MeshStandardMaterial({ color:0x9a9ea3, roughness:0.38, metalness:0.85 });
  const graphite = new THREE.MeshStandardMaterial({ color:0x2a2e35, roughness:0.55, metalness:0.6 });
  const rubber = new THREE.MeshStandardMaterial({ color:0x17191c, roughness:0.75, metalness:0.1 });
  const enamel = new THREE.MeshStandardMaterial({ color:0x123f5a, map:grime, roughness:0.32, metalness:0.2, envMapIntensity:0.45 });
  const visorMat = new THREE.MeshStandardMaterial({ color:0x0b0e13, roughness:0.12, metalness:0.4, envMapIntensity:1.2 });
  const wireCopper = new THREE.MeshStandardMaterial({ color:0xa8622c, roughness:0.4, metalness:0.7 });
  const wireRed = new THREE.MeshStandardMaterial({ color:0x7d2a22, roughness:0.6, metalness:0.1 });
  const glowMat = new THREE.MeshStandardMaterial({ color:0x000000, emissive:new THREE.Color(IDLE_COLOR), emissiveIntensity:1.3, roughness:1, metalness:0, envMapIntensity:0 });
  const eyeMat = new THREE.MeshStandardMaterial({ color:0x000000, emissive:new THREE.Color(IDLE_COLOR), emissiveIntensity:1.15, roughness:1, metalness:0, envMapIntensity:0 });
  const mouthMat = new THREE.MeshStandardMaterial({ color:0x1a1d22, emissive:new THREE.Color(IDLE_COLOR), emissiveIntensity:0.15, roughness:0.6, envMapIntensity:0.2 });
  const ledRed = new THREE.MeshStandardMaterial({ color:0x000000, emissive:new THREE.Color(0xff3b30), emissiveIntensity:1.1 });
  const lensMat = new THREE.MeshStandardMaterial({ color:0x9fd4ff, roughness:0.05, metalness:0.2, transparent:true, opacity:0.35 });
  // Les couleurs sont données en sRGB : conversion en linéaire pour un rendu fidèle aux teintes choisies.
  [ivory, olive, ochre, copper, steel, graphite, rubber, enamel, visorMat, wireCopper, wireRed, mouthMat, lensMat].forEach(m => m.color.convertSRGBToLinear());
  [glowMat, eyeMat, mouthMat, ledRed].forEach(m => m.emissive.convertSRGBToLinear());

  // Plaque gravée de courbes de niveau (lignes seules, posées sur la céramique)
  function contourTexture(){
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d");
    for(let k = 1; k <= 12; k++){
      g.beginPath();
      for(let a = 0; a <= Math.PI*2 + 0.001; a += 0.04){
        const n = Math.sin(a*3 + k*0.7)*6 + Math.sin(a*5 - k)*4 + Math.cos(a*2 + k*1.3)*9;
        const r = k*21 + n*(0.4 + k/8);
        const x = 272 + Math.cos(a)*r*1.15, y = 250 + Math.sin(a)*r*0.95;
        if(a === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
      g.strokeStyle = k % 5 === 0 ? "rgba(150,82,38,.85)" : "rgba(160,95,50,.5)";
      g.lineWidth = k % 5 === 0 ? 4 : 2.2;
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return t;
  }
  const plateMat = new THREE.MeshStandardMaterial({ map:contourTexture(), transparent:true, depthWrite:false, roughness:0.4, metalness:0.05, envMapIntensity:0.7 });

  // Outils de construction
  const avatar = new THREE.Group(); scene.add(avatar);
  const rig = new THREE.Group(); avatar.add(rig);
  const mesh = (geo, mat, parent, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m; };
  function roundedRect(w, h, r){
    r = Math.min(r, w/2, h/2);
    const s = new THREE.Shape(), x = -w/2, y = -h/2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  // Plaque arrondie : largeur (x), hauteur (y), épaisseur (z), rayon des coins, biseau ; taper resserre le bas
  function slab(w, h, d, r, mat, parent, x, y, z, taper){
    const b = Math.min(0.012, d/3);
    const geo = new THREE.ExtrudeGeometry(roundedRect(w - 2*b, h - 2*b, Math.max(0.002, r - b)), { depth:Math.max(0.001, d - 2*b), bevelEnabled:true, bevelThickness:b, bevelSize:b, bevelSegments:2, curveSegments:12 });
    geo.translate(0, 0, -(d - 2*b)/2);
    if(taper){
      const p = geo.attributes.position;
      for(let i = 0; i < p.count; i++){ const k = (p.getY(i) + h/2)/h; p.setX(i, p.getX(i)*(taper + (1 - taper)*k)); }
      geo.computeVertexNormals();
    }
    return mesh(geo, mat, parent, x, y, z);
  }
  const disc = (r, h, mat, parent, x, y, z, axis) => { const m = mesh(new THREE.CylinderGeometry(r, r, h, 28), mat, parent, x, y, z); if(axis === "x") m.rotation.z = Math.PI/2; if(axis === "z") m.rotation.x = Math.PI/2; return m; };
  function cable(points, r, mat, parent){
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    return mesh(new THREE.TubeGeometry(curve, 24, r, 6, false), mat, parent);
  }
  const bolt = (parent, x, y, z) => mesh(new THREE.SphereGeometry(0.009, 8, 6), steel, parent, x, y, z);

  // Bassin : ceinture de céramique, insert vert carte, ouïes
  slab(0.36, 0.1, 0.22, 0.05, ivory, rig, 0, 1.1, 0);
  slab(0.1, 0.055, 0.012, 0.012, olive, rig, 0.1, 1.1, 0.113);
  for(let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.07, 0.008, 0.01), graphite, rig, -0.1, 1.125 - i*0.022, 0.112);
  mesh(new THREE.BoxGeometry(0.3, 0.1, 0.15), graphite, rig, 0, 1.03, 0);

  // Jambes : longues plaques en stade avec insert vert carte, mécanique apparente sur le côté
  function makeLeg(side){
    const hip = new THREE.Group(); hip.position.set(0.14*side, 1.02, 0); rig.add(hip);
    disc(0.07, 0.12, graphite, hip, 0, 0, 0, "x");
    disc(0.05, 0.02, copper, hip, 0.07*side, 0, 0, "x");
    slab(0.15, 0.56, 0.075, 0.075, ivory, hip, 0, -0.2, 0.03);
    disc(0.04, 0.02, steel, hip, 0, 0.005, 0.075, "z");
    disc(0.018, 0.024, graphite, hip, 0, 0.005, 0.077, "z");
    mesh(new THREE.TorusGeometry(0.043, 0.005, 8, 24), graphite, hip, 0, 0.005, 0.085);
    slab(0.07, 0.3, 0.012, 0.03, olive, hip, 0, -0.235, 0.072);
    for(const dx of [-0.018, 0.018]) mesh(new THREE.BoxGeometry(0.004, 0.26, 0.004), graphite, hip, dx, -0.225, 0.08);
    const half = mesh(new THREE.CircleGeometry(0.035, 20, Math.PI, Math.PI), ochre, hip, 0, -0.385, 0.079);
    half.scale.x = 1;
    slab(0.09, 0.4, 0.06, 0.02, graphite, hip, -0.02*side, -0.22, -0.035);
    disc(0.011, 0.34, steel, hip, 0.055*side, -0.22, -0.02);
    cable([[0.06*side, -0.02, -0.02], [0.1*side, -0.2, 0.0], [0.07*side, -0.42, -0.02]], 0.009, rubber, hip);
    cable([[0.05*side, -0.04, -0.05], [0.085*side, -0.25, -0.05], [0.05*side, -0.44, -0.04]], 0.006, wireCopper, hip);
    const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
    disc(0.058, 0.13, graphite, knee, 0, 0, 0, "x");
    disc(0.042, 0.02, copper, knee, 0.068*side, 0, 0, "x");
    disc(0.035, 0.015, steel, knee, 0, 0, 0.06, "z");
    slab(0.135, 0.5, 0.07, 0.065, ivory, knee, 0, -0.23, 0.028);
    slab(0.06, 0.13, 0.012, 0.02, olive, knee, 0, -0.38, 0.067);
    for(let i = 0; i < 2; i++) mesh(new THREE.BoxGeometry(0.1, 0.004, 0.004), graphite, knee, 0, -0.08 - i*0.02, 0.066);
    slab(0.05, 0.36, 0.05, 0.015, graphite, knee, 0.045*side, -0.22, -0.035);
    slab(0.05, 0.04, 0.03, 0.006, steel, knee, 0.05*side, -0.3, 0.0);
    cable([[0.06*side, -0.05, -0.03], [0.095*side, -0.2, 0.01], [0.085*side, -0.3, 0.0]], 0.008, rubber, knee);
    cable([[0.04*side, -0.3, 0.0], [0.07*side, -0.37, 0.03], [0.04*side, -0.44, 0.0]], 0.007, rubber, knee);
    const ankle = new THREE.Group(); ankle.position.y = -0.46; knee.add(ankle);
    mesh(new THREE.SphereGeometry(0.042, 16, 12), graphite, ankle);
    slab(0.12, 0.07, 0.25, 0.03, ivory, ankle, 0, -0.05, 0.045);
    slab(0.124, 0.018, 0.254, 0.03, copper, ankle, 0, -0.087, 0.045);
    slab(0.08, 0.03, 0.012, 0.01, olive, ankle, 0, -0.045, 0.172);
    return { hip, knee, ankle };
  }
  const legL = makeLeg(-1), legR = makeLeg(1);

  // Buste (pivot à la taille) : colonne vertébrale et câbles apparents, cage blindée
  const torso = new THREE.Group(); torso.position.y = 1.2; rig.add(torso);
  for(let i = 0; i < 5; i++) disc(0.055 - i*0.002, 0.028, graphite, torso, 0, -0.04 + i*0.055, -0.03);
  disc(0.018, 0.3, steel, torso, 0, 0.07, -0.03);
  const wires = [
    [rubber, 0.012, [[-0.1, -0.08, 0.02], [-0.16, 0.08, 0.08], [-0.1, 0.27, 0.04]]],
    [rubber, 0.011, [[0.09, -0.08, 0.03], [0.15, 0.1, 0.09], [0.12, 0.27, 0.05]]],
    [wireCopper, 0.007, [[-0.04, -0.08, 0.05], [-0.07, 0.1, 0.11], [-0.03, 0.27, 0.06]]],
    [wireRed, 0.007, [[0.03, -0.08, 0.05], [0.07, 0.08, 0.12], [0.05, 0.27, 0.07]]],
    [rubber, 0.01, [[-0.13, -0.07, -0.06], [-0.18, 0.1, -0.03], [-0.14, 0.27, -0.06]]],
    [rubber, 0.01, [[0.12, -0.07, -0.06], [0.18, 0.12, -0.04], [0.13, 0.27, -0.06]]],
    [wireCopper, 0.006, [[0.0, -0.08, 0.07], [0.02, 0.06, 0.14], [-0.01, 0.27, 0.08]]]
  ];
  for(const [mat, r, pts] of wires) cable(pts, r, mat, torso);
  slab(0.54, 0.56, 0.3, 0.1, ivory, torso, 0, 0.54, 0, 0.72);
  slab(0.44, 0.06, 0.26, 0.03, graphite, torso, 0, 0.83, -0.005);
  slab(0.46, 0.13, 0.05, 0.04, ivory, torso, 0, 0.745, 0.13);
  for(const x of [-0.2, 0.2]) bolt(torso, x, 0.745, 0.157);
  mesh(new THREE.BoxGeometry(0.3, 0.004, 0.004), graphite, torso, 0, 0.705, 0.156);
  for(const x of [-0.07, 0.07]) mesh(new THREE.BoxGeometry(0.004, 0.36, 0.004), graphite, torso, x*1.7, 0.56, 0.152);
  mesh(new THREE.BoxGeometry(0.34, 0.004, 0.004), graphite, torso, 0, 0.36, 0.148);
  // plaque cartographique gravée et rose des vents
  slab(0.2, 0.22, 0.02, 0.03, ivory, torso, -0.1, 0.6, 0.155);
  mesh(new THREE.PlaneGeometry(0.19, 0.21), plateMat, torso, -0.1, 0.6, 0.166);
  const emblem = new THREE.Group(); emblem.position.set(-0.1, 0.6, 0.168); torso.add(emblem);
  mesh(new THREE.TorusGeometry(0.036, 0.006, 8, 32), copper, emblem);
  const star = new THREE.Shape();
  for(let i = 0; i < 8; i++){ const a = i*Math.PI/4 + Math.PI/2, r = i % 2 ? 0.009 : 0.032; const x = Math.cos(a)*r, y = Math.sin(a)*r; if(i) star.lineTo(x, y); else star.moveTo(x, y); }
  mesh(new THREE.ShapeGeometry(star), glowMat, emblem, 0, 0, 0.003);
  for(const [x, y] of [[-0.19, 0.7], [-0.01, 0.7], [-0.19, 0.5], [-0.01, 0.5]]) bolt(torso, x, y, 0.166);
  // écran d'état et ouïes, côté droit
  slab(0.13, 0.11, 0.04, 0.015, graphite, torso, 0.12, 0.52, 0.15);
  const screenMat = new THREE.MeshStandardMaterial({ color:0x000000, emissive:eyeMat.emissive, emissiveIntensity:0.9, emissiveMap:(function(){
    const c = document.createElement("canvas"); c.width = 128; c.height = 100; const g = c.getContext("2d");
    g.fillStyle = "#1a1a1a"; g.fillRect(0, 0, 128, 100);
    g.strokeStyle = "#ffffff"; g.lineWidth = 1.4;
    for(let k = 1; k <= 5; k++){ g.beginPath(); g.ellipse(70, 52, k*11 + (k%2)*3, k*8, 0.3, 0, Math.PI*2); g.globalAlpha = 0.35 + k*0.1; g.stroke(); }
    g.globalAlpha = 0.25; for(let y = 0; y < 100; y += 3){ g.fillStyle = "#ffffff"; g.fillRect(0, y, 128, 1); }
    g.globalAlpha = 1; g.fillStyle = "#ffffff"; g.fillRect(66, 48, 8, 8);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })() });
  mesh(new THREE.PlaneGeometry(0.1, 0.078), screenMat, torso, 0.12, 0.52, 0.171);
  for(let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.1, 0.009, 0.012), graphite, torso, 0.12, 0.71 - i*0.022, 0.152);
  disc(0.018, 0.012, steel, torso, 0.06, 0.4, 0.15, "z");
  mesh(new THREE.BoxGeometry(0.014, 0.01, 0.006), ledRed, torso, 0.1, 0.4, 0.152);

  // Cou : faisceau de câbles et deux tiges d'acier, comme une nuque à cœur ouvert
  const neck = [
    [rubber, 0.013, [[-0.05, 0.84, 0.0], [-0.07, 0.98, 0.03], [-0.04, 1.08, 0.01]]],
    [rubber, 0.013, [[0.05, 0.84, 0.0], [0.07, 0.97, 0.02], [0.04, 1.08, 0.0]]],
    [rubber, 0.011, [[0.0, 0.84, -0.06], [0.02, 0.96, -0.08], [0.0, 1.08, -0.04]]],
    [wireCopper, 0.006, [[-0.02, 0.84, 0.05], [-0.04, 0.96, 0.08], [-0.02, 1.08, 0.04]]],
    [wireRed, 0.006, [[0.03, 0.84, 0.05], [0.05, 0.95, 0.07], [0.02, 1.08, 0.04]]]
  ];
  for(const [mat, r, pts] of neck) cable(pts, r, mat, torso);
  for(const x of [-0.025, 0.025]) disc(0.009, 0.26, steel, torso, x, 0.96, -0.01);

  // Tête en soucoupe : dôme de céramique, visière sombre, yeux en barres lumineuses, monocle de visée, prisme
  const head = new THREE.Group(); head.position.y = 1.14; torso.add(head);
  disc(0.1, 0.05, graphite, head, 0, -0.07, 0);
  for(let i = 0; i < 10; i++){ const a = i/10*Math.PI*2; mesh(new THREE.BoxGeometry(0.012, 0.03, 0.02), steel, head, Math.sin(a)*0.085, -0.1, Math.cos(a)*0.085).rotation.y = a; }
  const prof = [[0.001,0.16],[0.08,0.155],[0.16,0.132],[0.22,0.098],[0.255,0.06],[0.27,0.025],[0.272,-0.025],[0.255,-0.05],[0.2,-0.065],[0.001,-0.07]].reverse().map(([r,y]) => new THREE.Vector2(r, y));
  const ivoryClean = ivory.clone(); ivoryClean.map = null; ivoryClean.roughness = 0.42;
  const dome = mesh(new THREE.LatheGeometry(prof, 64), ivoryClean, head);
  dome.scale.set(1, 1, 0.94);
  const band = mesh(new THREE.LatheGeometry([[0.25,0.072],[0.233,0.09]].map(([r,y]) => new THREE.Vector2(r + 0.002, y)), 64), graphite, head);
  band.scale.z = 0.94;
  const visor = mesh(new THREE.CylinderGeometry(0.2765, 0.2765, 0.05, 64, 1, true, -1.9, 3.8), visorMat, head, 0, 0.0, 0);
  visor.scale.z = 0.94;
  mesh(new THREE.TorusGeometry(0.264, 0.004, 6, 64), graphite, head, 0, 0.046, 0).rotation.x = Math.PI/2;
  for(let i = 0; i < 9; i++){ const a = -1.6 + i*0.4; bolt(head, Math.sin(a)*0.262, -0.04, Math.cos(a)*0.262*0.94); }
  function makeEye(side){
    const x = 0.075*side, a = Math.asin(x/0.2765);
    const bar = mesh(new THREE.BoxGeometry(0.085, 0.022, 0.008), eyeMat, head, x, 0.007, Math.cos(a)*0.2765*0.94 + 0.002);
    bar.rotation.y = a;
    return { bar, side };
  }
  const eyeL = makeEye(-1), eyeR = makeEye(1);
  const mouthBars = [];
  for(let i = 0; i < 2; i++){ const b = mesh(new THREE.BoxGeometry(0.06 - i*0.03, 0.005, 0.006), mouthMat, head, 0, -0.012 - i*0.008, 0.2765*0.94 + 0.002); mouthBars.push(b); }
  // monocle : lentille sur le bord avant droit du dôme, qui sort pour examiner
  const mount = new THREE.Group(); const ma = 0.62; mount.position.set(Math.sin(ma)*0.262, 0.012, Math.cos(ma)*0.262*0.94); mount.rotation.y = ma; head.add(mount);
  disc(0.042, 0.02, graphite, mount, 0, 0, 0, "z");
  const monocle = new THREE.Group(); mount.add(monocle);
  disc(0.034, 0.045, copper, monocle, 0, 0, 0.02, "z");
  mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 28), copper, monocle, 0, 0, 0.043);
  mesh(new THREE.CircleGeometry(0.03, 24), eyeMat, monocle, 0, 0, 0.035).scale.setScalar(0.45);
  mesh(new THREE.CircleGeometry(0.031, 24), lensMat, monocle, 0, 0, 0.044);
  // prisme de géomètre sur une petite tourelle, légèrement décentré
  disc(0.028, 0.05, steel, head, -0.07, 0.17, -0.04);
  disc(0.034, 0.012, graphite, head, -0.07, 0.15, -0.04);
  const prism = mesh(new THREE.OctahedronGeometry(0.032), glowMat, head, -0.07, 0.225, -0.04);
  const prismLight = new THREE.PointLight(IDLE_COLOR, 0.5, 2.2); prismLight.position.copy(prism.position); head.add(prismLight);


  // Bras : blindage à panneaux, manchon ventilé au coude, avant-bras long, main articulée
  function makeArm(side, foreMat){
    const sh = new THREE.Group(); sh.position.set(0.37*side, 0.72, 0); torso.add(sh);
    mesh(new THREE.SphereGeometry(0.06, 20, 14), graphite, sh);
    // épaulière blindée avec disque d'articulation
    slab(0.16, 0.17, 0.24, 0.07, ivory, sh, 0.01*side, 0.01, 0);
    disc(0.058, 0.02, graphite, sh, 0.09*side, 0.0, 0, "x");
    mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 28), copper, sh, 0.1*side, 0.0, 0).rotation.y = Math.PI/2;
    for(let i = 0; i < 2; i++) slab(0.05, 0.016, 0.012, 0.005, graphite, sh, 0.01*side, 0.05 - i*0.028, 0.121);
    slab(0.12, 0.3, 0.12, 0.045, ivory, sh, 0, -0.21, 0);
    slab(0.06, 0.15, 0.016, 0.008, steel, sh, 0.061*side, -0.16, 0).rotation.y = Math.PI/2;
    for(let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.004, 0.12, 0.004), graphite, sh, 0.07*side, -0.16, -0.02 + i*0.02);
    bolt(sh, 0.062*side, -0.07, 0.045); bolt(sh, 0.062*side, -0.25, 0.045);
    disc(0.05, 0.07, steel, sh, 0, -0.37, 0);
    for(let i = 0; i < 3; i++) mesh(new THREE.TorusGeometry(0.051, 0.006, 6, 24), graphite, sh, 0, -0.35 - i*0.02, 0).rotation.x = Math.PI/2;
    cable([[0.04*side, -0.05, -0.05], [0.08*side, -0.22, -0.06], [0.03*side, -0.4, -0.04]], 0.007, rubber, sh);
    const el = new THREE.Group(); el.position.y = -0.42; sh.add(el);
    mesh(new THREE.SphereGeometry(0.048, 18, 12), graphite, el);
    slab(0.1, 0.31, 0.095, 0.035, foreMat, el, 0, -0.19, 0);
    mesh(new THREE.BoxGeometry(0.018, 0.012, 0.01), ledRed, el, 0.02*side, -0.13, 0.049);
    disc(0.012, 0.01, steel, el, 0.02*side, -0.17, 0.049, "z");
    if(foreMat === enamel) for(const y of [-0.06, -0.32]) mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 24), copper, el, 0, y, 0).rotation.x = Math.PI/2;
    else slab(0.04, 0.12, 0.01, 0.01, olive, el, 0, -0.24, 0.049);
    const wr = new THREE.Group(); wr.position.y = -0.36; el.add(wr);
    mesh(new THREE.TorusGeometry(0.04, 0.009, 8, 24), copper, wr).rotation.x = Math.PI/2;
    slab(0.035, 0.085, 0.07, 0.012, graphite, wr, 0, -0.05, 0);
    const fingers = [];
    for(let i = 0; i < 3; i++){
      const f = new THREE.Group(); f.position.set(0, -0.095, 0.025 - i*0.025); wr.add(f);
      mesh(new THREE.BoxGeometry(0.017, 0.038, 0.017), steel, f, 0, -0.019, 0);
      mesh(new THREE.SphereGeometry(0.01, 8, 6), copper, f, 0, -0.04, 0);
      const tip = new THREE.Group(); tip.position.y = -0.04; f.add(tip);
      mesh(new THREE.BoxGeometry(0.015, 0.03, 0.015), steel, tip, 0, -0.015, 0);
      f.userData.tip = tip; fingers.push(f);
    }
    const thumb = new THREE.Group(); thumb.position.set(-0.01*side, -0.045, 0.045); wr.add(thumb);
    mesh(new THREE.BoxGeometry(0.016, 0.045, 0.016), steel, thumb, 0, -0.02, 0);
    thumb.rotation.x = 0.7;
    return { sh, el, wr, fingers, side };
  }
  const armL = makeArm(-1, enamel), armR = makeArm(1, ivory);

  // Ombre au sol
  const sc = document.createElement("canvas"); sc.width = sc.height = 128;
  const sg = sc.getContext("2d"); const grd = sg.createRadialGradient(64,64,0,64,64,64);
  grd.addColorStop(0,"rgba(10,20,40,.5)"); grd.addColorStop(1,"rgba(10,20,40,0)");
  sg.fillStyle = grd; sg.fillRect(0,0,128,128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(sc), transparent:true, depthWrite:false }));
  shadow.rotation.x = -Math.PI/2; shadow.position.y = 0.005; avatar.add(shadow);

  // Confettis
  const confetti = [];
  const confGeo = new THREE.BoxGeometry(0.045, 0.045, 0.01);
  function burst(colors){
    for(let i = 0; i < 60; i++){
      const m = new THREE.Mesh(confGeo, new THREE.MeshBasicMaterial({ color:colors[i % colors.length], transparent:true }));
      m.position.set(0, 2.6, 0);
      const a = Math.random()*Math.PI*2, s = 1.2 + Math.random()*2.2;
      m.userData = { v:new THREE.Vector3(Math.cos(a)*s*0.7, 3 + Math.random()*2.5, Math.sin(a)*s*0.5), r:new THREE.Vector3(Math.random()*8, Math.random()*8, Math.random()*8), life:0 };
      scene.add(m); confetti.push(m);
    }
  }

  // Cadrage
  let wide = true;
  function resize(){
    const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    wide = camera.aspect > 1.15;
    const dist = camera.aspect < 0.8 ? 9.6 : 7.4;
    const off = wide ? 1.0 : 0;
    camera.position.set(off, 1.7, dist);
    camera.lookAt(off, 1.38, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // Poses
  const REST = {
    rigX:0, rigY:0, rigRotY:0, rigRotZ:0, crouch:0,
    torsoX:0.02, torsoY:0, torsoZ:0, headX:0, headY:0, headZ:0,
    lShX:-0.05, lShZ:-0.12, lElX:-0.55, lElZ:0, rShX:-0.05, rShZ:0.12, rElX:-0.55, rElZ:0,
    lCurl:0.35, rCurl:0.35, rIndex:0, lAnkle:0, rAnkle:0,
    browL:0, browR:0, liftL:0, liftR:0, aperture:1, monocle:0, mouth:0
  };
  const to = (P, k, v, w) => { P[k] += (v - P[k]) * w; };
  const akimbo = (P, side, w) => {
    if(side < 0){ to(P,"lShX",0.1,w); to(P,"lShZ",-0.62,w); to(P,"lElX",-0.1,w); to(P,"lElZ",1.75,w); }
    else { to(P,"rShX",0.1,w); to(P,"rShZ",0.62,w); to(P,"rElX",-0.1,w); to(P,"rElZ",-1.75,w); }
  };
  const ACTIONS = {
    wave:{ dur:2.8, f(P, p, t, e){
      to(P,"rShX",-0.15,e); to(P,"rShZ",1.2,e); to(P,"rElZ",1.55 + 0.38*Math.sin(t*9),e); to(P,"rElX",-0.15,e); to(P,"rCurl",0,e);
      to(P,"headZ",-0.12,e); to(P,"torsoZ",0.04,e); to(P,"browL",-0.12,e); to(P,"browR",-0.12,e); to(P,"mouth",0.35,e);
    }},
    jump:{ dur:2.4, f(P, p, t, e){
      const q = Math.min(1, Math.max(0, (p - 0.08)/0.84)), s = Math.sin(q*Math.PI*4);
      P.rigY += Math.max(0, s)*0.3*e; P.crouch += Math.max(0, -s)*0.55*e;
      to(P,"lShZ",-2.45,e); to(P,"rShZ",2.45,e); to(P,"lElX",-0.25,e); to(P,"rElX",-0.25,e); to(P,"lCurl",0,e); to(P,"rCurl",0,e);
      to(P,"headX",-0.28,e); to(P,"browL",-0.3,e); to(P,"browR",-0.3,e); to(P,"aperture",1.18,e); to(P,"mouth",0.8,e);
      P.rigRotY += 0.25*Math.sin(t*5)*e;
    }},
    fret:{ dur:2.6, f(P, p, t, e){
      const j = Math.sin(t*26)*0.07;
      to(P,"lShX",-0.55,e); to(P,"lShZ",-0.5,e); to(P,"lElX",-1.75 + j,e); to(P,"lElZ",0.55,e);
      to(P,"rShX",-0.55,e); to(P,"rShZ",0.5,e); to(P,"rElX",-1.75 - j,e); to(P,"rElZ",-0.55,e);
      to(P,"lCurl",0,e); to(P,"rCurl",0,e);
      P.headY += Math.sin(t*6.5)*0.5*e; to(P,"torsoX",-0.1,e); P.rigX += Math.sin(t*38)*0.01*e;
      to(P,"browL",-0.45,e); to(P,"browR",-0.45,e); to(P,"liftL",0.012,e); to(P,"liftR",0.012,e); to(P,"aperture",1.3,e); to(P,"mouth",0.6,e);
    }},
    lean:{ dur:3.2, f(P, p, t, e){
      to(P,"torsoX",0.26,e); to(P,"headX",0.08,e); to(P,"headZ",0.1,e); to(P,"monocle",1,e);
      to(P,"rShX",-0.75,e); to(P,"rShZ",0.08,e); to(P,"rElX",-2.05,e); to(P,"rElZ",-0.55,e); to(P,"rCurl",0.9,e);
      to(P,"lShX",0.3,e); to(P,"lElX",-0.35,e);
      to(P,"browR",0.25,e); to(P,"browL",-0.2,e); to(P,"liftL",0.016,e);
    }},
    no:{ dur:2.4, f(P, p, t, e){
      P.headY += Math.sin(t*9)*0.3*e*(1 - p*0.5);
      to(P,"rShX",-0.95,e); to(P,"rShZ",0.18,e); to(P,"rElX",-1.95,e); to(P,"rElZ",-0.15 + 0.28*Math.sin(t*11),e);
      to(P,"rCurl",1.2,e); to(P,"rIndex",1,e);
      akimbo(P, -1, e); to(P,"torsoX",-0.05,e);
      to(P,"browL",0.35,e); to(P,"browR",0.35,e); to(P,"aperture",0.85,e); to(P,"mouth",0.5,e);
    }},
    poke:{ dur:1.1, f(P, p, t, e){
      const k = p < 0.25 ? Math.sin(p/0.25*Math.PI/2) : 1;
      P.rigY += Math.sin(Math.min(1, p/0.3)*Math.PI)*0.07;
      to(P,"lShZ",-0.4,e*k); to(P,"rShZ",0.4,e*k); to(P,"lElX",-1.1,e*k); to(P,"rElX",-1.1,e*k); to(P,"lCurl",0,e); to(P,"rCurl",0,e);
      to(P,"torsoX",-0.08,e); to(P,"headX",-0.08,e); to(P,"aperture",1.4,e); to(P,"browL",-0.3,e); to(P,"browR",-0.3,e);
    }},
    bow:{ dur:2.8, f(P, p, t, e){
      to(P,"torsoX",0.38,e); to(P,"headX",0.12,e);
      to(P,"rShX",-0.35,e); to(P,"rShZ",-0.1,e); to(P,"rElX",-1.55,e); to(P,"rElZ",-0.95,e); to(P,"rCurl",0.1,e);
      to(P,"lShX",0.35,e); to(P,"lElX",-0.3,e);
    }},
    look:{ dur:3.2, f(P, p, t, e){ P.headY += Math.sin(p*Math.PI*2)*0.75*e; to(P,"headX",-0.06,e); } },
    inspect:{ dur:3.6, f(P, p, t, e){
      to(P,"lShX",-0.55,e); to(P,"lShZ",-0.1,e); to(P,"lElX",-1.55,e); to(P,"lElZ",0.55,e);
      to(P,"rShX",-0.6,e); to(P,"rShZ",0.05,e); to(P,"rElX",-1.5,e); to(P,"rElZ",-0.85 + 0.18*Math.sin(t*10),e); to(P,"rCurl",0,e);
      to(P,"headY",-0.4,e); to(P,"headX",0.28,e); to(P,"browL",0.1,e); to(P,"liftR",0.014,e);
    }},
    tap:{ dur:3.2, f(P, p, t, e){
      akimbo(P, -1, e); akimbo(P, 1, e);
      to(P,"rAnkle",-0.32*Math.max(0, Math.sin(t*11)),e); to(P,"headZ",0.08,e); to(P,"headX",-0.05,e);
      to(P,"browL",0.18,e); to(P,"browR",0.18,e);
    }},
    stretch:{ dur:3.4, f(P, p, t, e){
      P.headZ += Math.sin(p*Math.PI*2)*0.28*e; P.headX += (Math.cos(p*Math.PI*2) - 1)*0.12*e;
      to(P,"lShZ",-0.28,e); to(P,"rShZ",0.28,e); to(P,"aperture",0.55,e);
    }}
  };

  // Animation
  const clock = new THREE.Clock();
  let act = null, talking = false, sulk = 0, sulkTarget = 0, vLevel = 0, vTarget = 0, vSeen = -1;
  const look = { x:0, y:0, tx:0, ty:0 };
  window.addEventListener("pointermove", e => { look.tx = (e.clientX / window.innerWidth - 0.5) * 2; look.ty = (e.clientY / window.innerHeight - 0.5) * 2; });
  let nextBlink = 2, blinkT = -1;
  const col = new THREE.Color(IDLE_COLOR).convertSRGBToLinear(), colTarget = col.clone();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frameCbs = [];
  const smooth = x => x*x*(3-2*x);
  const envelope = p => p < 0.14 ? smooth(p/0.14) : p > 0.8 ? smooth((1-p)/0.2) : 1;

  function frame(){
    const t = clock.getElapsedTime();
    const m = reduce ? 0.25 : 1;
    const P = Object.assign({}, REST);

    // Respiration mécanique, regard qui suit le pointeur
    P.torsoX += 0.018*Math.sin(t*1.4)*m; P.rigRotZ += 0.012*Math.sin(t*0.7)*m;
    P.lElX += 0.05*Math.sin(t*1.4 + 1)*m; P.rElX += 0.05*Math.sin(t*1.4 + 1.3)*m;
    look.x += (look.tx - look.x) * 0.06; look.y += (look.ty - look.y) * 0.06;
    P.headY += look.x*0.42; P.headX += look.y*0.16;

    vLevel += (vTarget - vLevel) * 0.45;
    if(talking){
      // Bouche pilotée par le niveau réel de la voix quand il arrive, sinon par un babillage simulé
      const live = t - vSeen < 0.3;
      P.mouth = Math.max(P.mouth, live ? 0.08 + 0.95*vLevel : 0.35 + 0.65*Math.abs(Math.sin(t*13.7)*Math.sin(t*5.3)));
      P.headX += 0.035*Math.sin(t*6)*m; P.headZ += 0.03*Math.sin(t*2.1)*m;
      if(!act){ P.rElX += (-0.35 + 0.22*Math.sin(t*2.3))*m; P.rElZ += 0.18*Math.sin(t*1.7)*m; P.rCurl = 0.1; }
    }

    sulk += (sulkTarget - sulk) * 0.05;
    if(sulk > 0.001){
      const w = sulk;
      to(P,"rigRotY",-0.95,w); to(P,"headY",-0.35,w); to(P,"headX",-0.16,w);
      akimbo(P, -1, w); akimbo(P, 1, w);
      to(P,"browL",0.3,w); to(P,"browR",0.3,w); to(P,"aperture",0.6,w);
    }

    if(act){
      const p = (t - act.t0) / act.dur;
      if(p >= 1) act = null;
      else ACTIONS[act.name].f(P, p, t, envelope(p));
    }

    if(t > nextBlink){ blinkT = t; nextBlink = t + 2.8 + Math.random()*4; }
    const blink = blinkT >= 0 && t - blinkT < 0.16 ? Math.abs(Math.cos((t - blinkT)/0.16*Math.PI))*0.9 + 0.1 : 1;

    // Application de la pose
    const c = P.crouch;
    rig.position.set(P.rigX, P.rigY - 0.089*c, 0);
    rig.rotation.set(0, P.rigRotY, P.rigRotZ);
    torso.rotation.set(P.torsoX + 0.2*c, P.torsoY, P.torsoZ);
    head.rotation.set(P.headX, P.headY, P.headZ);
    armL.sh.rotation.set(P.lShX, 0, P.lShZ); armL.el.rotation.set(P.lElX, 0, P.lElZ);
    armR.sh.rotation.set(P.rShX, 0, P.rShZ); armR.el.rotation.set(P.rElX, 0, P.rElZ);
    armL.fingers.forEach(f => { f.rotation.z = P.lCurl; f.userData.tip.rotation.z = P.lCurl*0.9; });
    armR.fingers.forEach((f, i) => { const k = i === 0 ? -P.rCurl*(1 - P.rIndex) : -P.rCurl; f.rotation.z = k; f.userData.tip.rotation.z = k*0.9; });
    for(const [leg, a] of [[legL, P.lAnkle], [legR, P.rAnkle]]){
      leg.hip.rotation.x = -0.45*c; leg.knee.rotation.x = 0.9*c; leg.ankle.rotation.x = -0.45*c + a;
    }
    // Yeux en barres lumineuses : inclinaison pour la colère ou l'inquiétude, hauteur pour l'ouverture
    for(const [eye, b, lift] of [[eyeL, P.browL, P.liftL], [eyeR, P.browR, P.liftR]]){
      const a = P.aperture;
      eye.bar.rotation.z = -b*eye.side*0.8;
      eye.bar.position.y = 0.007 + lift*1.1 - 0.005*Math.max(0, b);
      eye.bar.scale.set(1 + 0.12*(1 - a), Math.max(0.12, a*blink), 1);
    }
    monocle.position.z = P.monocle*0.045;
    mouthMat.emissiveIntensity = 0.12 + 2.2*P.mouth;
    mouthBars.forEach((b, i) => { b.scale.x = 0.6 + 0.4*Math.min(1, P.mouth*(1.3 - i*0.25) + 0.3); });

    col.lerp(colTarget, 0.06);
    glowMat.emissive.copy(col); eyeMat.emissive.copy(col); mouthMat.emissive.copy(col); prismLight.color.copy(col);
    const pulse = act && act.name === "lean" ? 0.65 + 0.35*Math.sin(t*12) : 0.88 + 0.12*Math.sin(t*2.2);
    glowMat.emissiveIntensity = 1.25 * pulse;
    prism.rotation.y = t*0.8;

    const hgt = rig.position.y;
    shadow.scale.setScalar(Math.max(0.5, 1 - hgt*0.6));
    shadow.material.opacity = Math.max(0.3, 1 - hgt*0.8);

    for(let i = confetti.length-1; i >= 0; i--){
      const cf = confetti[i], u = cf.userData; u.life += 1/60;
      u.v.y -= 7.5/60; cf.position.addScaledVector(u.v, 1/60);
      cf.rotation.x += u.r.x/60; cf.rotation.y += u.r.y/60;
      cf.material.opacity = Math.max(0, 1 - u.life/2.4);
      if(u.life > 2.4){ scene.remove(cf); cf.material.dispose(); confetti.splice(i,1); }
    }

    renderer.render(scene, camera);
    for(const cb of frameCbs) cb(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const v3 = new THREE.Vector3();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  return {
    play(name){
      if(!ACTIONS[name]) return;
      act = { name, t0:clock.getElapsedTime(), dur:ACTIONS[name].dur };
      if(name === "jump") burst([0x4fe0a0,0xc8814a,0x3fb0ff,0xffd166,0xeee6d6]);
    },
    busy(){ return !!act; },
    setMood(color){ colTarget.set(color == null ? IDLE_COLOR : color).convertSRGBToLinear(); },
    setTalking(on){ talking = !!on; },
    setVoiceLevel(v){ vTarget = v; if(v > 0.02) vSeen = clock.getElapsedTime(); },
    setSulk(on){ sulkTarget = on ? 1 : 0; },
    hit(clientX, clientY){
      const r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left)/r.width)*2 - 1, -((clientY - r.top)/r.height)*2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObject(rig, true).length > 0;
    },
    toScreen(x, y){ v3.set(x, y, 0).project(camera); return { x:(v3.x*0.5+0.5)*stage.clientWidth, y:(-v3.y*0.5+0.5)*stage.clientHeight }; },
    rigY(){ return rig.position.y; },
    isWide(){ return wide; },
    onFrame(cb){ frameCbs.push(cb); },
    resize
  };
};
})();
