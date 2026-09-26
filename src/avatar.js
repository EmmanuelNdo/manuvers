/* Manuvers : l'avatar 3D de LB-93, dit Lambert (Three.js r128, chargé localement depuis vendor/).
   Droïde de protocole et de cartographie, entièrement procédural : céramique ivoire, cuivre,
   mécanique graphite, avant-bras gauche dépareillé (pièce de rechange), plastron gravé de courbes de niveau,
   monocle de visée sur l'œil droit, prisme de géomètre sur le crâne.
   Expose window.createAvatar(canvas, stage) qui renvoie une petite API :
   play(action), busy(), setMood(couleur|null), setTalking(bool), setSulk(bool), hit(x, y),
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

  // Matières
  const ivory = new THREE.MeshStandardMaterial({ color:0xe4d9c6, roughness:0.32, metalness:0.05, envMapIntensity:0.7 });
  const copper = new THREE.MeshStandardMaterial({ color:0xb86a32, roughness:0.26, metalness:0.9 });
  const graphite = new THREE.MeshStandardMaterial({ color:0x2a2e35, roughness:0.55, metalness:0.6 });
  const enamel = new THREE.MeshStandardMaterial({ color:0x123f5a, roughness:0.3, metalness:0.2, envMapIntensity:0.45 });
  const glowMat = new THREE.MeshStandardMaterial({ color:0x000000, emissive:new THREE.Color(IDLE_COLOR), emissiveIntensity:1.3, roughness:1, metalness:0, envMapIntensity:0 });
  const eyeMat = new THREE.MeshStandardMaterial({ color:0x000000, emissive:new THREE.Color(IDLE_COLOR), emissiveIntensity:1.05, roughness:1, metalness:0, envMapIntensity:0 });
  const mouthMat = new THREE.MeshStandardMaterial({ color:0x1a1d22, emissive:new THREE.Color(IDLE_COLOR), emissiveIntensity:0.15, roughness:0.6, envMapIntensity:0.2 });
  const lensMat = new THREE.MeshStandardMaterial({ color:0x9fd4ff, roughness:0.05, metalness:0.2, transparent:true, opacity:0.35 });

  // Les couleurs sont données en sRGB : conversion en linéaire pour un rendu fidèle aux teintes choisies.
  [ivory, copper, graphite, enamel, mouthMat, lensMat].forEach(m => m.color.convertSRGBToLinear());
  [glowMat, eyeMat, mouthMat].forEach(m => m.emissive.convertSRGBToLinear());

  // Plastron gravé de courbes de niveau
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
      g.strokeStyle = k % 5 === 0 ? "rgba(150,82,38,.8)" : "rgba(160,95,50,.42)";
      g.lineWidth = k % 5 === 0 ? 3.2 : 1.6;
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return t;
  }
  const plateMat = new THREE.MeshStandardMaterial({ map:contourTexture(), transparent:true, depthWrite:false, roughness:0.3, metalness:0.05, envMapIntensity:0.7 });

  const avatar = new THREE.Group(); scene.add(avatar);
  const rig = new THREE.Group(); avatar.add(rig);
  const mesh = (geo, mat, parent, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m; };

  // Bassin et jambes
  const pelvis = mesh(new THREE.SphereGeometry(0.24, 32, 20), ivory, rig, 0, 1.06, 0);
  pelvis.scale.set(1.1, 0.62, 0.8);
  mesh(new THREE.TorusGeometry(0.235, 0.018, 10, 48), copper, rig, 0, 1.1, 0).rotation.x = Math.PI/2;
  function makeLeg(side){
    const hip = new THREE.Group(); hip.position.set(0.15*side, 1.0, 0); rig.add(hip);
    mesh(new THREE.SphereGeometry(0.075, 20, 14), graphite, hip);
    mesh(new THREE.CylinderGeometry(0.092, 0.07, 0.4, 24), ivory, hip, 0, -0.23, 0);
    const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
    mesh(new THREE.SphereGeometry(0.07, 20, 14), copper, knee);
    mesh(new THREE.CylinderGeometry(0.072, 0.056, 0.38, 24), ivory, knee, 0, -0.22, 0);
    const ankle = new THREE.Group(); ankle.position.y = -0.44; knee.add(ankle);
    mesh(new THREE.SphereGeometry(0.048, 16, 12), graphite, ankle);
    const foot = mesh(new THREE.BoxGeometry(0.13, 0.07, 0.25), ivory, ankle, 0, -0.05, 0.045);
    mesh(new THREE.BoxGeometry(0.135, 0.02, 0.255), copper, foot, 0, -0.035, 0);
    return { hip, knee, ankle };
  }
  const legL = makeLeg(-1), legR = makeLeg(1);

  // Buste (pivot à la taille)
  const torso = new THREE.Group(); torso.position.y = 1.2; rig.add(torso);
  mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.26, 24), graphite, torso, 0, 0.02, 0);
  for(let i = 0; i < 3; i++) mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 32), graphite, torso, 0, -0.06 + i*0.08, 0).rotation.x = Math.PI/2;
  for(let i = -1; i <= 1; i++) mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 8), copper, torso, i*0.05, 0.03, 0.165);
  // Cage thoracique en révolution, aplatie : épaules larges, taille fine
  const prof = [[0.16,0.02],[0.22,0.1],[0.285,0.26],[0.34,0.44],[0.378,0.62],[0.382,0.74],[0.31,0.86],[0.16,0.93],[0.001,0.95]].map(([r,y]) => new THREE.Vector2(r, y));
  const chest = mesh(new THREE.LatheGeometry(prof, 48), ivory, torso, 0, 0, 0);
  chest.scale.set(1.08, 1, 0.66);
  const plateProf = [[0.29,0.28],[0.33,0.4],[0.362,0.52],[0.382,0.64],[0.386,0.74],[0.33,0.84]].map(([r,y]) => new THREE.Vector2(r, y));
  const plate = mesh(new THREE.LatheGeometry(plateProf, 32, -0.85, 1.7), plateMat, torso, 0, 0, 0.004);
  plate.scale.copy(chest.scale);
  const emblem = new THREE.Group(); emblem.position.set(0, 0.6, 0.253); torso.add(emblem);
  mesh(new THREE.TorusGeometry(0.058, 0.009, 8, 40), copper, emblem);
  const star = new THREE.Shape();
  for(let i = 0; i < 8; i++){ const a = i*Math.PI/4 + Math.PI/2, r = i % 2 ? 0.014 : 0.05; const x = Math.cos(a)*r, y = Math.sin(a)*r; if(i) star.lineTo(x, y); else star.moveTo(x, y); }
  mesh(new THREE.ShapeGeometry(star), glowMat, emblem, 0, 0, 0.004);
  mesh(new THREE.TorusGeometry(0.17, 0.02, 10, 40), copper, torso, 0, 0.9, 0).rotation.x = Math.PI/2;

  // Cou et tête
  mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.2, 16), graphite, torso, 0, 0.98, 0);
  for(let i = 0; i < 2; i++) mesh(new THREE.TorusGeometry(0.066, 0.01, 8, 24), copper, torso, 0, 0.95 + i*0.06, 0).rotation.x = Math.PI/2;
  const head = new THREE.Group(); head.position.y = 1.15; head.scale.setScalar(1.12); torso.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.26, 48, 32), ivory, head, 0, 0.04, 0);
  skull.scale.set(1, 1.05, 1);
  const muzzle = mesh(new THREE.SphereGeometry(0.16, 32, 20), ivory, head, 0, -0.1, 0.1);
  muzzle.scale.set(1.15, 0.72, 0.85);
  mesh(new THREE.TorusGeometry(0.224, 0.009, 8, 64), copper, head, 0, 0.19, 0).rotation.x = Math.PI/2;
  const mouthBars = [];
  for(let i = 0; i < 3; i++){ const b = mesh(new THREE.BoxGeometry(0.11 - i*0.02, 0.011, 0.012), mouthMat, head, 0, -0.105 - i*0.024, 0.232 - i*0.004); mouthBars.push(b); }
  function makeEye(side){
    const g = new THREE.Group(); g.position.set(0.1*side, 0.035, 0.228); head.add(g);
    mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.03, 32), graphite, g).rotation.x = Math.PI/2;
    const iris = mesh(new THREE.SphereGeometry(0.036, 24, 16), eyeMat, g, 0, 0, 0.012);
    const ring = mesh(new THREE.TorusGeometry(0.052, 0.007, 8, 32), copper, g, 0, 0, 0.018);
    const brow = mesh(new THREE.BoxGeometry(0.11, 0.019, 0.03), graphite, head, 0.1*side, 0.118, 0.222);
    return { g, iris, ring, brow, side };
  }
  const eyeL = makeEye(-1), eyeR = makeEye(1);
  // Monocle de visée, sur l'œil droit (côté +x à l'écran)
  const monocle = new THREE.Group(); eyeR.g.add(monocle);
  const tube = mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.06, 32, 1, true), copper, monocle, 0, 0, 0.03);
  tube.rotation.x = Math.PI/2; tube.material = copper;
  mesh(new THREE.TorusGeometry(0.063, 0.01, 8, 32), copper, monocle, 0, 0, 0.06);
  mesh(new THREE.CircleGeometry(0.06, 32), lensMat, monocle, 0, 0, 0.058);
  function makeEar(side){
    const e = mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.05, 32), copper, head, 0.258*side, 0.02, 0);
    e.rotation.z = Math.PI/2;
    mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.02, 24), graphite, head, 0.288*side, 0.02, 0).rotation.z = Math.PI/2;
  }
  makeEar(-1); makeEar(1);
  const stalk = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.14, 8), copper, head, 0.07, 0.34, -0.03);
  stalk.rotation.z = -0.25;
  const prism = mesh(new THREE.OctahedronGeometry(0.038), glowMat, head, 0.088, 0.42, -0.03);
  const prismLight = new THREE.PointLight(IDLE_COLOR, 0.5, 2.2); prismLight.position.copy(prism.position); head.add(prismLight);

  // Bras
  function makeArm(side, foreMat){
    const sh = new THREE.Group(); sh.position.set(0.46*side, 0.72, 0); torso.add(sh);
    mesh(new THREE.SphereGeometry(0.092, 24, 16), copper, sh);
    mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.34, 20), ivory, sh, 0, -0.21, 0);
    mesh(new THREE.TorusGeometry(0.058, 0.01, 8, 24), copper, sh, 0, -0.07, 0).rotation.x = Math.PI/2;
    const el = new THREE.Group(); el.position.y = -0.42; sh.add(el);
    mesh(new THREE.SphereGeometry(0.056, 20, 14), graphite, el);
    mesh(new THREE.CylinderGeometry(0.052, 0.042, 0.3, 20), foreMat, el, 0, -0.19, 0);
    const wr = new THREE.Group(); wr.position.y = -0.37; el.add(wr);
    mesh(new THREE.SphereGeometry(0.036, 16, 12), graphite, wr);
    mesh(new THREE.BoxGeometry(0.032, 0.085, 0.075), graphite, wr, 0, -0.06, 0);
    const fingers = [];
    for(let i = 0; i < 3; i++){
      const f = new THREE.Group(); f.position.set(0, -0.1, 0.025 - i*0.025); wr.add(f);
      mesh(new THREE.BoxGeometry(0.018, 0.065, 0.018), copper, f, 0, -0.03, 0);
      fingers.push(f);
    }
    const thumb = new THREE.Group(); thumb.position.set(-0.012*side, -0.05, 0.045); wr.add(thumb);
    mesh(new THREE.BoxGeometry(0.016, 0.045, 0.016), copper, thumb, 0, -0.02, 0);
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
  let act = null, talking = false, sulk = 0, sulkTarget = 0;
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

    if(talking){
      P.mouth = Math.max(P.mouth, 0.35 + 0.65*Math.abs(Math.sin(t*13.7)*Math.sin(t*5.3)));
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
    armL.fingers.forEach(f => { f.rotation.z = P.lCurl; });
    armR.fingers.forEach((f, i) => { f.rotation.z = i === 0 ? -P.rCurl*(1 - P.rIndex) : -P.rCurl; });
    for(const [leg, a] of [[legL, P.lAnkle], [legR, P.rAnkle]]){
      leg.hip.rotation.x = -0.45*c; leg.knee.rotation.x = 0.9*c; leg.ankle.rotation.x = -0.45*c + a;
    }
    for(const [eye, b, lift] of [[eyeL, P.browL, P.liftL], [eyeR, P.browR, P.liftR]]){
      eye.brow.rotation.z = -b*eye.side;
      eye.brow.position.y = 0.118 - 0.012*Math.max(0, b) + lift;
      const a = P.aperture;
      eye.iris.scale.set(a, a*blink, 0.55);
      eye.ring.scale.setScalar(0.9 + 0.1*a);
    }
    monocle.position.z = P.monocle*0.05;
    monocle.visible = true;
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
