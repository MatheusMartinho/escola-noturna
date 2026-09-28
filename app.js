/* Escola Noturna — rotina, checklist, grade e progresso */
/* ---------- Rotina padrão (exemplo até você ajustar) ---------- */
const DEFAULT_CFG = {
  inicio:'2026-09-28',
  trabalho:{dias:[1,2,3,4,5], ini:'09:00', fim:'18:00'},
  academia:{dias:[1,2,4,5], ini:'18:30', dur:75},
  alemao:{quando:'manha', dur:30},
  aulaT:{dias:[1,3], dur:75},
  aulaC:{dias:[2], dur:60},
  lab:{dias:[6], ini:'10:00', dur:120},
  jantar:40, dormir:'23:30', confirmado:false
};
const KIND = {work:'--work', gym:'--gym', tec:'--tec', com:'--com', lab:'--lab', ale:'--ale', pause:'--pause'};
const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DOWL = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const ORDER = [1,2,3,4,5,6,0];

/* ---------- Estado ---------- */
let cfg = clone(DEFAULT_CFG);
let prog = {status:{}, data:{}};
let logs = {};
let view = 'hoje';
let weekOffset = 0;
let filtro = 'todas';
let draft = null, draftDirty = false;
let syncState = 'connecting';
let pending = 0;

function clone(o){ return JSON.parse(JSON.stringify(o)); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toMin(s){ const [h,m]=String(s||'0:0').split(':').map(Number); return (h||0)*60+(m||0); }
function fmt(m){ m=Math.max(0,Math.round(m)); return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
function ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function parseYmd(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function monday(d){ const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
function daysBetween(a,b){ return Math.round((b-a)/864e5); }
function r5(m){ return Math.ceil(m/5)*5; }
function hm(min){ const h=Math.floor(min/60), m=Math.round(min%60); return h? (m? `${h}h${String(m).padStart(2,'0')}` : `${h}h`) : `${m} min`; }
function mergeCfg(d){ const out=clone(DEFAULT_CFG); for(const k of Object.keys(out)){ if(d[k]===undefined) continue; out[k] = (out[k] && typeof out[k]==='object' && !Array.isArray(out[k])) ? {...out[k], ...d[k]} : d[k]; } return out; }
function todayStr(){ return ymd(new Date()); }
function weekIdx(date){ return Math.floor(daysBetween(parseYmd(cfg.inicio), monday(date))/7)+1; }
function dayLog(ds){ return (logs[ds.slice(0,7)]?.dias?.[ds]) || {}; }
function studyMin(l){ return (l.alemao||0)+(l.gravacao||0)+(l.aulaT||0)+(l.aulaC||0)+(l.lab||0); }
function status(id){ return prog.status[id] || 'a-fazer'; }
function pendingList(tr){ return CAT.filter(l=>l.trilha===tr && status(l.id)!=='feita'); }
function kOf(l){ return l.trilha==='C' ? 'var(--com)' : 'var(--tec)'; }

/* ---------- Monta o dia a partir da rotina ---------- */
function buildDay(date, c){
  const d=date.getDay(), B=[];
  const work=c.trabalho.dias.includes(d), ws=toMin(c.trabalho.ini), we=toMin(c.trabalho.fim);
  const gym=c.academia.dias.includes(d), gs=toMin(c.academia.ini), ge=gs+(+c.academia.dur||0);
  const hasT=c.aulaT.dias.includes(d), hasC=c.aulaC.dias.includes(d), hasLab=c.lab.dias.includes(d);
  const ad=+c.alemao.dur||0;
  if(work) B.push({k:'work',ini:ws,fim:we,label:'Trabalho',sub:'Varejo Consolidado'});
  if(gym) B.push({k:'gym',ini:gs,fim:ge,label:'Academia',key:'academia'});
  let cur;
  if(work){ cur=we; if(gym && gs>=we-30) cur=Math.max(cur,ge); }
  else { cur=15*60; if(gym && gs<cur+180 && ge>cur-60) cur=Math.max(cur,ge); if(hasLab){ const le=toMin(c.lab.ini)+(+c.lab.dur||0); if(le>cur-60 && toMin(c.lab.ini)<cur+120) cur=Math.max(cur, le+60); } }
  const evening = hasT||hasC||(c.alemao.quando==='noite');
  if(work && evening && +c.jantar>0){ B.push({k:'pause',ini:cur,fim:cur+ +c.jantar,label:'Jantar e pausa'}); cur+= +c.jantar; }
  cur=r5(cur);
  if(hasT){ const du=+c.aulaT.dur||75; B.push({k:'tec',ini:cur,fim:cur+du,label:'Aula técnica',key:'aulaT',min:du}); cur=r5(cur+du+10); }
  if(hasC){ const du=+c.aulaC.dur||60; B.push({k:'com',ini:cur,fim:cur+du,label:'Aula de comunicação',key:'aulaC',min:du}); cur=r5(cur+du+10); }
  if(hasLab){ const ls=toMin(c.lab.ini), du=+c.lab.dur||120; B.push({k:'lab',ini:ls,fim:ls+du,label:'Laboratório',sub:'dever de casa das aulas',key:'lab',min:du}); }
  if(ad>0){
    if(c.alemao.quando==='manha'){
      let base = work ? ws : 10*60;
      if(!work && hasLab) base=Math.min(base, toMin(c.lab.ini));
      if(gym && gs<base && ge>base-ad-15) base=gs;
      B.push({k:'ale',ini:base-ad-15,fim:base-15,label:'Alemão',sub:'Anki + lição',key:'alemao',min:ad});
    } else { B.push({k:'ale',ini:cur,fim:cur+ad,label:'Alemão',sub:'Anki + lição',key:'alemao',min:ad}); }
  }
  B.sort((a,b)=>a.ini-b.ini);
  const lim=toMin(c.dormir);
  for(let i=0;i<B.length;i++){ for(let j=i+1;j<B.length;j++){ if(B[j].ini<B[i].fim){ B[i].conf=B[j].conf=true; } } if(B[i].fim>lim && B[i].k!=='work') B[i].late=true; }
  return B;
}
function plannedWeekMin(c){ let t=0; for(const d of ORDER){ const date=addDays(monday(new Date()), (d+6)%7); for(const b of buildDay(date,c)) if(b.min) t+=b.min; } return t; }

/* projeção: qual aula cai em cada slot a partir de hoje */
function projection(untilDate){
  const res={}; const qT=pendingList('T').map(l=>l.id), qC=pendingList('C').map(l=>l.id);
  const t0=parseYmd(todayStr());
  const tl=dayLog(todayStr());
  const doneToday=new Set(tl.aulas||[]);
  let d=new Date(t0);
  while(d<=untilDate){
    const ds=ymd(d);
    for(const b of buildDay(d,cfg)){
      if(b.key==='aulaT'||b.key==='aulaC'){
        const tr=b.key==='aulaT'?'T':'C';
        if(ds===todayStr()){ const logged=(tl.aulas||[]).find(id=>BYID[id]?.trilha===tr); if(logged){ res[ds+b.key]=logged; continue; } }
        const q= tr==='T'?qT:qC; const id=q.shift(); if(id) res[ds+b.key]=id;
      }
    }
    d=addDays(d,1);
  }
  return res;
}

/* ---------- Persistência (localStorage, neste navegador) ---------- */
const KEYS={'config/rotina':'escola:cfg','progresso/aulas':'escola:prog'};
function setSync(s,msg){ syncState=s; const el=document.getElementById('sync'); el.className='sync '+({ok:'ok',busy:'busy',off:'off'}[s]||''); el.querySelector('span').textContent=msg; }
function storeOk(){ try{ localStorage.setItem('escola:t','1'); localStorage.removeItem('escola:t'); return true; }catch(e){ return false; } }
function write(path, body){
  try{
    if(path.startsWith('registro/')) localStorage.setItem('escola:logs', JSON.stringify(logs));
    else localStorage.setItem(KEYS[path], JSON.stringify(body));
    setSync('ok','Salvo neste navegador');
  }catch(e){ setSync('off','Não salvou'); toast('Não consegui salvar: o navegador bloqueou o armazenamento.'); }
}
function loadAll(){
  try{
    const c=localStorage.getItem('escola:cfg'); if(c) cfg=mergeCfg(JSON.parse(c));
    const p=localStorage.getItem('escola:prog'); if(p){ const d=JSON.parse(p); prog={status:d.status||{}, data:d.data||{}}; }
    const l=localStorage.getItem('escola:logs'); if(l) logs=JSON.parse(l)||{};
  }catch(e){ /* dados corrompidos: começa do zero */ }
}
/* ---------- Backup ---------- */
function exportBackup(){
  const blob=new Blob([JSON.stringify({app:'escola-noturna',versao:1,exportadoEm:new Date().toISOString(),cfg,prog,logs},null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`escola-noturna-backup-${todayStr()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('Backup baixado.');
}
function importBackup(file){
  const r=new FileReader();
  r.onload=()=>{ try{ const d=JSON.parse(r.result); if(d.app!=='escola-noturna') throw new Error('arquivo');
    cfg=mergeCfg(d.cfg||{}); prog={status:d.prog?.status||{}, data:d.prog?.data||{}}; logs=d.logs||{};
    write('config/rotina',cfg); write('progresso/aulas',prog); write('registro/x',logs); draftDirty=false; render(); toast('Backup restaurado.');
  }catch(e){ toast('Esse arquivo não é um backup da Escola Noturna.'); } };
  r.readAsText(file);
}
function setDay(ds, patch){
  const mk=ds.slice(0,7); const doc=logs[mk]? clone(logs[mk]) : {dias:{}}; doc.dias=doc.dias||{};
  doc.dias[ds]={...(doc.dias[ds]||{}), ...patch}; logs[mk]=doc; render(); write('registro/'+mk, doc);
}
function setStatus(id, st, ds){
  prog=clone(prog); prog.status[id]=st; if(st==='feita') prog.data[id]=ds||todayStr(); else delete prog.data[id];
  render(); write('progresso/aulas', prog);
}

/* ---------- Ações do checklist ---------- */
function toggle(key, blk){
  const ds=todayStr(), l=dayLog(ds);
  if(key==='academia'){ setDay(ds,{academia:!l.academia}); return; }
  if(key==='aulaT'||key==='aulaC'){
    const tr=key==='aulaT'?'T':'C'; const aulas=[...(l.aulas||[])];
    const logged=aulas.find(id=>BYID[id]?.trilha===tr);
    if(l[key]>0){
      if(logged){ const p=clone(prog); p.status[logged]='a-fazer'; delete p.data[logged]; prog=p; write('progresso/aulas',prog); }
      setDay(ds,{[key]:0, aulas:aulas.filter(id=>id!==logged)});
    } else {
      const nx=pendingList(tr)[0];
      if(nx){ const p=clone(prog); p.status[nx.id]='feita'; p.data[nx.id]=ds; prog=p; write('progresso/aulas',prog); aulas.push(nx.id); toast(`${nx.id} marcada como feita. Boa!`); }
      setDay(ds,{[key]:blk.min, aulas});
    }
    return;
  }
  setDay(ds,{[key]: l[key]>0 ? 0 : blk.min});
}

/* ---------- Visual: timeline ---------- */
function timeline(blocks, opts){
  const ppm=opts.ppm, r0=opts.r0, r1=opts.r1, H=(r1-r0)*ppm;
  let h=`<div class="tl" style="height:${H}px">`;
  for(let t=Math.ceil(r0/60)*60; t<=r1; t+=60) h+=`<div class="hr" style="top:${(t-r0)*ppm}px"><span>${fmt(t)}</span></div>`;
  const l=opts.log||{};
  for(const b of blocks){
    const top=(b.ini-r0)*ppm, ht=Math.max(16,(b.fim-b.ini)*ppm);
    const done = b.extra ? true : b.key ? (b.key==='academia'? !!l.academia : (l[b.key]>0)) : false;
    const code = opts.proj && opts.proj[opts.ds+b.key];
    const lbl = code ? `${b.label} · ${code}` : b.label;
    const tipTxt=`${lbl} · ${fmt(b.ini)}–${fmt(b.fim)}${b.conf?' · conflito com outro bloco':''}${b.late?' · passa do horário limite':''}`;
    h+=`<div class="blk${ht<30?' short':''}${done?' done':''}${b.conf?' conf':''}" style="--k:var(${KIND[b.k]});top:${top}px;height:${ht}px" data-tip="${esc(tipTxt)}"><span class="dot"></span><div><b>${esc(lbl)}</b>${ht>=30?` <span class="t">${fmt(b.ini)}–${fmt(b.fim)}</span>`:''}${ht>=46&&b.sub?`<div class="muted" style="font-size:12px">${esc(b.sub)}</div>`:''}</div></div>`;
  }
  if(opts.now!=null && opts.now>=r0 && opts.now<=r1) h+=`<div class="now" style="top:${(opts.now-r0)*ppm}px" data-tip="Agora"></div>`;
  return h+'</div>';
}
function range(blocksList){
  let a=24*60,b=0; for(const bl of blocksList) for(const x of bl){ a=Math.min(a,x.ini); b=Math.max(b,x.fim); }
  if(a>b){ a=8*60; b=22*60; }
  return [Math.max(5*60, Math.floor(a/60)*60-30), Math.min(24*60, Math.ceil(b/60)*60+30)];
}

/* ---------- Views ---------- */
function vHoje(){
  const now=new Date(), ds=ymd(now), blocks=buildDay(now,cfg), l=dayLog(ds);
  const proj=projection(addDays(monday(now),6));
  const shown=new Set([proj[ds+'aulaT'],proj[ds+'aulaC']].filter(Boolean));
  const extras=CAT.filter(x=>status(x.id)==='feita'&&prog.data[x.id]===ds&&!shown.has(x.id));
  let endT=Math.max(20*60,...blocks.filter(b=>b.k!=='work').map(b=>b.fim));
  extras.forEach(x=>{const du=x.trilha==='C'?60:75;blocks.push({k:x.trilha==='C'?'com':'tec',ini:endT+5,fim:endT+5+du,label:(x.trilha==='C'?'Aula de comunicação':'Aula técnica')+' · '+x.id,extra:x.id});endT+=5+du;});
  const items=blocks.filter(b=>b.key);
  const done=items.filter(b=>b.key==='academia'? !!l.academia : l[b.key]>0).length+extras.length;
  const tot=items.length+extras.length;
  const wk=weekIdx(now), pct=tot? done/tot : 0;
  const nT=pendingList('T')[0], nC=pendingList('C')[0];
  const main=[proj[ds+'aulaT'], proj[ds+'aulaC'], ...extras.map(x=>x.id)].filter(Boolean);
  const title = main.length ? `Hoje: <em>${main.join(' + ')}</em>${items.some(b=>b.key==='alemao')?' e alemão':''}` : (items.length? 'Hoje: rotina leve' : 'Hoje: descanso');
  const [r0,r1]=range([blocks]);
  const streak=calcStreak();
  let h='';
  if(!cfg.confirmado) h+=`<div class="banner"><span><b>Rotina de exemplo.</b> Trabalho das 9h às 18h e academia seg, ter, qui e sex às 18h30 são palpites meus. Ajuste para os seus horários reais.</span><button class="btn small primary" data-act="tab" data-tab="rotina">Ajustar minha rotina</button></div>`;
  h+=`<div class="hero"><div><p class="eyebrow">${DOWL[now.getDay()]}, ${now.getDate()} de ${MES[now.getMonth()]} · ${wk<1?`a grade começa em ${daysBetween(parseYmd(ds),parseYmd(cfg.inicio))} dias`:`semana ${wk} da grade`}</p><h2>${title}</h2></div>
  <div class="hero-stats"><div class="stat-inline"><b class="num">${streak}</b><span>dias seguidos</span></div>${ringSvg(pct, `${done}/${tot}`)}</div></div>`;
  h+=`<div class="hoje-grid"><div class="card"><h2>Seu dia<small>${fmt(r0)}–${fmt(r1)}</small></h2>${timeline(blocks,{ppm:.78,r0,r1,log:l,proj,ds,now:now.getHours()*60+now.getMinutes()})}</div><div class="col">`;
  h+=`<div class="card"><h2>Checklist de hoje<small>toque para marcar</small></h2><div class="check">`;
  if(!tot) h+=`<p class="muted" style="margin:0">Nada planejado para hoje. Descanso também é parte do plano.</p>`;
  for(const b of items){
    const on = b.key==='academia'? !!l.academia : l[b.key]>0;
    const code = proj[ds+b.key];
    const sub = code ? BYID[code].titulo : (b.sub || (b.min? hm(b.min):''));
    h+=`<button class="ci" style="--k:var(${KIND[b.k]})" aria-pressed="${on}" data-act="toggle" data-key="${b.key}"><span class="box"></span><span class="lbl"><b>${esc(b.label)}${code?` · ${code}`:''}</b><small>${esc(sub)}</small></span><span class="t">${fmt(b.ini)}</span></button>`;
  }
  for(const x of extras) h+=`<button class="ci" style="--k:${kOf(x)}" aria-pressed="true" data-act="open" data-id="${x.id}"><span class="box"></span><span class="lbl"><b>${x.trilha==='C'?'Aula de comunicação':'Aula técnica'} · ${x.id}</b><small>${esc(x.titulo)} · aula extra</small></span><span class="t">feita</span></button>`;
  h+=`</div></div>`;
  h+=`<div class="card"><h2>Próximas aulas<small>peça no chat do Claude</small></h2><div class="next">`;
  for(const [n,lab] of [[nT,'Técnica'],[nC,'Comunicação']]){
    if(!n){ h+=`<div class="nx"><p class="muted">Trilha ${lab.toLowerCase()} concluída.</p></div>`; continue; }
    const late = weekIdx(new Date())>n.sem;
    h+=`<div class="nx" style="--k:${kOf(n)}"><span class="eyebrow">${lab}${late?' · <span style="color:var(--warn)">atrasada</span>':''}</span><span class="code">${n.id}</span><p class="ttl">${esc(n.titulo)}</p><p class="muted">${esc(n.decisao)}</p><div class="row"><button class="btn small primary" data-act="copy" data-id="${n.id}">Copiar "Aula ${n.id}"</button><button class="btn small" data-act="open" data-id="${n.id}">Detalhes</button></div></div>`;
  }
  h+=`</div></div>`;
  h+=`<div class="card"><h2>Esta semana</h2>${strip(now)}</div>`;
  h+=`</div></div>`;
  return h;
}
function gaugeSvg(p,S,w){
  p=Math.max(0,Math.min(1,p||0)); const c=S/2, r=S/2-w, C=2*Math.PI*r;
  return `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" aria-hidden="true" style="transform:rotate(-90deg)"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--line-2)" stroke-width="${w}"/><circle class="arc" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${p>=1?'var(--good)':'var(--ink)'}" stroke-width="${w}" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-p)}"/></svg>`;
}
function ringSvg(p,label){
  return `<div class="gauge" data-tip="Checklist de hoje: ${label}">${gaugeSvg(p,52,3)}<div class="gauge-t"><b class="num">${Math.round(p*100)}%</b><span>checklist · ${label}</span></div></div>`;
}
function strip(now){
  const m=monday(now); let h='<div class="strip">';
  for(let i=0;i<7;i++){
    const d=addDays(m,i), ds=ymd(d), items=buildDay(d,cfg).filter(b=>b.key), l=dayLog(ds);
    const done=items.filter(b=>b.key==='academia'? !!l.academia : l[b.key]>0).length;
    const p=items.length? done/items.length:0;
    h+=`<div class="sd${ds===ymd(now)?' today':''}" data-tip="${DOW[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}: ${done} de ${items.length} itens · ${hm(studyMin(l))} de estudo">${DOW[d.getDay()]}<b class="num">${d.getDate()}</b>${gaugeSvg(p,22,2)}</div>`;
  }
  return h+'</div>';
}
function legend(){ return `<div class="legend">${[['--work','Trabalho'],['--gym','Academia'],['--tec','Aula técnica'],['--com','Aula de comunicação'],['--lab','Laboratório'],['--ale','Alemão'],['--pause','Pausa']].map(([k,t])=>`<span><i style="--k:var(${k})"></i>${t}</span>`).join('')}</div>`; }
function weekGrid(c, m, proj, ppm){
  const days=[...Array(7)].map((_,i)=>addDays(m,i)); const bl=days.map(d=>buildDay(d,c));
  const [r0,r1]=range(bl), H=(r1-r0)*ppm, td=todayStr();
  let h=`<div class="wk-scroll"><div class="wk"><div></div>`;
  for(const d of days) h+=`<div class="dh${ymd(d)===td?' today':''}">${DOW[d.getDay()]}<b class="num">${d.getDate()}</b></div>`;
  h+=`<div class="axis" style="height:${H}px">`; for(let t=Math.ceil(r0/60)*60;t<=r1;t+=60) h+=`<span style="top:${(t-r0)*ppm}px">${fmt(t)}</span>`; h+=`</div>`;
  days.forEach((d,i)=>{
    const ds=ymd(d), l=dayLog(ds);
    h+=`<div class="day${ds===td?' today':''}" style="height:${H}px">`;
    for(let t=Math.ceil(r0/60)*60;t<=r1;t+=60) h+=`<div class="gl" style="top:${(t-r0)*ppm}px"></div>`;
    for(const b of bl[i]){
      const top=(b.ini-r0)*ppm, ht=Math.max(10,(b.fim-b.ini)*ppm);
      const done = b.key ? (b.key==='academia'? !!l.academia : l[b.key]>0) : false;
      let code = proj && proj[ds+b.key];
      if(!code && ds<td && (b.key==='aulaT'||b.key==='aulaC')) code=(l.aulas||[]).find(id=>BYID[id]?.trilha===(b.key==='aulaT'?'T':'C'));
      const lbl = code? code : b.label;
      h+=`<div class="blk${done?' done':''}${b.conf?' conf':''}" style="--k:var(${KIND[b.k]});top:${top}px;height:${ht}px" data-tip="${esc(`${b.label}${code?' · '+code+' '+BYID[code].titulo:''} · ${fmt(b.ini)}–${fmt(b.fim)}${b.conf?' · conflito':''}${b.late?' · passa do limite':''}`)}">${ht>=16?`<b>${esc(lbl)}</b>`:''}</div>`;
    }
    h+=`</div>`;
  });
  h+=`</div></div>`;
  const all=bl.flat(); const conf=all.some(b=>b.conf), late=all.some(b=>b.late);
  const tot=all.filter(b=>b.min).reduce((s,b)=>s+b.min,0);
  h+=legend()+`<div class="sum"><span class="chip">${hm(tot)} de estudo planejado na semana</span>${conf?'<span class="chip bad">Há blocos se sobrepondo (borda tracejada)</span>':''}${late?`<span class="chip warn">Algum bloco passa das ${esc(c.dormir)}</span>`:''}${!conf&&!late?'<span class="chip good">Semana sem conflitos</span>':''}</div>`;
  return h;
}
function vSemana(){
  const m=addDays(monday(new Date()), weekOffset*7), end=addDays(m,6);
  const proj = end>=parseYmd(todayStr()) ? projection(end) : null;
  const wi=weekIdx(m);
  let h=`<div class="card"><div class="wk-head"><div><p class="eyebrow">${wi<1?'antes da grade começar':`semana ${wi} da grade`}</p><h2>${m.getDate()} ${MES[m.getMonth()]} – ${end.getDate()} ${MES[end.getMonth()]}</h2></div><div style="display:flex;gap:6px"><button class="btn small" data-act="wk" data-d="-1" aria-label="Semana anterior">←</button><button class="btn small" data-act="wk" data-d="0">Esta semana</button><button class="btn small" data-act="wk" data-d="1" aria-label="Próxima semana">→</button></div></div>`;
  h+=weekGrid(cfg,m,proj,.52)+`</div>`;
  return h;
}
function blocoProgress(){
  const groups=[['1','Bloco 1','var(--tec)'],['2','Bloco 2','var(--tec)'],['3','Bloco 3','var(--tec)'],['C','Comunicação','var(--com)']];
  return `<div class="bars">${groups.map(([b,n,k])=>{
    const ls=CAT.filter(l=>String(l.bloco)===b); const f=ls.filter(l=>status(l.id)==='feita').length, a=ls.filter(l=>status(l.id)==='andamento').length;
    return `<div class="pb" style="--k:${k}" data-tip="${n}: ${f} feitas, ${a} em andamento, ${ls.length-f-a} a fazer"><div class="lab"><b>${n}</b><span class="num muted">${f}/${ls.length}</span></div><div class="track"><i style="width:${f/ls.length*100}%"></i><i class="half" style="width:${a/ls.length*100}%"></i></div></div>`;
  }).join('')}</div>`;
}
function vGrade(){
  const cw=weekIdx(new Date()), nT=pendingList('T')[0]?.id, nC=pendingList('C')[0]?.id;
  let h=blocoProgress();
  h+=`<div class="filters" role="group" aria-label="Filtrar">${[['todas','Todas'],['T','Técnicas'],['C','Comunicação'],['pend','Só pendentes']].map(([k,t])=>`<button data-act="filtro" data-f="${k}" aria-pressed="${filtro===k}">${t}</button>`).join('')}</div>`;
  for(const b of ['1','2','3','C']){
    if(filtro==='T' && b==='C') continue; if(filtro==='C' && b!=='C') continue;
    const ls=CAT.filter(l=>String(l.bloco)===b && (filtro!=='pend' || status(l.id)!=='feita'));
    if(!ls.length) continue;
    h+=`<section class="sec"><h3>${BLOCOS[b].nome}</h3><p class="muted" style="margin:0">${BLOCOS[b].quando}</p>`;
    let mod=null;
    for(const l of ls){
      if(l.modulo!==mod){ if(mod!==null) h+=`</div>`; mod=l.modulo; h+=`<p class="mod">${esc(mod)}</p><div class="lessons">`; }
      const st=status(l.id), isNext=l.id===nT||l.id===nC, late=st!=='feita' && cw>l.sem;
      h+=`<button class="lesson ${st}${isNext?' proxima':''}" style="--k:${kOf(l)}" data-act="open" data-id="${l.id}"><span class="top2"><span class="code">${l.id}</span>${isNext?'<span class="pill prox">Próxima</span>':st==='feita'?'<span class="pill feita">Feita</span>':st==='andamento'?'<span class="pill andamento">Em andamento</span>':''}</span><span class="ttl">${esc(l.titulo)}</span><span class="meta">Semana ${l.sem}${late?' · <span style="color:var(--warn)">atrasada</span>':''}${st==='feita'&&prog.data[l.id]?` · ${fmtDs(prog.data[l.id])}`:''}</span></button>`;
    }
    h+=`</div></section>`;
  }
  return h;
}
function fmtDs(ds){ const d=parseYmd(ds); return `${d.getDate()} ${MES[d.getMonth()]}`; }
function calcStreak(){
  let d=parseYmd(todayStr()); if(!studyMin(dayLog(ymd(d)))) d=addDays(d,-1);
  let n=0; while(studyMin(dayLog(ymd(d)))>0 && n<999){ n++; d=addDays(d,-1); } return n;
}
function allDays(){ const out=[]; for(const mk of Object.keys(logs)) for(const [ds,l] of Object.entries(logs[mk]?.dias||{})) out.push([ds,l]); return out; }
function vProgresso(){
  const days=allDays(), totMin=days.reduce((s,[,l])=>s+studyMin(l),0), aleMin=days.reduce((s,[,l])=>s+(l.alemao||0),0);
  const feitas=CAT.filter(l=>status(l.id)==='feita').length, cw=weekIdx(new Date());
  const devidas=CAT.filter(l=>l.sem<=cw).length, ritmo=feitas-devidas;
  const gymN=days.filter(([,l])=>l.academia).length;
  let h=`<div class="kpis">
  <div class="kpi" style="--k:var(--tec)"><span>Aulas concluídas</span><b class="num">${feitas}<small>/${CAT.length}</small></b><div class="track"><i style="width:${feitas/CAT.length*100}%"></i></div></div>
  <div class="kpi"><span>Ritmo da grade</span><b class="num" style="color:${cw<1?'var(--ink)':ritmo>=0?'var(--good)':'var(--warn)'}">${cw<1?'—':(ritmo>0?'+':'')+ritmo}</b><span class="muted">${cw<1?'a grade começa em '+fmtDs(cfg.inicio):ritmo>=0?(ritmo===0?'aulas: no ritmo certo':'aulas à frente do plano'):'aulas atrás do plano'}</span></div>
  <div class="kpi"><span>Horas de estudo</span><b class="num">${(totMin/60).toFixed(1).replace('.',',')}<small>h</small></b><span class="muted">${calcStreak()} dias seguidos · ${gymN} treinos</span></div>
  <div class="kpi" style="--k:var(--ale)"><span>Alemão rumo ao A1 (75h)</span><b class="num">${(aleMin/60).toFixed(1).replace('.',',')}<small>h</small></b><div class="track"><i style="width:${Math.min(100,aleMin/60/75*100)}%"></i></div></div>
  </div>`;
  h+=`<div class="pgrid"><div class="card wide"><h2>Dias de estudo<small>cada quadrado é um dia; mais escuro, mais tempo</small></h2>${heatmap()}</div>`;
  h+=`<div class="card"><h2>Horas por semana<small>linha tracejada: o que a rotina planeja</small></h2>${weekBars()}</div>`;
  h+=`<div class="card"><h2>Grade por bloco</h2>${blocoProgress().replace('class="bars"','class="bars" style="grid-template-columns:1fr 1fr;margin:0"')}<h2 style="margin-top:22px">Alemão até o B1<small>horas acumuladas</small></h2>${milestones(aleMin/60)}</div></div>`;
  return h;
}
function heatmap(){
  const start=monday(parseYmd(cfg.inicio)), today=parseYmd(todayStr());
  const curW=monday(today); let from=addDays(start,0);
  const weeksSince=Math.floor(daysBetween(start,curW)/7);
  if(weeksSince>30) from=addDays(curW,-30*7);
  if(today<start) from=addDays(curW,0);
  const nWeeks=40;
  let h=`<div class="hm-wrap"><div class="hm"><span></span>`;
  ['Seg','','Qua','','Sex','','Dom'].forEach(t=>h+=`<span class="dl">${t}</span>`);
  let lastM=-1, lastW=-9;
  for(let w=0;w<nWeeks;w++){
    const ws=addDays(from,w*7), mo=addDays(ws,6).getMonth();
    const show = mo!==lastM && w-lastW>=3; if(show){ lastM=mo; lastW=w; }
    h+=`<span class="m">${show?MES[mo]:''}</span>`;
    for(let i=0;i<7;i++){
      const d=addDays(ws,i), ds=ymd(d), l=dayLog(ds), m=studyMin(l);
      const fut=d>today, lv= m===0?0: m<45?1: m<90?2: m<150?3:4;
      h+=`<span class="c ${fut?'fut':'l'+lv}${ds===todayStr()?' tdy':''}" data-tip="${DOW[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}: ${fut?'ainda não chegou':m?hm(m)+' de estudo':'sem estudo registrado'}${l.academia?' · treinou':''}${(l.aulas||[]).length?' · '+l.aulas.join(', '):''}"></span>`;
    }
  }
  h+=`</div></div><div class="hm-legend">menos <span class="c l0"></span><span class="c l1"></span><span class="c l2"></span><span class="c l3"></span><span class="c l4"></span> mais</div>`;
  return h;
}
function weekBars(){
  const N=10; let cur=monday(new Date()); const st=monday(parseYmd(cfg.inicio)); if(daysBetween(st,cur)<(N-1)*7) cur=addDays(st,(N-1)*7); const weeks=[];
  for(let i=N-1;i>=0;i--){ const m=addDays(cur,-7*i); const v={m,tec:0,com:0,lab:0,ale:0}; for(let j=0;j<7;j++){ const l=dayLog(ymd(addDays(m,j))); v.tec+=l.aulaT||0; v.com+=(l.aulaC||0)+(l.gravacao||0); v.lab+=l.lab||0; v.ale+=l.alemao||0; } weeks.push(v); }
  const plan=plannedWeekMin(cfg)/60;
  const maxH=Math.max(plan*1.15, ...weeks.map(w=>(w.tec+w.com+w.lab+w.ale)/60), 2);
  const step=maxH>12?4:2, top=Math.ceil(maxH/step)*step;
  const W=640,H=230,L=34,R=8,T=10,Bm=26, iw=W-L-R, ih=H-T-Bm, bw=iw/N*0.62;
  const y=v=>T+ih-(v/top)*ih;
  const cats=[['tec','Técnica'],['com','Comunicação'],['lab','Laboratório'],['ale','Alemão']];
  let s=`<div class="legend" style="margin:0 0 8px">${cats.map(([k,t])=>`<span><i style="--k:var(--${k})"></i>${t}</span>`).join('')}</div><div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Horas de estudo por semana, últimas ${N} semanas">`;
  for(let v=0;v<=top;v+=step) s+=`<line class="gridl" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${v}h</text>`;
  weeks.forEach((w,i)=>{
    const x=L+iw/N*i+(iw/N-bw)/2; let acc=0; const tot=(w.tec+w.com+w.lab+w.ale)/60;
    const parts=cats.filter(([k])=>w[k]>0);
    parts.forEach(([k],pi)=>{ const v=w[k]/60; const y1=y(acc+v), hgt=Math.max(0,y(acc)-y1-(pi<parts.length-1?2:0)); const isTop=pi===parts.length-1; s+= isTop? `<path d="M${x},${y(acc)} V${y1+4} Q${x},${y1} ${x+4},${y1} H${x+bw-4} Q${x+bw},${y1} ${x+bw},${y1+4} V${y(acc)} Z" fill="var(--${k})" transform="translate(0,${-(0)})"/>` : `<rect x="${x}" y="${y1+2}" width="${bw}" height="${Math.max(0,hgt-0)}" fill="var(--${k})"/>`; acc+=v; });
    const lab=`${w.m.getDate()}/${w.m.getMonth()+1}`;
    s+=`<text x="${x+bw/2}" y="${H-8}" text-anchor="middle">${lab}</text>`;
    s+=`<rect x="${L+iw/N*i}" y="${T}" width="${iw/N}" height="${ih}" fill="transparent" data-tip="${esc(`Semana de ${lab}: ${hm(tot*60)} no total · técnica ${hm(w.tec)} · comunicação ${hm(w.com)} · laboratório ${hm(w.lab)} · alemão ${hm(w.ale)}`)}"/>`;
  });
  s+=`<line class="meta-l" x1="${L}" x2="${W-R}" y1="${y(plan)}" y2="${y(plan)}"/><text x="${W-R}" y="${y(plan)-6}" text-anchor="end" style="fill:var(--ink-2)">plano ${hm(plan*60)}</text>`;
  return s+`</svg></div>`;
}
function milestones(hrs){
  const max=375, mk=[[75,'A1'],[225,'A2'],[375,'B1']];
  return `<div class="ms" data-tip="${hrs.toFixed(1).replace('.',',')}h de alemão registradas de ~375h até o B1"><div class="track"><i style="width:${Math.min(100,hrs/max*100)}%"></i></div>${mk.map(([v,t])=>`<span class="mk" style="left:${v/max*100}%;${v===max?'transform:translateX(-100%)':''}"><span></span></span>`).join('')}</div><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-3)"><span>0h</span><span>A1 · 75h</span><span>A2 · 225h</span><span>B1 · 375h</span></div>`;
}

/* ---------- Rotina ---------- */
function daysSel(path, k){ const arr=get(draft,path); return `<div class="days" style="--k:var(${k})">${ORDER.map(d=>`<button type="button" data-act="day" data-path="${path}" data-d="${d}" aria-pressed="${arr.includes(d)}">${DOW[d]}</button>`).join('')}</div>`; }
function get(o,p){ return p.split('.').reduce((a,k)=>a[k],o); }
function set(o,p,v){ const ks=p.split('.'); const last=ks.pop(); ks.reduce((a,k)=>a[k],o)[last]=v; }
function vRotina(){
  if(!draft || !draftDirty) draft=clone(cfg);
  const f=(p,type,extra='')=>`<input id="f-${p.replace('.','-')}" type="${type}" data-path="${p}" value="${esc(get(draft,p))}" ${extra}>`;
  let h=`<div class="rt"><div class="card"><h2>Minha rotina<small>o app monta a semana a partir disto</small></h2><form class="form" id="rtform" onsubmit="return false">
  <div class="fg"><h3>Início da grade</h3><div class="fr"><label>Semana 1 começa em ${f('inicio','date')}</label></div></div>
  <div class="fg" style="--k:var(--work)"><h3><i></i>Trabalho</h3>${daysSel('trabalho.dias','--work')}<div class="fr"><label>das ${f('trabalho.ini','time')}</label><label>às ${f('trabalho.fim','time')}</label></div></div>
  <div class="fg" style="--k:var(--gym)"><h3><i></i>Academia</h3>${daysSel('academia.dias','--gym')}<div class="fr"><label>às ${f('academia.ini','time')}</label><label>por ${f('academia.dur','number','min="15" max="240" step="5"')} min</label></div></div>
  <div class="fg" style="--k:var(--ale)"><h3><i></i>Alemão, todo dia</h3><div class="fr"><label><select id="f-alemao-quando" data-path="alemao.quando"><option value="manha"${draft.alemao.quando==='manha'?' selected':''}>de manhã, antes do trabalho</option><option value="noite"${draft.alemao.quando==='noite'?' selected':''}>à noite, depois das aulas</option></select></label><label>${f('alemao.dur','number','min="0" max="120" step="5"')} min</label></div></div>
  <div class="fg" style="--k:var(--tec)"><h3><i></i>Aula técnica</h3>${daysSel('aulaT.dias','--tec')}<div class="fr"><label>${f('aulaT.dur','number','min="30" max="180" step="5"')} min por aula</label></div></div>
  <div class="fg" style="--k:var(--com)"><h3><i></i>Aula de comunicação</h3>${daysSel('aulaC.dias','--com')}<div class="fr"><label>${f('aulaC.dur','number','min="30" max="180" step="5"')} min por aula</label></div></div>
  <div class="fg" style="--k:var(--lab)"><h3><i></i>Laboratório (dever de casa)</h3>${daysSel('lab.dias','--lab')}<div class="fr"><label>às ${f('lab.ini','time')}</label><label>por ${f('lab.dur','number','min="30" max="300" step="10"')} min</label></div></div>
  <div class="fg"><h3>Pausas e limite</h3><div class="fr"><label>Jantar e pausa depois do treino ${f('jantar','number','min="0" max="120" step="5"')} min</label><label>Terminar tudo até ${f('dormir','time')}</label></div></div>
  <div class="form-actions"><button type="button" class="btn primary" data-act="save">Salvar rotina</button><button type="button" class="btn" data-act="reset">Descartar mudanças</button></div>
  </form></div><div class="col"><div class="card" id="preview"><h2>Prévia da semana<small>atualiza enquanto você edita</small></h2>${weekGrid(draft, monday(new Date()), null, .4)}</div>
  <div class="card"><h2>Backup<small>seu progresso fica salvo neste navegador</small></h2><p class="muted" style="margin:0 0 12px;font-size:14px">Para levar o progresso para outro navegador ou computador, baixe o backup aqui e restaure lá.</p><div class="fr"><button type="button" class="btn" data-act="export">Baixar backup</button><label class="btn" for="imp" style="cursor:pointer">Restaurar backup</label><input id="imp" type="file" accept="application/json,.json" hidden></div></div></div></div>`;
  return h;
}
function refreshPreview(){ const p=document.getElementById('preview'); if(p) p.innerHTML=`<h2>Prévia da semana<small>atualiza enquanto você edita</small></h2>${weekGrid(draft, monday(new Date()), null, .4)}`; }

/* ---------- Detalhe da aula ---------- */
function openLesson(id){
  const l=BYID[id]; if(!l) return; const st=status(id), ov=document.getElementById('ov');
  const isC=l.trilha==='C';
  ov.innerHTML=`<div class="panel" role="dialog" aria-modal="true" aria-labelledby="dl-t" style="--k:${kOf(l)}"><div style="display:flex;justify-content:space-between;align-items:start;gap:12px"><div><span class="code">${l.id}</span><p class="eyebrow">${esc(BLOCOS[l.bloco].nome)} · ${esc(l.modulo)} · semana ${l.sem}</p></div><button class="btn small" data-act="close" aria-label="Fechar">Fechar</button></div>
  <h3 id="dl-t">${esc(l.titulo)}</h3>
  <dl><div><dt>${isC?'Técnica que sai da teoria':l.prova?'O que ela mostra':'A decisão que ela ensina'}</dt><dd>${esc(l.decisao)}</dd></div><div><dt>${isC?'Prática da semana':l.prova?'O que entregar':'Laboratório'}</dt><dd>${esc(l.lab)}</dd></div>${st==='feita'&&prog.data[id]?`<div><dt>Concluída em</dt><dd>${fmtDs(prog.data[id])}</dd></div>`:''}</dl>
  <div class="seg" role="group" aria-label="Status">${[['a-fazer','A fazer'],['andamento','Em andamento'],['feita','Feita']].map(([k,t])=>`<button data-act="st" data-id="${id}" data-st="${k}" aria-pressed="${st===k}">${t}</button>`).join('')}</div>
  <div class="actions"><button class="btn primary" data-act="copy" data-id="${id}">Copiar "Aula ${id}" para o chat</button><span class="muted" style="font-size:13px;align-self:center">Cole no chat do Claude para abrir a aula.</span></div></div>`;
  ov.hidden=false; ov.querySelector('[data-act="close"]').focus();
}
function closeOv(){ const ov=document.getElementById('ov'); ov.hidden=true; ov.innerHTML=''; }

/* ---------- Utilidades de UI ---------- */
let toastT; function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,2600); }
async function copy(text, btn){
  try{ await navigator.clipboard.writeText(text); toast(`Copiado: "${text}". Cole no chat do Claude.`); }
  catch(e){ const i=document.createElement('input'); i.value=text; i.style.cssText='position:fixed;opacity:0'; document.body.appendChild(i); i.select(); try{ document.execCommand('copy'); toast(`Copiado: "${text}".`); }catch(_){ toast(`Escreva no chat: ${text}`); } i.remove(); }
}

function render(){
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected', String(b.dataset.tab===view)));
  const el=document.getElementById('view');
  if(view==='rotina' && draftDirty) { refreshPreview(); return; }
  el.innerHTML = view==='hoje'?vHoje(): view==='semana'?vSemana(): view==='grade'?vGrade(): view==='progresso'?vProgresso(): vRotina();
  if(window.__lv!==view){ el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); window.__lv=view; }
}

document.addEventListener('click', e=>{
  const t=e.target.closest('[data-act],[data-tab]'); if(!t) { if(e.target.id==='ov') closeOv(); return; }
  const a=t.dataset.act;
  if(!a && t.dataset.tab){ view=t.dataset.tab; if(view!=='rotina'){ draftDirty=false; } render(); window.scrollTo({top:0}); return; }
  if(a==='tab'){ view=t.dataset.tab; render(); window.scrollTo({top:0}); }
  else if(a==='toggle'){ const b=buildDay(new Date(),cfg).find(x=>x.key===t.dataset.key); if(b) toggle(b.key,b); }
  else if(a==='open') openLesson(t.dataset.id);
  else if(a==='close') closeOv();
  else if(a==='st'){ setStatus(t.dataset.id, t.dataset.st); openLesson(t.dataset.id); }
  else if(a==='copy') copy(`Aula ${t.dataset.id}`, t);
  else if(a==='filtro'){ filtro=t.dataset.f; render(); }
  else if(a==='wk'){ const d=+t.dataset.d; weekOffset = d===0?0:weekOffset+d; render(); }
  else if(a==='day'){ const arr=get(draft,t.dataset.path); const d=+t.dataset.d; const i=arr.indexOf(d); if(i>=0) arr.splice(i,1); else arr.push(d); t.setAttribute('aria-pressed',String(i<0)); draftDirty=true; refreshPreview(); }
  else if(a==='save'){ const c={...clone(draft), confirmado:true}; cfg=mergeCfg(c); draftDirty=false; write('config/rotina', cfg); toast('Rotina salva.'); view='semana'; weekOffset=0; render(); }
  else if(a==='export'){ exportBackup(); }
  else if(a==='reset'){ draftDirty=false; draft=clone(cfg); render(); }
});
document.addEventListener('change', e=>{ if(e.target.id==='imp' && e.target.files[0]){ importBackup(e.target.files[0]); e.target.value=''; } });
document.addEventListener('input', e=>{
  const p=e.target.dataset?.path; if(!p || !draft) return;
  let v=e.target.value; if(e.target.type==='number') v=Number(v)||0;
  set(draft,p,v); draftDirty=true; refreshPreview();
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !document.getElementById('ov').hidden) closeOv(); });
const tip=document.getElementById('tip');
document.addEventListener('pointermove', e=>{
  const t=e.target.closest?.('[data-tip]'); if(!t){ tip.hidden=true; return; }
  tip.textContent=t.getAttribute('data-tip'); tip.hidden=false;
  const x=Math.min(window.innerWidth-tip.offsetWidth-8, e.clientX+14), y=Math.min(window.innerHeight-tip.offsetHeight-8, e.clientY+14);
  tip.style.left=x+'px'; tip.style.top=y+'px';
});
document.addEventListener('pointerleave', ()=>tip.hidden=true);

loadAll();
if(storeOk()) setSync('ok','Salvo neste navegador'); else setSync('off','Navegador bloqueando armazenamento');
render();
