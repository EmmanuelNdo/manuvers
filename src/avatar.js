/* Manuvers : l'avatar 3D (Three.js r128, chargé localement depuis vendor/).
   Expose window.createAvatar(canvas, stage) qui renvoie une petite API :
   play(action), setMood(couleur|null), toScreen(x, y), rigY(), isWide(), onFrame(cb).
   Actions : wave, jump, shake, lean, stretch, look. */
(function(){
"use strict";

window.createAvatar = function(canvas, stage){
  const IDLE_COLOR = 0x7fe3d6;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xe4ecff, 0x303848, 0.95));
  const key = new THREE.DirectionalLight(0xfff1e0, 1.0); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fc2ff, 0.7); rim.position.set(-4, 3, -3); scene.add(rim);

  const avatar = new THREE.Group(); scene.add(avatar);
  const rig = new THREE.Group(); avatar.add(rig);

  const shell = new THREE.MeshStandardMaterial({ color:0xf1f3f6, roughness:0.32, metalness:0.05 });
  const accent = new THREE.MeshStandardMaterial({ color:0xff7c4f, roughness:0.45, metalness:0.1 });
  const screenMat = new THREE.MeshStandardMaterial({ color:0x162131, roughness:0.18, metalness:0.2 });
  const glowMat = new THREE.MeshStandardMaterial({ color:0x111111, emissive:new THREE.Color(IDLE_COLOR), emissiveIntensity:1.6, roughness:0.3 });
  const eyeMat = new THREE.MeshBasicMaterial({ color:0xc8fbff });

  // Corps
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 48, 32), shell);
  body.scale.set(1, 0.95, 0.9); body.position.y = 0.8; rig.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.028, 12, 40), glowMat);
  ring.position.set(0, 0.86, 0.535); rig.add(ring);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.575, 0.035, 12, 64), accent);
  belt.rotation.x = Math.PI/2; belt.scale.set(1, 0.9, 1); belt.position.y = 0.62; rig.add(belt);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.12, 32), accent);
  jet.position.y = 0.26; rig.add(jet);

  // Tête
  const head = new THREE.Group(); head.position.y = 1.72; rig.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.6, 48, 32), shell);
  skull.scale.set(1.15, 0.9, 0.95); head.add(skull);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.606, 48, 32, Math.PI/2 - 0.95, 1.9, Math.PI/2 - 0.62, 1.24), screenMat);
  face.scale.copy(skull.scale); head.add(face);
  const eyeGeo = new THREE.SphereGeometry(0.075, 24, 16);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat), eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.2, 0.05, 0.56); eyeR.position.set(0.2, 0.05, 0.56);
  head.add(eyeL, eyeR);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.017, 8, 24, Math.PI), eyeMat);
  mouth.position.set(0, -0.13, 0.566); head.add(mouth);
  const earGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 32);
  const earL = new THREE.Mesh(earGeo, accent), earR = new THREE.Mesh(earGeo, accent);
  earL.rotation.z = earR.rotation.z = Math.PI/2; earL.position.x = -0.69; earR.position.x = 0.69; head.add(earL, earR);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 12), shell);
  stalk.position.y = 0.62; head.add(stalk);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), glowMat);
  bulb.position.y = 0.8; head.add(bulb);
  const bulbLight = new THREE.PointLight(IDLE_COLOR, 0.6, 2.5); bulbLight.position.y = 0.8; head.add(bulbLight);

  // Bras
  function makeArm(side){
    const pivot = new THREE.Group(); pivot.position.set(0.6*side, 1.0, 0);
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), shell);
    arm.scale.set(0.85, 1.8, 0.85); arm.position.y = -0.2; pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), accent);
    hand.position.y = -0.42; pivot.add(hand);
    rig.add(pivot); return pivot;
  }
  const armL = makeArm(-1), armR = makeArm(1);

  // Ombre au sol
  const sc = document.createElement("canvas"); sc.width = sc.height = 128;
  const sg = sc.getContext("2d"); const grd = sg.createRadialGradient(64,64,0,64,64,64);
  grd.addColorStop(0,"rgba(10,20,40,.45)"); grd.addColorStop(1,"rgba(10,20,40,0)");
  sg.fillStyle = grd; sg.fillRect(0,0,128,128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(sc), transparent:true, depthWrite:false }));
  shadow.rotation.x = -Math.PI/2; shadow.position.y = 0.005; avatar.add(shadow);

  // Confettis
  const confetti = [];
  const confGeo = new THREE.BoxGeometry(0.05, 0.05, 0.012);
  function burst(colors){
    for(let i = 0; i < 70; i++){
      const m = new THREE.Mesh(confGeo, new THREE.MeshBasicMaterial({ color:colors[i % colors.length], transparent:true }));
      m.position.set(0, 2.3, 0);
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
    const dist = camera.aspect < 0.8 ? 8.4 : 6.8;
    const off = wide ? 1.0 : 0;
    camera.position.set(off, 1.75, dist);
    camera.lookAt(off, 1.3, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // Animation
  const clock = new THREE.Clock();
  const DUR = { wave:2.6, jump:1.8, shake:2.0, lean:2.6, stretch:3.2, look:3.0 };
  let act = null;
  const look = { x:0, y:0, tx:0, ty:0 };
  window.addEventListener("pointermove", e => { look.tx = (e.clientX / window.innerWidth - 0.5) * 2; look.ty = (e.clientY / window.innerHeight - 0.5) * 2; });
  let nextBlink = 2, blinkT = -1;
  const col = new THREE.Color(IDLE_COLOR), colTarget = new THREE.Color(IDLE_COLOR);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frameCbs = [];
  const smooth = x => x*x*(3-2*x);
  const envelope = p => p < 0.12 ? smooth(p/0.12) : p > 0.82 ? smooth((1-p)/0.18) : 1;

  function frame(){
    const t = clock.getElapsedTime();
    const motion = reduce ? 0.25 : 1;

    rig.position.set(0, 0.08*Math.sin(t*1.7)*motion + 0.08, 0);
    rig.rotation.set(0, 0, 0.02*Math.sin(t*0.9)*motion);
    rig.scale.set(1,1,1);
    look.x += (look.tx - look.x) * 0.06; look.y += (look.ty - look.y) * 0.06;
    head.rotation.set(look.y*0.18, look.x*0.45, 0);
    let armLz = -0.28 - 0.05*Math.sin(t*1.7+1)*motion, armRz = 0.28 + 0.05*Math.sin(t*1.7+1)*motion;
    let eyeS = 1, eyeY = 1, happy = false, worried = false;

    if(t > nextBlink){ blinkT = t; nextBlink = t + 2.5 + Math.random()*3.5; }
    if(blinkT >= 0 && t - blinkT < 0.14) eyeY = 0.12;

    if(act){
      const p = (t - act.t0) / act.dur;
      if(p >= 1){ act = null; }
      else {
        const e = envelope(p);
        switch(act.name){
          case "wave":
            armLz += (-2.55 + 0.38*Math.sin(t*13) - armLz) * e;
            head.rotation.z += 0.14*e; rig.rotation.z -= 0.05*e; happy = e > 0.5;
            break;
          case "jump": {
            const air = p > 0.18 && p < 0.78 ? Math.sin((p-0.18)/0.6*Math.PI) : 0;
            const sq = p < 0.18 ? Math.sin(p/0.18*Math.PI)*0.16 : p > 0.78 ? Math.sin((p-0.78)/0.22*Math.PI)*0.12 : 0;
            rig.position.y += air * 1.05 * motion;
            rig.scale.set(1+sq*0.6, 1-sq, 1+sq*0.6);
            if(p > 0.18 && p < 0.78) rig.rotation.y = smooth((p-0.18)/0.6) * Math.PI*2 * motion;
            armLz += (-2.4 - armLz)*e; armRz += (2.4 - armRz)*e; happy = true;
            break; }
          case "shake":
            head.rotation.y += Math.sin(t*17)*0.32*e*(1-p*0.6)*motion;
            rig.scale.setScalar(1 - 0.04*e); rig.position.x = Math.sin(t*40)*0.012*e*motion;
            armLz += (-0.08 - armLz)*e; armRz += (0.08 - armRz)*e; worried = true;
            break;
          case "lean":
            rig.rotation.x = 0.22*e; rig.position.z = 0.3*e; head.rotation.x -= 0.12*e;
            armRz += (1.35 - armRz)*e; eyeS = 1 + 0.35*e;
            break;
          case "stretch":
            armLz += (-2.9 - armLz)*e; armRz += (2.9 - armRz)*e;
            head.rotation.x -= 0.28*e; rig.scale.y = 1 + 0.06*e; if(eyeY > 0.3) eyeY = 1 - 0.7*e;
            break;
          case "look":
            head.rotation.y += Math.sin(p*Math.PI*2)*0.7*e;
            break;
        }
      }
    }

    armL.rotation.z = armLz; armR.rotation.z = armRz;
    const ey = happy ? Math.min(eyeY, 0.45) : worried ? Math.min(eyeY, 0.7) : eyeY;
    eyeL.scale.set(eyeS, 1.35*ey*eyeS, 0.5); eyeR.scale.set(eyeS, 1.35*ey*eyeS, 0.5);
    eyeL.rotation.z = worried ? -0.35 : 0; eyeR.rotation.z = worried ? 0.35 : 0;
    mouth.rotation.z = worried ? 0 : Math.PI;
    mouth.position.y = worried ? -0.19 : -0.13;
    mouth.scale.setScalar(happy ? 1.35 : worried ? 0.8 : 1);

    col.lerp(colTarget, 0.06);
    glowMat.emissive.copy(col); bulbLight.color.copy(col);
    const pulse = act && act.name === "lean" ? 0.6 + 0.4*Math.sin(t*12) : 0.85 + 0.15*Math.sin(t*2.2);
    glowMat.emissiveIntensity = 1.6 * pulse;

    const hgt = rig.position.y;
    shadow.scale.setScalar(Math.max(0.35, 1 - hgt*0.45));
    shadow.material.opacity = Math.max(0.25, 1 - hgt*0.5);

    for(let i = confetti.length-1; i >= 0; i--){
      const m = confetti[i], u = m.userData; u.life += 1/60;
      u.v.y -= 7.5/60; m.position.addScaledVector(u.v, 1/60);
      m.rotation.x += u.r.x/60; m.rotation.y += u.r.y/60;
      m.material.opacity = Math.max(0, 1 - u.life/2.4);
      if(u.life > 2.4){ scene.remove(m); m.material.dispose(); confetti.splice(i,1); }
    }

    renderer.render(scene, camera);
    for(const cb of frameCbs) cb(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const v3 = new THREE.Vector3();
  return {
    play(name){
      if(!DUR[name]) return;
      act = { name, t0:clock.getElapsedTime(), dur:DUR[name] };
      if(name === "jump") burst([0x4fe0a0,0xff7c4f,0x3fb0ff,0xffd166,0xa98bff]);
    },
    busy(){ return !!act; },
    setMood(color){ colTarget.set(color == null ? IDLE_COLOR : color); },
    toScreen(x, y){ v3.set(x, y, 0).project(camera); return { x:(v3.x*0.5+0.5)*stage.clientWidth, y:(-v3.y*0.5+0.5)*stage.clientHeight }; },
    rigY(){ return rig.position.y; },
    isWide(){ return wide; },
    onFrame(cb){ frameCbs.push(cb); },
    resize
  };
};
})();
