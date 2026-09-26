/* Manuvers : l'avatar 3D de LB-93, dit Lambert (Three.js r128, chargé localement depuis vendor/).
   Droïde de protocole et de cartographie, entièrement procédural, dans l'esprit des droïdes
   usés et bricolés : plaques de céramique ivoire patinée à inserts vert carte, cuivre, acier,
   mécanique graphite et câbles apparents (taille, cou, jambes), tête en soucoupe à visière et yeux
   en barres lumineuses, monocle de visée sur le bord du dôme, prisme de géomètre, avant-bras gauche
   bleu dépareillé (pièce de rechange), plaque gravée de courbes de niveau et rose des vents.
   Expose window.createAvatar(canvas, stage) qui renvoie une petite API :
   play(action), busy(), setMood(couleur|null), setTalking(bool), setVoiceLevel(0..1), setSulk(bool), hit(x, y),
   toScreen(x, y), rigY(), isWide(), onFrame(cb), resize().
   Actions : wave, jump, fret, lean, no, poke, bow, look, inspect, tap, stretch.
   Activités de fond (setActivity) : tablet, book, muse, polish, oil, stretch, sleep ; tabletShow(bool) retourne l'écran vers vous. */
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

  // Accessoires de la vie quotidienne : tablette, livre, burette, chiffon
  const props = {};
  let seedP = 11; const rndP = () => (seedP = (seedP*16807) % 2147483647) / 2147483647;
  // Fil d'actualité de la tablette : cartes, articles, graphiques, photos (dessiné une fois, défile en boucle)
  function feedTexture(){
    const c = document.createElement("canvas"); c.width = 256; c.height = 2048;
    const g = c.getContext("2d");
    g.fillStyle = "#0f141b"; g.fillRect(0, 0, 256, 2048);
    const box = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const accents = ["#ff9a2e", "#3fb0ff", "#4fe0a0", "#b39cff", "#ffd166"];
    let y = 10, n = 0;
    while(y < 2030){
      const type = n++ % 5, h = [150, 96, 124, 138, 84][type];
      if(y + h > 2040) break;
      g.fillStyle = "#1a212b"; box(8, y, 240, h, 12); g.fill();
      g.fillStyle = accents[n % accents.length]; g.beginPath(); g.arc(26, y + 18, 8, 0, Math.PI*2); g.fill();
      g.fillStyle = "#c9d2de"; g.fillRect(40, y + 12, 70 + rndP()*60, 6);
      g.fillStyle = "#5d6878"; g.fillRect(40, y + 22, 40 + rndP()*40, 4);
      const top = y + 36, ih = h - 46;
      if(type === 0){
        g.fillStyle = "#1d3326"; box(16, top, 224, ih, 8); g.fill();
        g.strokeStyle = "#e39a52"; g.lineWidth = 1.5;
        const cx = 60 + rndP()*140, cy = top + ih/2;
        for(let k = 1; k <= 6; k++){ g.globalAlpha = 0.35 + k*0.1; g.beginPath(); g.ellipse(cx, cy, k*16, k*9, rndP(), 0, Math.PI*2); g.stroke(); }
        g.globalAlpha = 1; g.fillStyle = "#ff5a3c"; g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI*2); g.fill();
      } else if(type === 1 || type === 4){
        g.fillStyle = "#8793a4";
        for(let l = 0; l < (type === 1 ? 5 : 3); l++) g.fillRect(16, top + l*12, 150 + rndP()*70, 5);
      } else if(type === 2){
        for(let b = 0; b < 9; b++){ const bh = 12 + rndP()*(ih - 16); g.fillStyle = accents[b % 3 === 0 ? 1 : 0]; g.fillRect(20 + b*24, top + ih - bh, 14, bh); }
      } else {
        const gr = g.createLinearGradient(0, top, 0, top + ih); gr.addColorStop(0, "#41688c"); gr.addColorStop(1, "#e7b07a");
        g.fillStyle = gr; box(16, top, 224, ih, 8); g.fill();
        g.fillStyle = "#2c3b33"; g.beginPath(); g.moveTo(16, top + ih); g.lineTo(80, top + ih*0.45); g.lineTo(130, top + ih*0.7); g.lineTo(190, top + ih*0.3); g.lineTo(240, top + ih); g.closePath(); g.fill();
      }
      y += h + 10;
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 0.19); t.anisotropy = 4;
    return t;
  }
  (function tablet(){
    const g = new THREE.Group(); torso.add(g);
    slab(0.2, 0.28, 0.014, 0.022, graphite, g, 0, 0, 0);
    const tex = feedTexture();
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.184, 0.262), new THREE.MeshBasicMaterial({ map:tex, color:0xd8dde4, toneMapped:false }));
    screen.position.z = 0.0075; g.add(screen);
    const back = new THREE.Group(); back.position.z = -0.008; back.rotation.y = Math.PI; g.add(back);
    mesh(new THREE.TorusGeometry(0.03, 0.004, 8, 28), copper, back, 0, 0.03, 0);
    const s = new THREE.Shape();
    for(let i = 0; i < 8; i++){ const a = i*Math.PI/4 + Math.PI/2, r = i % 2 ? 0.007 : 0.024; if(i) s.lineTo(Math.cos(a)*r, Math.sin(a)*r); else s.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
    mesh(new THREE.ShapeGeometry(s), copper, back, 0, 0.03, 0.001);
    const light = new THREE.PointLight(0x9fd0ff, 0, 0.9); light.position.set(0, 0, 0.18); g.add(light);
    props.tablet = { g, tex, light, scroll:0.2, vel:0 };
  })();
  (function book(){
    const g = new THREE.Group(); torso.add(g);
    const cover = new THREE.MeshStandardMaterial({ color:new THREE.Color(0x6b2a22).convertSRGBToLinear(), map:grime, roughness:0.65 });
    const paper = new THREE.MeshStandardMaterial({ color:new THREE.Color(0xf0e7d4).convertSRGBToLinear(), roughness:0.9, side:THREE.DoubleSide });
    for(const side of [-1, 1]){
      const half = new THREE.Group(); half.rotation.y = -side*0.3; g.add(half);
      mesh(new THREE.BoxGeometry(0.13, 0.19, 0.006), cover, half, side*0.066, 0, -0.004);
      mesh(new THREE.BoxGeometry(0.12, 0.18, 0.016), paper, half, side*0.062, 0, 0.008);
      for(let l = 0; l < 7; l++) mesh(new THREE.BoxGeometry(0.08 + (l % 3)*0.01, 0.004, 0.001), graphite, half, side*0.062, 0.06 - l*0.018, 0.017).material = graphite;
    }
    mesh(new THREE.BoxGeometry(0.014, 0.19, 0.02), cover, g, 0, 0, -0.008);
    const leaf = new THREE.Group(); leaf.position.z = 0.017; g.add(leaf);
    mesh(new THREE.PlaneGeometry(0.115, 0.175), paper, leaf, 0.06, 0, 0);
    props.book = { g, leaf };
  })();
  (function oilcan(){
    const g = new THREE.Group(); armR.wr.add(g);
    const brass = new THREE.MeshStandardMaterial({ color:new THREE.Color(0xc9a24a).convertSRGBToLinear(), roughness:0.35, metalness:0.85 });
    mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.07, 20), brass, g, 0, -0.12, 0.02);
    const spout = mesh(new THREE.CylinderGeometry(0.003, 0.007, 0.1, 8), brass, g, 0, -0.1, 0.08);
    spout.rotation.x = 1.1;
    mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 16, Math.PI), brass, g, 0, -0.1, -0.02).rotation.y = Math.PI/2;
    props.oil = { g };
  })();
  (function cloth(){
    const g = new THREE.Group(); armR.wr.add(g);
    const fabric = new THREE.MeshStandardMaterial({ color:new THREE.Color(0xb5452e).convertSRGBToLinear(), roughness:0.95 });
    const c = mesh(new THREE.BoxGeometry(0.05, 0.035, 0.08), fabric, g, 0, -0.1, 0.01);
    c.rotation.z = 0.3;
    props.cloth = { g };
  })();

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
    browL:0, browR:0, liftL:0, liftR:0, aperture:1, monocle:0, mouth:0, glow:1
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


  /* Activités de fond : ce que Lambert fait de ses journées quand personne ne lui demande rien.
     f(P, t, w, s, dt) : w est le poids de l'activité (0 à 1), s son état propre (minuteries). */
  const hold = (P, w, lz, ex) => {   // deux mains qui tiennent un objet devant la poitrine
    to(P,"lShX",-0.35,w); to(P,"lShZ",-0.04,w); to(P,"lElX",-ex,w); to(P,"lElZ",lz,w); to(P,"lCurl",0.6,w);
    to(P,"rShX",-0.35,w); to(P,"rShZ",0.04,w); to(P,"rElX",-ex,w); to(P,"rElZ",-lz,w); to(P,"rCurl",0.6,w);
  };
  const place = (obj, a, b, k) => {  // interpole la position et l'orientation d'un accessoire entre deux poses
    obj.position.set(a[0] + (b[0] - a[0])*k, a[1] + (b[1] - a[1])*k, a[2] + (b[2] - a[2])*k);
    obj.rotation.set(a[3] + (b[3] - a[3])*k, a[4] + (b[4] - a[4])*k, a[5] + (b[5] - a[5])*k);
  };
  const ACTIVITIES = {
    tablet:{ props:["tablet"], f(P, t, w, s, dt){
      const pr = props.tablet;
      s.sw = (s.sw || 0) + ((showTarget ? 1 : 0) - (s.sw || 0)) * Math.min(1, dt*3);
      const sw = smooth(Math.min(1, Math.max(0, s.sw)));
      // un glissement de doigt toutes les quelques secondes, puis l'inertie du défilement
      if(!s.nextSwipe) s.nextSwipe = t + 1.5;
      if(t > s.nextSwipe && sw < 0.1){ s.swipeT = t; s.nextSwipe = t + 1.8 + Math.random()*4.5; pr.vel += 0.05 + Math.random()*0.07; }
      pr.vel *= Math.exp(-dt*2.6); pr.scroll += pr.vel*dt;
      pr.tex.offset.y = 1 - pr.tex.repeat.y - (pr.scroll % 1);
      pr.light.intensity = 0.55*w*(1 - sw);
      hold(P, w, 0.72, 1.8);
      const sp = s.swipeT ? (t - s.swipeT)/0.5 : 1;
      if(sp < 1){ P.rElX += -0.22*Math.sin(sp*Math.PI)*w; P.rElZ += 0.1*Math.sin(sp*Math.PI)*w; }
      to(P,"rIndex",1,w); to(P,"rCurl",1.1,w);
      to(P,"headX",0.46,w); P.headY += 0.06*Math.sin(t*0.6)*w; to(P,"aperture",0.82,w);
      P.rigRotY += -0.1*w; to(P,"headZ",0.06,w);
      // rire silencieux de temps en temps
      if(!s.nextLaugh) s.nextLaugh = t + 18 + Math.random()*30;
      if(t > s.nextLaugh){ s.laughT = t; s.nextLaugh = t + 25 + Math.random()*45; }
      const lp = s.laughT ? (t - s.laughT)/1.4 : 1;
      if(lp < 1){ const k = Math.sin(lp*Math.PI)*w; P.headY += Math.sin(t*22)*0.05*k; P.torsoX += Math.abs(Math.sin(t*18))*0.03*k; to(P,"aperture",0.45,k); to(P,"mouth",0.7,k); }
      // montrer l'écran : bras tendus, tablette retournée vers vous
      to(P,"lShX",-0.6,w*sw); to(P,"rShX",-0.6,w*sw); to(P,"lElX",-1.75,w*sw); to(P,"rElX",-1.75,w*sw);
      to(P,"lElZ",0.62,w*sw); to(P,"rElZ",-0.62,w*sw); to(P,"rIndex",0,w*sw);
      to(P,"headX",-0.02,w*sw); to(P,"aperture",1.1,w*sw); to(P,"browL",-0.2,w*sw); to(P,"browR",-0.2,w*sw);
      place(pr.g, [0, 0.53, 0.42, -1.91, 0, Math.PI], [0, 0.6, 0.5, -0.1, 0, 0], sw);
    }},
    book:{ props:["book"], f(P, t, w, s){
      hold(P, w, 0.68, 1.75);
      to(P,"headX",0.44,w); to(P,"aperture",0.8,w); P.headY += 0.12*Math.sin(t*0.9)*w;
      P.headZ += 0.03*Math.sin(t*0.5)*w;
      const pr = props.book;
      if(!s.nextPage) s.nextPage = t + 5;
      if(t > s.nextPage){ s.pageT = t; s.nextPage = t + 7 + Math.random()*7; }
      const pp = s.pageT ? (t - s.pageT)/1.1 : 1;
      pr.leaf.visible = pp < 1; pr.leaf.rotation.y = -Math.PI*smooth(Math.min(1, Math.max(0, pp)))*0.94 + 0.3;
      if(pp < 1){ P.rElZ += -0.25*Math.sin(pp*Math.PI)*w; P.headY += -0.1*Math.sin(pp*Math.PI)*w; }
      place(pr.g, [0, 0.52, 0.42, -1.95, 0, Math.PI], [0, 0.52, 0.42, -1.95, 0, Math.PI], 0);
    }},
    muse:{ props:[], f(P, t, w){
      to(P,"rShX",-0.78,w); to(P,"rShZ",0.1,w); to(P,"rElX",-2.05,w); to(P,"rElZ",-0.58,w); to(P,"rCurl",0.9,w);
      to(P,"lShX",-0.2,w); to(P,"lShZ",-0.1,w); to(P,"lElX",-1.3,w); to(P,"lElZ",1.0,w);
      to(P,"headX",-0.24,w); to(P,"headY",0.4 + 0.08*Math.sin(t*0.3),w); to(P,"headZ",-0.1,w);
      to(P,"aperture",0.78,w); to(P,"browL",-0.12,w); to(P,"liftR",0.01,w);
      P.rigRotZ += 0.015*Math.sin(t*0.4)*w; P.rigRotY += 0.12*w;
    }},
    polish:{ props:["cloth"], f(P, t, w){
      to(P,"lShX",-0.55,w); to(P,"lShZ",-0.1,w); to(P,"lElX",-1.55,w); to(P,"lElZ",0.55,w);
      to(P,"rShX",-0.6,w); to(P,"rShZ",0.05,w); to(P,"rElX",-1.5,w); to(P,"rElZ",-0.85 + 0.2*Math.sin(t*7),w); to(P,"rCurl",0.8,w);
      to(P,"headY",-0.42,w); to(P,"headX",0.3,w); to(P,"browR",0.12,w); to(P,"aperture",0.85,w);
      P.torsoY += 0.04*Math.sin(t*7)*w;
    }},
    oil:{ props:["oil"], f(P, t, w){
      // avant-bras gauche levé, la burette dans la main droite : une goutte au coude, une pression à la fois
      const squeeze = Math.max(0, Math.sin(t*2.2));
      to(P,"lShX",-0.6,w); to(P,"lShZ",-0.12,w); to(P,"lElX",-1.5,w); to(P,"lElZ",0.6,w); to(P,"lCurl",0.7,w);
      to(P,"rShX",-0.5,w); to(P,"rShZ",0.02,w); to(P,"rElX",-1.3,w); to(P,"rElZ",-0.95 + 0.06*squeeze,w); to(P,"rCurl",0.9 + 0.3*squeeze,w);
      to(P,"headX",0.34,w); to(P,"headY",-0.3,w); to(P,"headZ",0.08,w); to(P,"aperture",0.8,w); to(P,"browR",0.15,w);
    }},
    stretch:{ props:[], f(P, t, w, s){
      const c = ((t - s.t0) % 14)/14, ph = k => smooth(Math.min(1, Math.max(0, k)));
      const up = ph(c*6) * (1 - ph((c - 0.75)*6));
      to(P,"lShZ",-2.85,w*up); to(P,"rShZ",2.85,w*up); to(P,"lElZ",-0.3,w*up); to(P,"rElZ",0.3,w*up); to(P,"lCurl",0,w); to(P,"rCurl",0,w);
      to(P,"headX",-0.25,w*up); to(P,"aperture",0.4,w*up);
      P.torsoZ += 0.22*Math.sin(Math.min(1, Math.max(0, (c - 0.2)/0.3))*Math.PI*2)*w*up;
      P.torsoY += 0.35*Math.sin(Math.min(1, Math.max(0, (c - 0.5)/0.25))*Math.PI*2)*w;
      P.headZ += 0.25*Math.sin(Math.min(1, Math.max(0, (c - 0.8)/0.2))*Math.PI*2)*w;
      P.rigY += 0.02*up*w;
    }},
    sleep:{ props:[], f(P, t, w){
      to(P,"headX",0.55,w); to(P,"headZ",0.1,w); to(P,"torsoX",0.14 + 0.02*Math.sin(t*0.8),w); to(P,"crouch",0.12,w);
      to(P,"lShZ",-0.04,w); to(P,"rShZ",0.04,w); to(P,"lElX",-0.25,w); to(P,"rElX",-0.25,w); to(P,"lCurl",0.5,w); to(P,"rCurl",0.5,w);
      to(P,"aperture",0.14,w); to(P,"glow",0.35 + 0.1*Math.sin(t*0.8),w);
    }}
  };

  // Animation
  const clock = new THREE.Clock();
  let act = null, talking = false, sulk = 0, sulkTarget = 0, vLevel = 0, vTarget = 0, vSeen = -1;
  let cur = null, curW = 0, pending, ast = { t0:0 }, showTarget = false, lastT = 0;
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

    // Activité de fond, atténuée pendant une réaction ; les accessoires apparaissent avec elle
    const dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
    if(pending !== undefined && pending !== cur){
      curW = Math.max(0, curW - dt*1.8);
      if(curW === 0){ cur = pending; pending = undefined; ast = { t0:t }; showTarget = false; }
    } else { pending = undefined; if(cur) curW = Math.min(1, curW + dt*0.9); }
    const actDamp = act ? 1 - envelope(Math.min(1, (t - act.t0)/act.dur)) : 1;
    const aw = smooth(curW) * actDamp;
    if(cur && aw > 0.001) ACTIVITIES[cur].f(P, t, aw, ast, dt);
    const shown = cur ? ACTIVITIES[cur].props : [];
    for(const k in props){ const on = shown.includes(k) ? aw : 0; props[k].g.visible = on > 0.02; props[k].g.scale.setScalar(Math.max(0.001, smooth(Math.min(1, on*1.4)))); }
    if(!shown.includes("tablet")) props.tablet.light.intensity = 0;

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
    glowMat.emissiveIntensity = 1.25 * pulse * P.glow; eyeMat.emissiveIntensity = 1.15 * P.glow; prismLight.intensity = 0.5 * P.glow;
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
    setActivity(name){ pending = name && ACTIVITIES[name] ? name : null; },
    activity(){ return pending !== undefined ? pending : cur; },
    tabletShow(on){ showTarget = !!on; },
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
