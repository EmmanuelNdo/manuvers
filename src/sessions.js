/* Manuvers : Lambert suit vos sessions Claude Code, sans ntfy ni jeton (application Mac uniquement).
   La coque Tauri renvoie la fin des transcriptions récentes (commande claude_sessions, lecture seule) ;
   ici on en déduit l'état de chaque session et on signale les changements qui méritent l'attention de Manu :
   - « vous attend » : une question (AskUserQuestion, ExitPlanMode) ou une modification qui attend votre accord ;
   - « a terminé » : la session rend la main après avoir travaillé au moins 20 secondes.
   Expose window.createSessionWatcher({ invoke, onEvent, onSummary }) : start(), stop(), summary(). */
(function(){
"use strict";

const APPROVAL = /^(Edit|Write|MultiEdit|NotebookEdit)$/, ASKS = /^(AskUserQuestion|ExitPlanMode)$/, SUBTOOL = /^(Task|Agent)$/;
const POLL_MS = 4000, MAX_AGE_S = 3 * 3600;

const blocks = r => { const c = r && r.message && r.message.content; return Array.isArray(c) ? c : typeof c === "string" ? [{ type:"text", text:c }] : []; };
const short = (t, n) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const base = p => String(p || "").split(/[\\/]/).filter(Boolean).pop() || "";

function parse(tail){
  const lines = tail.split("\n"); lines.shift();          // la première ligne est souvent coupée
  const pend = new Map();
  const s = { lastType:null, lastTool:false, lastStop:null, esc:false, cwd:"", title:"", lastText:"", working:0 };
  for(const l of lines){
    if(!l) continue; let r; try{ r = JSON.parse(l); }catch(e){ continue; }
    if(r.type === "custom-title" && r.customTitle) s.title = r.customTitle;
    else if(r.type === "ai-title" && r.aiTitle && !s.title) s.title = r.aiTitle;
    if(r.cwd) s.cwd = r.cwd;
    if(r.isSidechain) continue;                            // les sous-agents ne changent pas l'état de la session
    const t = Date.parse(r.timestamp) || 0, bl = blocks(r);
    if(r.type === "assistant" || r.type === "user"){
      s.lastType = r.type; s.lastTool = bl.some(b => b.type === "tool_use");
      s.lastStop = r.type === "assistant" && r.message ? r.message.stop_reason || null : null;
      s.esc = r.type === "user" && bl.some(b => b.type === "text" && /^\s*\[Request interrupted/i.test(b.text || ""));
      if(s.esc) pend.clear();
      if(r.type === "assistant"){ const txt = bl.filter(b => b.type === "text").map(b => b.text).join(" "); if(txt.trim()) s.lastText = txt; }
    }
    for(const b of bl){
      if(b.type === "tool_use") pend.set(b.id, { name:b.name, ts:t, input:b.input || {} });
      else if(b.type === "tool_result") pend.delete(b.tool_use_id);
    }
  }
  s.pending = [...pend.values()];
  return s;
}

function state(p, mtime, now){
  const age = now - mtime, lp = p.pending[p.pending.length - 1];
  if(age > 30*60e3) return { state:"idle" };
  if(lp){
    const wait = now - (lp.ts || mtime);
    if(SUBTOOL.test(lp.name)) return { state:"working", tool:lp.name };
    if((ASKS.test(lp.name) && wait > 4000) || (APPROVAL.test(lp.name) && wait > 15000 && age > 15000)) return { state:"blocked", tool:lp.name, input:lp.input };
    return { state:"working", tool:lp.name };
  }
  if(p.esc) return { state:"turn", cut:true };
  if(p.lastType === "assistant" && !p.lastTool && p.lastStop !== "tool_use") return { state:"turn" };
  return { state: age < 10*60e3 ? "working" : "idle" };
}

window.createSessionWatcher = function(opts){
  const known = new Map();   // id → { state, since, workedFrom }
  let timer = null, first = true, last = { working:0, blocked:0 };

  function projectName(proj, p){ return base(p.cwd) || String(proj).replace(/^-+/, "").split("-").pop() || "projet"; }
  function askText(st){
    const q = st.input && st.input.questions && st.input.questions[0];
    if(q && q.question) return q.question;
    if(st.tool === "ExitPlanMode") return "Son plan est prêt : il attend votre feu vert.";
    const f = st.input && (st.input.file_path || st.input.notebook_path);
    if(f) return "Il attend votre accord pour modifier " + base(f) + ".";
    return "Il attend votre réponse.";
  }

  async function poll(){
    let rows;
    try{ rows = await opts.invoke("claude_sessions", { maxAgeSecs:MAX_AGE_S, maxBytes:192 * 1024 }); }
    catch(e){ console.warn("Sessions Claude Code :", e); return; }
    const now = Date.now(); let working = 0, blocked = 0;
    for(const r of rows || []){
      const p = parse(r.tail || ""), st = state(p, r.mtime_ms, now), prev = known.get(r.id);
      if(st.state === "working") working++;
      if(st.state === "blocked") blocked++;
      const rec = prev || { state:"idle", since:now, workedFrom:0 };
      if(!prev || prev.state !== st.state){
        if(st.state === "working" && rec.state !== "blocked") rec.workedFrom = now;
        if(!first && opts.onEvent){
          const project = projectName(r.project, p), title = "Claude Code : " + (p.title ? short(p.title, 60) : project);
          if(st.state === "blocked")
            opts.onEvent({ type:"alerte", source:"claude", title, message:short(askText(st), 220), priority:4 });
          else if(st.state === "turn" && !st.cut && (rec.state === "working" || rec.state === "blocked") && rec.workedFrom && now - rec.workedFrom > 20000)
            opts.onEvent({ type:"success", source:"claude", title, message:short(p.lastText || "Il a terminé et vous rend la main.", 220) });
        }
        rec.state = st.state; rec.since = now;
      }
      known.set(r.id, rec);
    }
    first = false;
    last = { working, blocked };
    if(opts.onSummary) opts.onSummary(last);
  }

  return {
    start(){ if(!timer){ poll(); timer = setInterval(poll, POLL_MS); } },
    stop(){ clearInterval(timer); timer = null; known.clear(); first = true; if(opts.onSummary) opts.onSummary({ working:0, blocked:0 }); },
    summary(){ return last; },
    _parse:parse, _state:state
  };
};
})();
