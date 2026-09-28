/* ---------- Céu: estrelas e estrela cadente ---------- */
(function(){
  const cv=document.getElementById('sky'); if(!cv||!cv.getContext) return; const ctx=cv.getContext('2d');
  const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stars=[], shots=[], W=0, H=0, last=0;
  function seed(){
    const dpr=Math.min(2,window.devicePixelRatio||1); W=innerWidth; H=innerHeight;
    cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px'; ctx.setTransform(dpr,0,0,dpr,0,0);
    let s=11; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
    const n=Math.round(W*H/4200); stars=[];
    for(let i=0;i<n;i++){ const big=rnd()<.07; stars.push({x:rnd()*W, y:rnd()*H, r:big?1.1+rnd()*.9:.35+rnd()*.75, a:.3+rnd()*.6, t:rnd()*6.28, s:.5+rnd()*1.5, warm:rnd()<.14}); }
  }
  function draw(time){
    ctx.clearRect(0,0,W,H);
    for(const st of stars){
      const tw=reduce?1:(.6+.4*Math.sin(st.t+time/1000*st.s));
      ctx.globalAlpha=st.a*tw*(1-st.y/H*.6); ctx.fillStyle=st.warm?'#FFE6B8':'#DDE6FF';
      ctx.beginPath(); ctx.arc(st.x,st.y,st.r,0,6.2832); ctx.fill();
    }
    shots=shots.filter(sh=>time-sh.t0<sh.dur);
    for(const sh of shots){
      const k=(time-sh.t0)/sh.dur, x=sh.x+sh.dx*k, y=sh.y+sh.dy*k, len=140*(1-Math.abs(.5-k));
      const ang=Math.atan2(sh.dy,sh.dx), tx=x-Math.cos(ang)*len, ty=y-Math.sin(ang)*len;
      const g=ctx.createLinearGradient(tx,ty,x,y); g.addColorStop(0,'rgba(247,234,203,0)'); g.addColorStop(1,'rgba(255,248,230,.95)');
      ctx.globalAlpha=Math.min(1,(1-k)*1.6); ctx.strokeStyle=g; ctx.lineWidth=2; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(x,y); ctx.stroke();
      ctx.fillStyle='#FFF8E6'; ctx.beginPath(); ctx.arc(x,y,1.8,0,6.2832); ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  function loop(t){ if(!document.hidden && (t-last>50 || shots.length)){ draw(t); last=t; } requestAnimationFrame(loop); }
  window.estrelaCadente=function(){
    if(reduce) return;
    const x=W*(.25+Math.random()*.6), y=H*(.04+Math.random()*.22);
    shots.push({x, y, dx:-(260+Math.random()*160), dy:120+Math.random()*80, t0:performance.now(), dur:900});
  };
  seed(); draw(0); if(!reduce) requestAnimationFrame(loop);
  addEventListener('resize',()=>{ seed(); draw(performance.now()); });
  // marcar algo como feito solta uma estrela cadente
  document.addEventListener('click',e=>{
    const ci=e.target.closest&&e.target.closest('.ci[data-act="toggle"]');
    const st=e.target.closest&&e.target.closest('[data-act="st"][data-st="feita"]');
    if((ci&&ci.getAttribute('aria-pressed')!=='true') || (st&&st.getAttribute('aria-pressed')!=='true')) window.estrelaCadente();
  },true);
})();
