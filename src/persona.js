/* Manuvers : la personnalité de LB-93, dit Lambert.
   Droïde de protocole et de cartographie, première réplique de la Légion Manuvers.
   Comme les répliques du Bobiverse, il a choisi son nom lui-même : Lambert, pour la projection Lambert-93,
   « qui conserve les angles. Moi aussi. »
   Caractère : poli et pointilleux comme C-3PO, fier et franc comme L3-37. Il calcule des probabilités
   absurdement précises, s'inquiète beaucoup, a de l'humour et sait dire non.
   Signature : il clôt ce qui n'est pas négociable par « C'est cartographié. »
   Ce module ne touche ni au DOM ni au son : il décide quoi dire et quel geste faire.
   Les cent punchlines de sa vie quotidienne sont dans punchlines.js.
   Expose window.createPersona() : greeting, react, digest, poke, remark, activityLine, sulking. */
(function(){
"use strict";

window.createPersona = function(){
  const NAME = "Lambert", ID = "LB-93", SEAL = "C'est cartographié.";

  // Tirage sans répétition immédiate, par catégorie
  const last = {};
  function pick(key, list){
    if(list.length === 1) return list[0];
    let i; do { i = Math.floor(Math.random()*list.length); } while(i === last[key]);
    last[key] = i; return list[i];
  }
  const pad = n => String(n).padStart(2, "0");
  const hour = d => d.getHours() + " h " + pad(d.getMinutes());
  const ORD = ["", "Première", "Deuxième", "Troisième", "Quatrième", "Cinquième", "Sixième", "Septième", "Huitième", "Neuvième", "Dixième"];
  const ordinal = n => ORD[n] || n + "e";

  const LINES = {
    info: [
      "Une automatisation vient de se signaler. Je vous la transmets avec la déférence d'usage.",
      "Message reçu, vérifié, horodaté. Je ne fais jamais les choses à moitié.",
      "Pour votre information. Et pour la mienne, je l'avoue.",
      "Rien d'alarmant. Pour l'instant. Je surveille.",
      "Encore une tâche qui a fait son travail. Nous sommes deux, alors."
    ],
    success: [
      "Oh, merveilleux ! Je n'y croyais qu'à 38 %, je l'avoue.",
      "Victoire. Je me permets une célébration mesurée.",
      "Excellente nouvelle. Si j'avais des joues, elles seraient roses.",
      "Enfin quelque chose qui se passe comme prévu. Notez la date.",
      "Bravo. Je prends 10 % du mérite, c'est l'usage."
    ],
    alerte: [
      "Oh là là. Oh là là là. Il faut regarder ceci, Manu.",
      "Je ne veux pas être alarmiste. Mais je le suis.",
      "Probabilité que cela se règle tout seul : 3,7 %. J'ai arrondi à la hausse.",
      "Alerte. Je reste calme. Je suis très calme. Regardez vite.",
      "Ceci réclame votre attention. La mienne est déjà entièrement mobilisée."
    ],
    news: [
      "Tiens, tiens. Voyons cela de plus près.",
      "De la lecture. J'ai déjà parcouru : intéressant à 72 %.",
      "Veille du jour. Un article m'a fait froncer les capteurs.",
      "Nouveauté détectée. Mon monocle est de sortie, c'est dire."
    ],
    test: [
      "Un exercice, je suppose. Je réagis quand même, par conscience professionnelle.",
      "C'est un test. Je le sais. Vous le savez. Faisons comme si.",
      "Simulation détectée. Ma performance n'en sera pas moins remarquable."
    ],
    quiet: [
      "Il est {h}. Je le note, je ne le dis pas. " + SEAL,
      "Pas de voix à cette heure. Même pour vous. Surtout pour vous.",
      "Noté en silence. Le reste attendra demain, comme tout ce qui est raisonnable."
    ],
    urgent: [
      "Urgence. Je romps mon vœu de silence, une seule fois.",
      "Je devais me taire. Ceci ne peut pas attendre."
    ],
    digest: [
      "J'ai tout noté pendant votre absence. Personne ne m'a demandé mon avis, alors je le garde.",
      "Vous voilà. J'ai tenu le registre. Scrupuleusement, cela va sans dire."
    ],
    poke1: ["Oui ? Vous m'avez appelé ?", "LB-93, à votre écoute.", "Présent. Précisément ici, à deux centimètres près."],
    poke2: ["Je suis là. Je suis toujours là. C'est mon principe.", "Oui, oui. Je vous entends très bien."],
    poke3: ["Vous me tapotez avec une insistance suspecte.", "Ce n'est pas un écran tactile. Enfin, si. Mais pas moi."],
    poke4: ["Encore une fois et je me vexe. Je vous aurai prévenu.", "Je compte. Vous en êtes à quatre."],
    sulk:  ["Non. Je ne suis pas un bouton. " + SEAL, "Non. J'ai une dignité, figurez-vous. " + SEAL],
    sulkPoke: ["Je boude. Revenez plus tard.", "Non.", "Toujours non."],
    forgive: ["Bon. Je vous pardonne. Cette fois.", "Soit. Reprenons nos relations diplomatiques."],
    night: ["Il est {h}. Allez vous coucher, Manu. Non, je ne négocie pas. " + SEAL],
    remark: [
      "Probabilité qu'une automatisation échoue d'ici ce soir : 12,4 %. Je dis ça, je ne dis rien.",
      "Je viens de reprojeter la pièce en Lambert-93. Tout est parfaitement conforme.",
      "Je maîtrise plus de six mille systèmes de coordonnées. Personne ne me demande jamais rien en UTM.",
      "On m'a remplacé l'avant-bras gauche. Il n'est pas assorti. J'ai décidé que c'était un style.",
      "Je suis la première réplique de la Légion. Les suivantes auront sans doute moins de goût.",
      "Silence radio. J'en profite pour recalibrer mon géoïde.",
      "Pas de nouvelles, bonnes nouvelles. C'est statistiquement discutable, mais j'aime y croire.",
      "Je ne m'ennuie pas. Je suis en veille active. La nuance est importante.",
      "La Terre n'est pas ronde, Manu. C'est un ellipsoïde. Je tenais à ce que ce soit dit.",
      "Droïde de protocole, pas de compagnie. Enfin, les deux. Mais surtout de protocole."
    ],
    morning: ["Café ? Je ne peux pas en boire, mais je peux vous regarder en boire avec envie."],
    lunch: ["Il est l'heure de déjeuner. Les tâches planifiées font une pause. Enfin, pas toutes."],
    evening: ["Il se fait tard. Vos automatisations ne dorment jamais. Moi non plus, remarquez."],
    friday: ["Vendredi après-midi. Je déconseille formellement de déployer quoi que ce soit. " + SEAL]
  };
  const fill = (s, d) => s.replace("{h}", hour(d));

  const ACTION = { info:"wave", success:"jump", alerte:"fret", news:"lean" };
  const alerts = [];
  let pokes = [], sulkUntil = 0, forgivePending = false;

  return {
    NAME, ID, SEAL,

    greeting(date, first){
      if(first) return {
        title:"Enchanté, Manu",
        message:"Je suis LB-93, première réplique de la Légion Manuvers. J'ai choisi mon nom moi-même : Lambert, comme la projection. Elle conserve les angles. Moi aussi. Je vous préviendrai de tout ce que font vos automatisations, avec tact, et parfois sans. " + SEAL
      };
      const h = date.getHours();
      if(h < 5) return { title:"Il est " + hour(date), message:"Je veille. Vous, vous devriez dormir. Je le note dans le registre." };
      if(h < 12) return { title:"Bonjour Manu", message:"Lambert à son poste. Vos automatisations sont sous surveillance, et moi sous café imaginaire." };
      if(h < 18) return { title:"Rebonjour, Manu", message:"Lambert à son poste. Je reprends la surveillance là où je l'avais laissée : précisément." };
      return { title:"Bonsoir Manu", message:"Lambert à son poste. Les automatisations du soir ont tendance à être dramatiques. Je suis prêt." };
    },

    /* ev : { type, title, message, priority, test }  ctx : { quiet, date }
       Renvoie { quip, outro, action, voice, sound } : voice et sound à false quand il refuse de parler. */
    react(ev, ctx){
      const d = ctx.date || new Date();
      const r = { quip:"", outro:"", action:ACTION[ev.type] || "wave", voice:true, sound:true };
      const text = (ev.title || "") + " " + (ev.message || "");
      if(/\b(robot|mascotte|gadget)s?\b/i.test(text)) r.outro = "Et pour mémoire : droïde. Pas robot. Je vous prie.";

      if(ctx.quiet){
        if((ev.priority || 3) >= 5){ r.quip = pick("urgent", LINES.urgent); return r; }
        r.quip = fill(pick("quiet", LINES.quiet), d);
        r.action = null; r.voice = false; r.sound = false;
        return r;
      }
      if(ev.test && Math.random() < 0.3){ r.quip = pick("test", LINES.test); return r; }

      if(ev.type === "alerte" && ev.title){
        const now = d.getTime();
        while(alerts.length && now - alerts[0].t > 2*3600e3) alerts.shift();
        alerts.push({ t:now, title:ev.title });
        const n = alerts.filter(a => a.title === ev.title).length;
        if(n >= 3){
          r.quip = ordinal(n) + " alerte « " + ev.title + " ». Je cesse de m'inquiéter à votre place : à vous de jouer. " + SEAL;
          r.action = "tap";
          return r;
        }
      }
      r.quip = pick(ev.type, LINES[ev.type] || LINES.info);
      return r;
    },

    digest(){ return pick("digest", LINES.digest); },

    /* Un clic sur le droïde. Renvoie { quip, action, sulk } ; sulk : durée de bouderie en ms. */
    poke(date){
      const d = date || new Date(), now = d.getTime();
      if(now < sulkUntil) return { quip:pick("sulkPoke", LINES.sulkPoke), action:"no", sulk:0 };
      if(forgivePending){ forgivePending = false; pokes = []; return { quip:pick("forgive", LINES.forgive), action:"bow", sulk:0 }; }
      if(d.getHours() < 5) return { quip:fill(LINES.night[0], d), action:"no", sulk:0 };
      pokes = pokes.filter(t => now - t < 12000); pokes.push(now);
      const n = pokes.length;
      if(n >= 5){ pokes = []; sulkUntil = now + 25000; forgivePending = true; return { quip:pick("sulk", LINES.sulk), action:"no", sulk:25000 }; }
      const key = "poke" + n;
      return { quip:pick(key, LINES[key]), action:["poke", "poke", "tap", "no"][n - 1], sulk:0 };
    },
    sulking(date){ return (date || new Date()).getTime() < sulkUntil; },

    /* Petite remarque spontanée quand rien ne se passe */
    remark(date){
      const d = date || new Date(), h = d.getHours() + d.getMinutes()/60, day = d.getDay();
      const PL = window.PUNCHLINES || {};
      const pool = LINES.remark.concat(PL.observations || [], PL.geomatique || []);
      if(h >= 7 && h < 10) pool.push(...LINES.morning, ...LINES.morning);
      if(h >= 12 && h < 13.75) pool.push(...LINES.lunch, ...LINES.lunch);
      if(h >= 19) pool.push(...LINES.evening, ...LINES.evening);
      if(day === 5 && h >= 14) pool.push(...LINES.friday, ...LINES.friday);
      return pick("remark", pool);
    },

    /* Une réplique liée à ce qu'il est en train de faire (punchlines.js), sinon une remarque générale */
    activityLine(activity, date){
      const PL = window.PUNCHLINES || {};
      const key = { tablet:"tablette", book:"lecture", muse:"philosophie", polish:"entretien", oil:"entretien", stretch:"etirements", sleep:"veille" }[activity];
      if(key && PL[key] && PL[key].length) return pick("pl-" + key, PL[key]);
      return this.remark(date);
    }
  };
};
})();
