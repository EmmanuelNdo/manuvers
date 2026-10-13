/* Manuvers : vous parlez, Lambert écoute.
   Reconnaissance vocale de la fenêtre web (celle de macOS dans l'application, celle du
   navigateur dans l'aperçu), en français. Appui pour parler : bouton, ou barre d'espace
   maintenue hors d'un champ de saisie.
   Le son ne quitte l'appareil que vers le service de reconnaissance du système :
   Manuvers ne l'enregistre pas et ne l'envoie à personne d'autre.
   Expose window.createMicro({ onPartiel, onFinal, onEtat }) : disponible, demarrer(), arreter(). */
(function(){
"use strict";

window.createMicro = function(opts){
  const Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Reco) return { disponible:false, demarrer(){}, arreter(){}, ecoute(){ return false; } };

  let reco = null, actif = false, final = "", partiel = "";

  function creer(){
    const r = new Reco();
    r.lang = "fr-FR";
    r.interimResults = true;
    r.continuous = true;   // tant que vous tenez le bouton, il écoute
    r.maxAlternatives = 1;
    r.onresult = e => {
      partiel = "";
      for(let i = e.resultIndex; i < e.results.length; i++){
        const t = e.results[i][0].transcript;
        if(e.results[i].isFinal) final += (final ? " " : "") + t.trim();
        else partiel += t;
      }
      opts.onPartiel && opts.onPartiel((final + " " + partiel).trim());
    };
    r.onerror = e => {
      const msg = {
        "not-allowed":"Micro refusé : autorisez Manuvers dans Réglages Système, Confidentialité, Micro et Reconnaissance vocale.",
        "service-not-allowed":"Reconnaissance vocale refusée par le système.",
        "no-speech":"Je n'ai rien entendu.",
        "audio-capture":"Aucun micro détecté.",
        "network":"Reconnaissance vocale injoignable."
      }[e.error] || "Micro : " + e.error;
      opts.onEtat && opts.onEtat("erreur", msg);
    };
    r.onend = () => {
      const texte = (final + " " + partiel).trim();
      const etaitActif = actif;
      actif = false; final = ""; partiel = "";
      opts.onEtat && opts.onEtat("arret");
      if(etaitActif && texte) opts.onFinal && opts.onFinal(texte);
    };
    return r;
  }

  return {
    disponible:true,
    ecoute(){ return actif; },
    demarrer(){
      if(actif) return;
      final = ""; partiel = "";
      try{
        reco = creer();
        reco.start();
        actif = true;
        opts.onEtat && opts.onEtat("ecoute");
      }catch(e){
        opts.onEtat && opts.onEtat("erreur", "Micro indisponible : " + e.message);
      }
    },
    /* Relâcher : la phrase entendue part à Lambert dès que la reconnaissance a fini. */
    arreter(){ if(reco && actif){ try{ reco.stop(); }catch(e){} } }
  };
};

/* Oui ou non, à l'oral. Rend true, false, ou null quand ce n'est ni l'un ni l'autre. */
window.reponseOuiNon = function(texte){
  const t = String(texte || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z' ]/g, " ").trim();
  if(/^(non|annule|annuler|stop|surtout pas|pas maintenant|laisse tomber|refuse)\b/.test(t)) return false;
  if(/^(oui|ouais|confirme|je confirme|confirmer|vas[ -]y|allez[ -]y|d'accord|ok|c'est bon|valide|valider|exact|parfait)\b/.test(t)) return true;
  return null;
};
})();
