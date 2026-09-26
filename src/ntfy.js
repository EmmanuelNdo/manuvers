/* Manuvers : client ntfy robuste.
   - Flux JSON en streaming (GET <serveur>/<sujet>/json), qui accepte un jeton "Authorization: Bearer".
   - Rattrapage : reprend depuis le dernier identifiant reçu (paramètre since), donc rien n'est perdu
     tant que le serveur garde les messages (12 h par défaut sur ntfy.sh).
   - Reconnexion automatique avec délai croissant (1 s à 30 s), et chien de garde : sans aucune donnée
     pendant 100 s (ntfy envoie un keepalive toutes les 45 s), la connexion est relancée.
   - Relance immédiate au retour du réseau ou à la sortie de veille. */
(function(){
"use strict";

class NtfyClient {
  constructor({ onMessage, onStatus, getLastId, setLastId }){
    this.onMessage = onMessage; this.onStatus = onStatus;
    this.getLastId = getLastId; this.setLastId = setLastId;
    this.seen = new Set(); this.stopped = true; this.backoff = 1000;
    window.addEventListener("online", () => this.restartSoon(200));
    document.addEventListener("visibilitychange", () => { if(!document.hidden) this.checkStale(); });
  }

  start(cfg){
    this.stop();
    this.cfg = cfg; this.stopped = false; this.backoff = 1000;
    this.run();
  }

  stop(){
    this.stopped = true;
    clearTimeout(this.retryT); clearTimeout(this.watchT);
    if(this.ctrl) this.ctrl.abort();
  }

  restartSoon(ms){ if(this.stopped) return; if(this.ctrl) this.ctrl.abort(); this.retry(ms); }
  checkStale(){ if(!this.stopped && Date.now() - (this.lastData || 0) > 100000) this.restartSoon(100); }

  retry(ms){ clearTimeout(this.retryT); this.retryT = setTimeout(() => this.run(), ms); }

  kick(){
    this.lastData = Date.now();
    clearTimeout(this.watchT);
    this.watchT = setTimeout(() => { if(this.ctrl) this.ctrl.abort(); }, 100000);
  }

  async run(){
    if(this.stopped) return;
    const { server, topic, token } = this.cfg;
    const base = (server || "https://ntfy.sh").replace(/\/+$/, "");
    const lastId = this.getLastId();
    const url = `${base}/${encodeURIComponent(topic)}/json` + (lastId ? `?since=${encodeURIComponent(lastId)}` : "");
    const ctrl = new AbortController(); this.ctrl = ctrl;
    this.onStatus("connecting", "Connexion à " + base.replace(/^https?:\/\//, "") + "…");
    try{
      const res = await fetch(url, { headers: token ? { Authorization: "Bearer " + token } : {}, signal: ctrl.signal, cache: "no-store" });
      if(res.status === 401 || res.status === 403){
        this.onStatus("error", "Accès refusé : vérifiez le jeton d'accès et les droits sur ce sujet.");
        return this.retry(60000);
      }
      if(!res.ok || !res.body) throw new Error("réponse HTTP " + res.status);
      this.onStatus("ok", "À l'écoute de " + topic);
      this.backoff = 1000; this.kick();
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for(;;){
        const { value, done } = await reader.read();
        if(done) break;
        this.kick();
        buf += dec.decode(value, { stream: true });
        let i;
        while((i = buf.indexOf("\n")) >= 0){
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if(line) this.handleLine(line);
        }
      }
      throw new Error("flux interrompu par le serveur");
    }catch(e){
      if(this.stopped || this.ctrl !== ctrl) return;
      const wait = this.backoff; this.backoff = Math.min(this.backoff * 2, 30000);
      this.onStatus("retry", "Connexion perdue (" + (e.name === "AbortError" ? "silence prolongé" : e.message) + "). Nouvel essai dans " + Math.round(wait/1000) + " s.");
      this.retry(wait);
    }
  }

  handleLine(line){
    let m; try{ m = JSON.parse(line); }catch(e){ return; }
    if(m.event !== "message" || !m.id || this.seen.has(m.id)) return;
    this.seen.add(m.id);
    if(this.seen.size > 500) this.seen = new Set([...this.seen].slice(-200));
    this.setLastId(m.id);
    this.onMessage(m);
  }
}

window.NtfyClient = NtfyClient;
})();
