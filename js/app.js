(function(){
"use strict";
/* ================= utilidades ================= */
const KEY="etograma.v2",KEY1="etograma.v1";
const{uid,pad,hhmm,dmy,parseDay,dayDiff,norm,grupo,nSlots,slotDate,marked,toCSV,sessionCSV}=Data;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isoDay=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const fmt=(v,d=1)=>isFinite(v)?Number(v).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}):"—";
const fmtP=p=>!isFinite(p)?"—":p<0.001?"< 0,001":fmt(p,3);
const fmtDur=min=>{min=Math.round(min);const h=Math.floor(min/60),m=min%60;return h?(h+" h"+(m?" "+pad(m):"")):m+" min"};
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}

/* ================= ícones ================= */
const IC={
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  obs:'<rect x="5" y="3.5" width="14" height="17.5" rx="2.5"/><path d="M9 3.5h6v3H9z"/><path d="M8.5 11h7M8.5 15h4.5"/>',
  perf:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  stats:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back:'<path d="M15 18l-6-6 6-6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  down:'<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
  up:'<path d="M12 20V8M6 14l6-6 6 6M4 4h16"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert:'<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.5"/>',
  arrowUp:'<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown:'<path d="M12 5v14M6 13l6 6 6-6"/>',
  minus:'<path d="M5 12h14"/>',
  spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>'
};
const icon=(n,cls="i")=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

/* ================= dados padrão ================= */
function B(nome,tipo){return{id:uid(),nome,tipo:tipo||"comum"}}
function defaultSpecies(){return[
  {id:"vaca",nome:"Vaca",comp:[B("Comendo"),B("Ruminando"),B("Bebendo água"),B("Ócio"),B("Deitada"),B("Em pé"),B("Defecando"),B("Urinando"),B("Se coçando / esfregando","raro"),B("Esperneando","raro")]},
  {id:"cavalo",nome:"Cavalo",comp:[B("Comendo"),B("Bebendo água"),B("Ócio"),B("Deitado"),B("Em pé"),B("Andando"),B("Defecando"),B("Urinando"),B("Rolando","raro"),B("Escoiceando","raro"),B("Se coçando / esfregando","raro")]},
  {id:"ovelha",nome:"Ovelha",comp:[B("Comendo"),B("Ruminando"),B("Bebendo água"),B("Ócio"),B("Deitada"),B("Em pé"),B("Andando"),B("Defecando"),B("Urinando"),B("Se coçando / esfregando","raro"),B("Esperneando","raro")]},
  {id:"galinha",nome:"Galinha",comp:[B("Comendo"),B("Bebendo água"),B("Ciscando"),B("Empoleirada"),B("Deitada"),B("Andando"),B("Arrumando penas"),B("Banho de terra"),B("Bicando outra ave","raro"),B("Ofegando","raro")]}
]}

/* Exemplo realista: confinamento com 12 vacas em 2 dietas, 3 pesagens, consumo e 24 h de etograma */
function exampleData(species){
  const r=rng(20261010);const sp=species.find(s=>s.id==="vaca")||species[0];
  const today=new Date();today.setHours(0,0,0,0);const start=new Date(today);start.setDate(start.getDate()-56);
  const gA={id:"gA",nome:"Dieta A",dieta:"80% concentrado",gmdMeta:1.4},gB={id:"gB",nome:"Dieta B",dieta:"50% concentrado + silagem",gmdMeta:1.0};
  const animais=[];for(let i=1;i<=12;i++)animais.push({id:"a"+i,brinco:pad(i),grupoId:i%2?"gA":"gB"});
  const truth={};
  animais.forEach(a=>{const A=a.grupoId==="gA";
    const eat=(A?215:265)+gauss(r)*22,rum=(A?395:505)+gauss(r)*35;
    let gmd=(A?1.46:1.03)+gauss(r)*.09-.0015*(rum-(A?395:505))+.001*(eat-(A?215:265));
    if(a.id==="a5")gmd=1.08; if(a.id==="a8")gmd=.74;
    truth[a.id]={eat,rum,gmd,p0:Math.round(372+gauss(r)*18),cms:(A?10.6:9.7)+gauss(r)*.55};});
  const dates=[0,28,56].map(d=>{const x=new Date(start);x.setDate(x.getDate()+d);return isoDay(x)});
  const pesagens=dates.map((d,k)=>({id:uid(),data:d,pesos:Object.fromEntries(animais.map(a=>{const t=truth[a.id];return[a.id,Math.round((t.p0+t.gmd*k*28+gauss(r)*2.5)*2)/2]}))}));
  const consumo=dates.slice(1).map(d=>({id:uid(),data:d,valores:Object.fromEntries(animais.map(a=>[a.id,Math.round((truth[a.id].cms+gauss(r)*.25)*10)/10]))}));
  const exp={id:"exemplo",exemplo:true,nome:"Confinamento Nelore",especieId:sp.id,especie:sp.nome,responsavel:"Raquel",inicio:dates[0],grupos:[gA,gB],animais,pesagens,consumo};
  // etograma 24 h, 6 observadores × 2 animais
  const sessStart=new Date(start);sessStart.setDate(sessStart.getDate()+50);sessStart.setHours(7,0,0,0);
  const comp=sp.comp.map(c=>({...c}));const id=n=>comp.find(c=>c.nome.startsWith(n))?.id;
  const sessions=[];
  for(let o=0;o<6;o++){
    const pair=[animais[o*2],animais[o*2+1]];
    const s={id:uid(),exemplo:true,expId:exp.id,nome:"Etograma 24 h · dia 50",especie:sp.nome,comp,observador:"Observador "+(o+1),animais:pair.map(a=>a.brinco),animalIds:pair.map(a=>a.id),inicio:sessStart.getTime(),intervalo:5,duracao:24,marks:{},obs:{}};
    pair.forEach((a,k)=>{const t=truth[a.id];const pE=t.eat/1440,pR=t.rum/1440,pW=.022,pI=Math.max(.05,1-pE-pR-pW);
      s.marks[k]={};s.obs[k]={};let st="Ócio";
      for(let i=0;i<288;i++){const h=(7+i*5/60)%24;
        let wE=pE*((h>=7&&h<9.5)||(h>=15&&h<17.5)?3.2:h<5||h>21?.35:1),wR=pR*(h<6||h>20?1.5:.85),wW=pW,wI=pI;
        if(r()>.72){const tot=wE+wR+wW+wI,x=r()*tot;st=x<wE?"Comendo":x<wE+wR?"Ruminando":x<wE+wR+wW?"Bebendo água":"Ócio"}
        const lying=(st==="Ruminando"||st==="Ócio")&&r()<(h<6||h>20?.75:.45);
        const m=[id(st),id(lying?"Deitada":"Em pé")];
        if(r()<.035)m.push(id("Defecando"));if(r()<.028)m.push(id("Urinando"));if(r()<.008)m.push(id("Se coçando"));
        s.marks[k][i]=m.filter(Boolean);}
    });
    sessions.push(s);
  }
  sessions[2].obs[1][40]="Se esfregou no cocho";
  return{exp,sessions};
}

/* ================= armazenamento ================= */
const KEYBAD="etograma.ilegivel"; // cópia de dados que não puderam ser lidos: nunca são sobrescritos sem aviso
let saveFailed=false;
function fresh(){const species=defaultSpecies();const ex=exampleData(species);return{v:2,species,experiments:[ex.exp],sessions:ex.sessions,active:ex.exp.id}}
function load(){
  let raw=null;try{raw=localStorage.getItem(KEY)}catch(e){}
  if(raw){
    try{const d=JSON.parse(raw);if(d&&d.v===2&&Array.isArray(d.experiments)&&Array.isArray(d.sessions))return d}catch(e){}
    // Não dá para ler (arquivo corrompido ou versão mais nova do app): guarda o original para recuperar em Ajustes.
    try{localStorage.setItem(KEYBAD,raw)}catch(e){}
  }
  const d=fresh();
  try{const raw=localStorage.getItem(KEY1);if(raw){const o=JSON.parse(raw);if(o&&o.species)d.species=o.species;if(o&&o.sessions)d.sessions.push(...o.sessions.filter(s=>!s.exemplo).map(s=>({...s,expId:null})))}}catch(e){}
  return d;
}
let db=load();
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(db));if(saveFailed){saveFailed=false;paintSaveBar()}return true}
  catch(e){saveFailed=true;paintSaveBar();return false}
}
try{if(!localStorage.getItem(KEY))save()}catch(e){}
function paintSaveBar(){const b=document.getElementById("saveErr");if(b)b.hidden=!saveFailed}
function badCopy(){try{return localStorage.getItem(KEYBAD)}catch(e){return null}}
// Outra aba (ou janela) salvou: recarrega daqui para não apagar o que foi marcado lá.
window.addEventListener("storage",ev=>{if(ev.key!==KEY||!ev.newValue)return;
  try{const d=JSON.parse(ev.newValue);if(!d||d.v!==2)return;db=d;if(!exp())db.active=db.experiments[0]?.id||null;render();toast("Atualizado com as mudanças de outra aba")}catch(e){}});
const exp=()=>db.experiments.find(e=>e.id===db.active)||null;
const gIndex=(e,gid)=>Math.max(0,e.grupos.findIndex(g=>g.id===gid));
const gColor=(e,gid)=>`var(--s${gIndex(e,gid)%4+1})`;

/* ================= cálculos (funções em js/data.js) ================= */
const performance=e=>Data.performance(e);
const sessionAnimalId=Data.sessionAnimalId;
const dataset=e=>Data.dataset(e,db.sessions);

/* ================= gráficos (SVG) ================= */
function cw(full){const cs=getComputedStyle(app);const inner=app.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);const col=full||inner<672?inner:(inner-16)/2;return Math.max(290,Math.min(full?1000:620,Math.round(col-42)))}
function hbars(rows,{max,unit="",fmtv=v=>fmt(v,2),markerLabel="meta"}={}){const W=cw(false);
  const lw=92,vw=78,bw=W-lw-vw-8,rh=30;max=max||Math.max(...rows.map(r=>Math.max(r.value||0,r.marker||0)),1);
  const H=rows.length*rh+8;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img">`;
  rows.forEach((r,i)=>{const y=i*rh+4,w=Math.max(0,(r.value||0)/max*bw);
    s+=`<text class="lbl" x="${lw-10}" y="${y+rh/2+4}" text-anchor="end">${esc(r.label)}</text>`;
    s+=`<rect x="${lw}" y="${y+7}" width="${bw}" height="${rh-14}" rx="4" fill="var(--surface-2)"/>`;
    if(isFinite(r.value))s+=`<rect x="${lw}" y="${y+7}" width="${w}" height="${rh-14}" rx="4" fill="${r.color}" data-tip="${esc(r.tip||"")}"/>`;
    if(isFinite(r.marker)){const mx=lw+r.marker/max*bw;s+=`<line x1="${mx}" x2="${mx}" y1="${y+3}" y2="${y+rh-3}" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" data-tip="${esc(markerLabel)}: ${fmtv(r.marker)} ${unit}"/>`}
    s+=`<text class="val" x="${W-4}" y="${y+rh/2+4}" text-anchor="end">${isFinite(r.value)?fmtv(r.value):"—"}</text>`;});
  return s+"</svg>";
}
function meanBars(desc,colors,unit){const W=cw(true);
  const H=250,ml=50,mr=10,mt=16,mb=40,pw=W-ml-mr,ph=H-mt-mb;
  const hi=Math.max(...desc.map(d=>d.media+(isFinite(d.ep)?d.ep:0)),0);const ticks=Stats.niceTicks(0,hi,4);const top=ticks[ticks.length-1]||1;
  const Y=v=>mt+ph-(v/top)*ph;const bw=Math.min(90,pw/desc.length*.55);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img"><g class="grid">`;
  ticks.forEach(t=>s+=`<line x1="${ml}" x2="${W-mr}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${ml-8}" y="${Y(t)+4}" text-anchor="end">${fmt(t,t<10?1:0)}</text>`);
  s+="</g>";
  desc.forEach((d,i)=>{const cx=ml+pw*(i+.5)/desc.length,x=cx-bw/2,y=Y(d.media);
    const tip=`${d.nome}\nMédia ${fmt(d.media,2)} ${unit}\nErro-padrão ±${fmt(d.ep,2)} · n = ${d.n}`;
    s+=`<path d="M${x},${Y(0)} V${y+4} q0,-4 4,-4 H${x+bw-4} q4,0 4,4 V${Y(0)} Z" fill="${colors[i]}" data-tip="${esc(tip)}"/>`;
    if(isFinite(d.ep)){const a=Y(d.media+d.ep),b=Y(Math.max(0,d.media-d.ep));s+=`<path d="M${cx},${a}V${b}M${cx-8},${a}H${cx+8}M${cx-8},${b}H${cx+8}" stroke="var(--ink)" stroke-width="1.6" fill="none"/>`}
    s+=`<text class="val" x="${cx}" y="${Y(d.media+(isFinite(d.ep)?d.ep:0))-8}" text-anchor="middle">${fmt(d.media,2)}</text>`;
    s+=`<text class="lbl" x="${cx}" y="${H-mb+20}" text-anchor="middle">${esc(d.nome)}</text>`;});
  s+=`<line class="axis" x1="${ml}" x2="${W-mr}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  return s+"</svg>";
}
function scatter(pts,reg,xl,yl){const W=cw(true);
  const H=330,ml=56,mr=14,mt=14,mb=46,pw=W-ml-mr,ph=H-mt-mb;
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const xt=Stats.niceTicks(Math.min(...xs),Math.max(...xs),5),yt=Stats.niceTicks(Math.min(...ys),Math.max(...ys),5);
  const x0=xt[0],x1=xt[xt.length-1],y0=yt[0],y1=yt[yt.length-1];
  const X=v=>ml+(v-x0)/(x1-x0||1)*pw,Y=v=>mt+ph-(v-y0)/(y1-y0||1)*ph;
  const dx=t=>fmt(t,Math.abs(x1-x0)<5?1:0),dy=t=>fmt(t,Math.abs(y1-y0)<5?1:0);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img"><g class="grid">`;
  yt.forEach(t=>s+=`<line x1="${ml}" x2="${W-mr}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${ml-8}" y="${Y(t)+4}" text-anchor="end">${dy(t)}</text>`);
  xt.forEach(t=>s+=`<text x="${X(t)}" y="${mt+ph+18}" text-anchor="middle">${dx(t)}</text>`);
  s+=`</g><line class="axis" x1="${ml}" x2="${W-mr}" y1="${mt+ph}" y2="${mt+ph}"/>`;
  s+=`<text class="lbl" x="${ml+pw/2}" y="${H-6}" text-anchor="middle">${esc(xl)}</text>`;
  s+=`<text class="lbl" transform="translate(14 ${mt+ph/2}) rotate(-90)" text-anchor="middle">${esc(yl)}</text>`;
  if(reg&&isFinite(reg.b)){const a=Math.min(...xs),b=Math.max(...xs);s+=`<line x1="${X(a)}" y1="${Y(reg.a+reg.b*a)}" x2="${X(b)}" y2="${Y(reg.a+reg.b*b)}" stroke="var(--ink-2)" stroke-width="2" stroke-dasharray="6 5"/>`}
  pts.forEach(p=>s+=`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="6.5" fill="${p.color}" stroke="var(--surface)" stroke-width="2" data-tip="${esc(p.tip)}"/>`);
  return s+"</svg>";
}
function lines(series,yl){const W=cw(false);
  const H=260,ml=50,mr=70,mt=14,mb=34,pw=W-ml-mr,ph=H-mt-mb;
  const all=series.flatMap(s=>s.pts);if(!all.length)return"";
  const xs=all.map(p=>p.x),ys=all.map(p=>p.y);const xa=Math.min(...xs),xb=Math.max(...xs);
  const yt=Stats.niceTicks(Math.min(...ys),Math.max(...ys),4),y0=yt[0],y1=yt[yt.length-1];
  const X=v=>ml+(v-xa)/((xb-xa)||1)*pw,Y=v=>mt+ph-(v-y0)/(y1-y0||1)*ph;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img"><g class="grid">`;
  yt.forEach(t=>s+=`<line x1="${ml}" x2="${ml+pw}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${ml-8}" y="${Y(t)+4}" text-anchor="end">${fmt(t,0)}</text>`);
  [...new Set(xs)].forEach(x=>s+=`<text x="${X(x)}" y="${mt+ph+20}" text-anchor="middle">dia ${x}</text>`);
  s+="</g>";
  series.forEach(se=>{const P=se.pts;s+=`<polyline points="${P.map(p=>X(p.x)+","+Y(p.y)).join(" ")}" fill="none" stroke="${se.color}" stroke-width="2.2" stroke-linejoin="round"/>`;
    P.forEach(p=>s+=`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="5" fill="${se.color}" stroke="var(--surface)" stroke-width="2" data-tip="${esc(se.name)} · dia ${p.x}\n${fmt(p.y,1)} ${yl}"/>`);
    const L=P[P.length-1];s+=`<text class="lbl" x="${X(L.x)+10}" y="${Y(L.y)+4}">${esc(se.name)}</text>`;});
  return s+"</svg>";
}
function heat(vars,M){const W=cw(true);
  const n=vars.length,lw=150,cell=Math.max(30,Math.min(46,(W-lw)/n)),H=n*cell+lw-40,Wd=lw+n*cell;
  const col=r=>{if(!isFinite(r))return"var(--surface-2)";const t=Math.min(1,Math.abs(r));return`color-mix(in srgb,${r<0?"var(--div-neg)":"var(--div-pos)"} ${Math.round(t*100)}%,var(--div-mid))`};
  let s=`<svg viewBox="0 0 ${Wd+4} ${H}" role="img" style="width:${Wd+4}px;max-width:none">`;
  vars.forEach((v,i)=>{s+=`<text class="lbl" x="${lw-8}" y="${lw-40+i*cell+cell/2+4}" text-anchor="end" style="font-size:11px">${esc(v.curto||v.nome)}</text>`;
    s+=`<text class="lbl" transform="translate(${lw+i*cell+cell/2+4} ${lw-48}) rotate(-50)" style="font-size:11px">${esc(v.curto||v.nome)}</text>`;});
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const r=M[i][j],x=lw+j*cell,y=lw-40+i*cell;
    s+=`<rect x="${x+1}" y="${y+1}" width="${cell-2}" height="${cell-2}" rx="4" fill="${col(r.r)}" data-heat="${i},${j}" data-tip="${esc(vars[i].nome)} × ${esc(vars[j].nome)}\nr = ${fmt(r.r,2)} · p = ${fmtP(r.p)}${i!==j?` · p corrigido = ${fmtP(r.q)}`:""}" style="cursor:pointer"/>`;
    if(i!==j&&isFinite(r.r))s+=`<text x="${x+cell/2}" y="${y+cell/2+4}" text-anchor="middle" style="font-size:10.5px;font-weight:600;fill:${Math.abs(r.r)>.55?"#fff":"var(--ink)"};pointer-events:none">${fmt(r.r,1)}${r.q<.05?"*":""}</text>`;}
  return s+"</svg>";
}
const BAND_COLORS=[["comendo","var(--s2)","Comendo"],["ruminando","var(--s1)","Ruminando"],["ocio","var(--s3)","Ócio"],["bebendo agua","var(--s4)","Bebendo água"]];
function bands(rowsData,interval){const W=cw(true);
  const lw=58,rh=20,gap=6,n=Math.max(...rowsData.map(r=>r.slots.length)),cwd=(W-lw)/n,H=rowsData.length*(rh+gap)+24;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img">`;
  rowsData.forEach((row,ri)=>{const y=ri*(rh+gap);s+=`<text class="lbl" x="${lw-10}" y="${y+rh/2+4}" text-anchor="end">${esc(row.label)}</text><rect x="${lw}" y="${y}" width="${W-lw}" height="${rh}" rx="4" fill="var(--surface-2)"/>`;
    let i=0;while(i<row.slots.length){const c=row.slots[i];let j=i;while(j+1<row.slots.length&&row.slots[j+1]===c)j++;
      if(c>=0){const b=BAND_COLORS[c];s+=`<rect x="${lw+i*cwd}" y="${y}" width="${(j-i+1)*cwd}" height="${rh}" fill="${b[1]}" data-tip="${esc(row.label)} · ${b[2]}\n${row.time(i)}–${row.time(j+1)} (${fmtDur((j-i+1)*interval)})"/>`}
      i=j+1;}});
  const yb=rowsData.length*(rh+gap)+12;
  for(let h=0;h<=24;h+=W<520?6:3){const x=lw+h*60/interval*cwd;s+=`<text x="${Math.min(x,W-14)}" y="${yb+4}" text-anchor="middle">${rowsData[0].time(h*60/interval)}</text>`}
  return s+"</svg>";
}

/* ================= casca e navegação ================= */
const TABS=[["inicio","Início","home"],["observar","Observar","obs"],["desempenho","Desempenho","perf"],["estatistica","Estatística","stats"],["visao","Visão IA","eye"]];
const TAB_OF={dash:"inicio",expForm:"inicio",obsHome:"observar",setup:"observar",sheet:"observar",summary:"observar",perf:"desempenho",entry:"desempenho",stats:"estatistica",vision:"visao",settings:"ajustes",species:"ajustes"};
const ROOT={inicio:{name:"dash"},observar:{name:"obsHome"},desempenho:{name:"perf"},estatistica:{name:"stats"},visao:{name:"vision"},ajustes:{name:"settings"}};
let view={name:"dash"},tick=null,wake=null,lastSlot=null,cleanup=[];
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];

document.getElementById("root").innerHTML=`
<div class="shell">
  <aside class="side">
    <div class="brand"><span class="mark"><svg viewBox="0 0 24 24"><path d="M4 7h3M9 7h3M14 7h6M4 12h8M14 12h2M18 12h2M4 17h2M8 17h9"/></svg></span>Etograma</div>
    <div class="expbox"><span class="eyebrow">Experimento</span><select id="expSelD" aria-label="Experimento ativo"></select></div>
    <nav id="navD">${TABS.map(t=>`<button data-tab="${t[0]}">${icon(t[2])}${t[1]}</button>`).join("")}</nav>
    <div class="foot"><nav><button data-tab="ajustes">${icon("gear")}Ajustes</button></nav></div>
  </aside>
  <div style="min-width:0;display:flex;flex-direction:column">
    <header class="topbar">
      <div class="brand"><span class="mark"><svg viewBox="0 0 24 24"><path d="M4 7h3M9 7h3M14 7h6M4 12h8M14 12h2M18 12h2M4 17h2M8 17h9"/></svg></span>Etograma</div>
      <div class="expsel"><select id="expSelM" aria-label="Experimento ativo"></select></div>
      <button class="iconbtn" data-tab="ajustes" aria-label="Ajustes">${icon("gear")}</button>
    </header>
    <div class="savebar" id="saveErr" role="alert" hidden>${icon("alert")}<span><b>As marcações não estão sendo salvas neste aparelho.</b> A memória do navegador pode estar cheia ou bloqueada (aba anônima). Não feche esta página: salve uma cópia agora.</span><button class="btn sm" id="saveErrBk">${icon("down")}Salvar cópia</button></div>
    <main id="app"></main>
  </div>
</div>
<nav class="tabbar" id="tabbar">${TABS.map(t=>`<button data-tab="${t[0]}"><span class="pip">${icon(t[2])}</span>${t[1]}</button>`).join("")}</nav>
<div class="toast" id="toast" hidden></div><div class="tip" id="tip" hidden></div>`;
const app=$("#app");
$("#saveErrBk").onclick=()=>saveFile(`etograma-copia-${isoDay(new Date())}.json`,JSON.stringify(db),"application/json");

$$("[data-tab]").forEach(b=>b.onclick=()=>go(ROOT[b.dataset.tab]));
["#expSelD","#expSelM"].forEach(id=>$(id).onchange=e=>{if(e.target.value==="__new")return go({name:"expForm"});db.active=e.target.value;save();render()});

function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2400)}
function go(v){view=v;render();window.scrollTo(0,0)}
function renderChrome(){
  const tab=TAB_OF[view.name];
  $$("[data-tab]").forEach(b=>b.dataset.tab===tab?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current"));
  const opts=db.experiments.map(e=>`<option value="${e.id}"${e.id===db.active?" selected":""}>${esc(e.nome)}${e.exemplo?" (exemplo)":""}</option>`).join("")+`<option value="__new">+ Novo experimento</option>`;
  const none=db.experiments.length?"":`<option value="" selected>Nenhum experimento</option>`;
  $("#expSelD").innerHTML=none+opts;$("#expSelM").innerHTML=none+opts;
}
function render(){
  clearInterval(tick);tick=null;cleanup.forEach(f=>{try{f()}catch(e){}});cleanup=[];
  if(view.name!=="sheet"&&wake){try{wake.release()}catch(e){}wake=null}
  renderChrome();
  (VIEWS[view.name]||VIEWS.dash)();
}
const pageHead=(eyebrow,title,sub,actions,back)=>`<div class="page-h">${back?`<button class="crumb" data-back>${icon("back")}${esc(back)}</button>`:""}<span class="eyebrow">${eyebrow}</span><h1>${title}</h1>${sub?`<p class="ink2" style="max-width:62ch">${sub}</p>`:""}${actions?`<div class="row">${actions}</div>`:""}</div>`;
function wireBack(to){const b=$("[data-back]",app);if(b)b.onclick=()=>go(to)}
const statusPill=st=>({acima:`<span class="pill good">${icon("arrowUp")}Acima</span>`,ok:`<span class="pill good">${icon("check")}No esperado</span>`,abaixo:`<span class="pill bad">${icon("arrowDown")}Abaixo</span>`,sem:`<span class="pill neutral">${icon("minus")}Sem dados</span>`})[st];
const needExp=()=>`<div class="card"><div class="empty"><h3>Nenhum experimento ativo</h3><p>Crie um experimento para lançar animais, dietas, pesagens e observações.</p><button class="btn primary" id="mkExp">${icon("plus")}Criar experimento</button></div></div>`;
function wireNeedExp(){const b=$("#mkExp",app);if(b)b.onclick=()=>go({name:"expForm"})}

/* ================= INÍCIO ================= */
const VIEWS={};
VIEWS.dash=function(){
  const e=exp();
  if(!e){app.innerHTML=pageHead("Início","Bem-vindo ao Etograma","Registre comportamento, peso e consumo dos animais e veja na hora se o desempenho está dentro do esperado.")+needExp();return wireNeedExp()}
  const P=performance(e),dia=dayDiff(e.inicio,isoDay(new Date()))+1;
  const gm=P.map(p=>p.gmd).filter(isFinite),abaixo=P.filter(p=>p.status==="abaixo");
  const sess=db.sessions.filter(s=>s.expId===e.id);
  const lastP=[...e.pesagens].sort((a,b)=>a.data<b.data?1:-1)[0];
  app.innerHTML=`
  <section class="hero">
    <div class="stack" style="gap:8px"><span class="eyebrow">${esc(e.especie)} · ${e.grupos.map(g=>esc(g.nome)).join(" vs ")}${e.exemplo?" · dados de exemplo":""}</span><h1>${esc(e.nome)}</h1></div>
    <div class="facts">
      <div><b class="tnum">Dia ${Math.max(dia,1)}</b><span>início ${dmy(parseDay(e.inicio))}</span></div>
      <div><b class="tnum">${e.animais.length}</b><span>animais</span></div>
      <div><b class="tnum">${e.grupos.length}</b><span>tratamentos</span></div>
      <div><b>${esc(e.responsavel||"—")}</b><span>responsável</span></div>
    </div>
    <div class="row"><button class="btn" data-go="setup">${icon("obs")}Nova observação</button><button class="btn ghost" data-go="peso">${icon("perf")}Lançar pesagem</button><button class="btn ghost" data-go="edit">Editar experimento</button></div>
  </section>
  <div class="grid g4" style="margin-top:16px">
    <div class="kpi"><span class="l">GMD médio do lote</span><span class="v num">${fmt(gm.length?Stats.mean(gm):NaN,2)}<small>kg/dia</small></span></div>
    <div class="kpi"><span class="l">Abaixo do esperado</span><span class="v num" style="color:${abaixo.length?"var(--bad)":"var(--good)"}">${abaixo.length}<small>de ${P.length}</small></span></div>
    <div class="kpi"><span class="l">Observações de comportamento</span><span class="v num">${sess.length}<small>registros</small></span></div>
    <div class="kpi"><span class="l">Última pesagem</span><span class="v num" style="font-size:1.5rem">${lastP?dmy(parseDay(lastP.data)):"—"}</span></div>
  </div>
  <div class="grid g2" style="margin-top:16px">
    <section class="card">
      <div class="card-h"><div><h3>Precisam de atenção</h3><p>Ganho de peso abaixo de 90% da meta do tratamento.</p></div><button class="btn sm" data-go="perf">Ver desempenho</button></div>
      ${abaixo.length?`<div class="list">${abaixo.map(p=>`<div class="item"><span class="dot" style="background:${gColor(e,p.grupoId)}"></span><div class="grow"><div class="title">Animal ${esc(p.brinco)} <span class="muted" style="font-weight:500">· ${esc(p.grupo)}</span></div><div class="sub">GMD ${fmt(p.gmd,2)} kg/dia · meta ${fmt(p.meta,2)} (${fmt(p.ratio*100,0)}%)</div></div>${statusPill("abaixo")}</div>`).join("")}</div>`
      :`<div class="callout">${icon("check")}<span>${gm.length?"Todos os animais estão dentro ou acima da meta de ganho.":"Lance pelo menos duas pesagens para calcular o ganho de peso."}</span></div>`}
    </section>
    <section class="card">
      <div class="card-h"><div><h3>GMD por tratamento</h3><p>Média ± erro-padrão, com a meta de cada dieta.</p></div></div>
      <div class="viz">${hbars(e.grupos.map((g,i)=>{const v=P.filter(p=>p.grupoId===g.id).map(p=>p.gmd).filter(isFinite);const m=v.length?Stats.mean(v):NaN;return{label:g.nome,value:m,marker:+g.gmdMeta,color:`var(--s${i%4+1})`,tip:`${g.nome}: ${fmt(m,2)} kg/dia (n = ${v.length})`}}),{unit:"kg/dia",markerLabel:"Meta"})}</div>
      <div class="legend"><span><svg width="14" height="14"><line x1="7" x2="7" y1="1" y2="13" stroke="var(--ink)" stroke-width="2"/></svg>Meta de GMD</span></div>
    </section>
  </div>
  ${ethogramCard(e)}
  <section class="stack" style="margin-top:22px">
    <div class="spread"><h2>Experimentos</h2><button class="btn sm" data-go="new">${icon("plus")}Novo experimento</button></div>
    <div class="list">${db.experiments.map(x=>`<div class="item"><div class="grow"><div class="title">${esc(x.nome)} ${x.exemplo?'<span class="tag">exemplo</span>':""}</div><div class="sub">${esc(x.especie)} · ${x.animais.length} animais · início ${dmy(parseDay(x.inicio))}</div></div>${x.id===db.active?'<span class="pill neutral">Ativo</span>':`<button class="btn sm" data-act="${x.id}">Abrir</button>`}</div>`).join("")}</div>
  </section>`;
  $$("[data-go]",app).forEach(b=>b.onclick=()=>{const g=b.dataset.go;go(g==="setup"?{name:"setup",sp:e.especieId}:g==="peso"?{name:"entry",kind:"peso"}:g==="edit"?{name:"expForm",id:e.id}:g==="new"?{name:"expForm"}:{name:"perf"})});
  $$("[data-act]",app).forEach(b=>b.onclick=()=>{db.active=b.dataset.act;save();render()});
};
function ethogramCard(e){
  const sess=db.sessions.filter(s=>s.expId===e.id&&s.comp.some(c=>BAND_COLORS.some(b=>b[0]===norm(c.nome))));
  if(!sess.length)return"";
  const latestDay=Math.max(...sess.map(s=>parseDay(isoDay(new Date(s.inicio))).getTime()));
  const S=sess.filter(s=>parseDay(isoDay(new Date(s.inicio))).getTime()===latestDay);
  const rows=[];
  S.forEach(s=>s.animais.forEach((nm,k)=>{const M=s.marks[k]||{};const n=Math.round(s.duracao*60/s.intervalo);const slots=[];
    for(let i=0;i<n;i++){const arr=(M[i]||[]).map(cid=>norm((s.comp.find(c=>c.id===cid)||{}).nome));slots.push(BAND_COLORS.findIndex(b=>arr.includes(b[0])))}
    const aid=sessionAnimalId(e,s,k);const a=e.animais.find(x=>x.id===aid);
    rows.push({label:a?a.brinco:nm,g:a?gIndex(e,a.grupoId):99,slots,time:i=>hhmm(new Date(s.inicio+i*s.intervalo*60000))});}));
  rows.sort((a,b)=>a.g-b.g||a.label.localeCompare(b.label,undefined,{numeric:true}));
  const iv=S[0].intervalo;
  return`<section class="card" style="margin-top:16px">
    <div class="card-h"><div><h3>Orçamento de tempo · 24 h</h3><p>Cada faixa é um animal; cada traço, uma marcação de ${iv} min. Registro de ${dmy(new Date(S[0].inicio))}.</p></div><button class="btn sm" id="toObs">Abrir registros</button></div>
    <div class="viz">${bands(rows.slice(0,16),iv)}</div>
    <div class="legend">${BAND_COLORS.map(b=>`<span><i class="dot" style="background:${b[1]}"></i>${b[2]}</span>`).join("")}<span><i class="dot" style="background:var(--surface-2);border:1px solid var(--line-2)"></i>Outro / sem marcação</span></div>
  </section>`;
}
document.addEventListener("click",e=>{if(e.target.closest("#toObs"))go({name:"obsHome"})});

/* ================= EXPERIMENTO (criar/editar) ================= */
VIEWS.expForm=function(){
  const ed=view.id?db.experiments.find(x=>x.id===view.id):null;
  const grupos=ed?ed.grupos:[{id:uid(),nome:"Dieta A",dieta:"",gmdMeta:1.2},{id:uid(),nome:"Dieta B",dieta:"",gmdMeta:1.0}];
  // O animal tem dados se já foi pesado, teve consumo lançado ou aparece numa observação.
  const hasData=aid=>!!ed&&(ed.pesagens.some(p=>isFinite(p.pesos[aid]))||ed.consumo.some(c=>isFinite(c.valores[aid]))||db.sessions.some(s=>s.expId===ed.id&&(s.animalIds||[]).includes(aid)));
  app.innerHTML=pageHead(ed?"Editar experimento":"Novo experimento",ed?esc(ed.nome):"Configure o experimento","Cada tratamento (dieta) tem a sua meta de ganho de peso. É ela que o app usa para dizer se cada animal está no esperado.",null,"Início")+`
  <form class="form" id="f">
    <div class="card">
      <div class="fields">
        <label class="f">Nome<input type="text" id="xNome" value="${esc(ed?.nome||"")}" placeholder="Ex.: Confinamento Nelore 2026" required></label>
        <label class="f">Espécie<select id="xSp">${db.species.map(s=>`<option value="${s.id}"${(ed?.especieId||"vaca")===s.id?" selected":""}>${esc(s.nome)}</option>`).join("")}</select></label>
        <label class="f">Responsável<input type="text" id="xResp" value="${esc(ed?.responsavel||"")}" placeholder="Quem conduz"></label>
        <label class="f">Data de início<input type="date" id="xIni" value="${ed?.inicio||isoDay(new Date())}" required></label>
      </div>
    </div>
    <div class="spread"><h2>Tratamentos</h2><button type="button" class="btn sm" id="addG">${icon("plus")}Tratamento</button></div>
    <div id="gs" class="grid g2"></div>
    <div class="spread"><h2>Animais <span class="muted num" id="anN"></span></h2></div>
    <div class="card">
      <div class="fields">
        <label class="f">Adicionar animais <span class="hint">brincos separados por vírgula</span><input type="text" id="newB" placeholder="01, 03, 05, 07" autocomplete="off"></label>
        <label class="f">No tratamento<select id="newG"></select></label>
        <div class="row" style="align-self:end"><button type="button" class="btn" id="addA">${icon("plus")}Adicionar</button></div>
      </div>
      <div class="anlist" id="an"></div>
      <p class="note">Corrigir um brinco ou trocar o tratamento aqui mantém as pesagens, o consumo e as observações do animal.</p>
    </div>
    <div class="row"><button class="btn primary" type="submit">${ed?"Salvar alterações":"Criar experimento"}</button>${ed?`<button type="button" class="btn quiet danger" id="delX">Apagar experimento</button>`:""}</div>
  </form>`;
  wireBack({name:"dash"});
  const gs=$("#gs",app),an=$("#an",app),newB=$("#newB",app),newG=$("#newG",app);
  const groups=()=>$$("[data-gid]",gs).map(c=>({id:c.dataset.gid,nome:$('[data-k="nome"]',c).value.trim()||"Tratamento"}));
  const opts=sel=>groups().map(g=>`<option value="${g.id}"${g.id===sel?" selected":""}>${esc(g.nome)}</option>`).join("");
  const rows=()=>$$("[data-aid]",an);
  function refresh(){
    $$("select[data-g]",an).forEach(s=>{const v=s.value;s.innerHTML=opts(v)});newG.innerHTML=opts(newG.value);
    const ids=groups().map(g=>g.id);rows().forEach(r=>{const i=ids.indexOf($("[data-g]",r).value);$(".dot",r).style.background=`var(--s${Math.max(0,i)%4+1})`});
    const n=rows().length;$("#anN",app).textContent=n?`· ${n}`:"";
    const empty=$("[data-empty]",an);
    if(!n&&!empty)an.insertAdjacentHTML("beforeend",`<p class="note" data-empty>Nenhum animal ainda. Digite os brincos acima e toque em Adicionar.</p>`);
    if(n&&empty)empty.remove();
  }
  function addG(g){const c=document.createElement("div");c.className="card";c.dataset.gid=g.id;
    c.innerHTML=`<div class="fields"><label class="f">Tratamento<input type="text" data-k="nome" value="${esc(g.nome)}"></label><label class="f">Descrição da dieta<input type="text" data-k="dieta" value="${esc(g.dieta||"")}" placeholder="Ex.: 80% concentrado"></label><label class="f">Meta de GMD <span class="hint">kg/dia esperado</span><input type="number" step="0.01" min="0" inputmode="decimal" data-k="gmdMeta" value="${g.gmdMeta}"></label></div>
    <div><button type="button" class="btn sm quiet danger" data-rm>Remover tratamento</button></div>`;
    $('[data-k="nome"]',c).addEventListener("input",refresh);
    $("[data-rm]",c).onclick=()=>{if(gs.children.length<2)return toast("O experimento precisa de pelo menos um tratamento");
      if(rows().some(r=>$("[data-g]",r).value===g.id))return toast("Mova ou remova os animais deste tratamento antes");
      c.remove();refresh()};
    gs.appendChild(c)}
  function addRow(a){const r=document.createElement("div");r.className="beh";r.dataset.aid=a.id;
    r.innerHTML=`<label class="anb"><i class="dot"></i><input type="text" data-b value="${esc(a.brinco)}" aria-label="Brinco"></label><select data-g aria-label="Tratamento do animal">${opts(a.grupoId)}</select><button type="button" class="btn sm quiet danger" aria-label="Remover animal ${esc(a.brinco)}">${icon("x")}</button>`;
    $("[data-g]",r).onchange=refresh;
    $("button",r).onclick=ev=>{const b=ev.currentTarget;
      if(hasData(a.id)&&!b.dataset.armed){b.dataset.armed=1;b.textContent="Apagar?";b.setAttribute("aria-label","Confirmar: remover o animal e apagar as pesagens e o consumo dele");return}
      r.remove();refresh()};
    an.appendChild(r)}
  function addFromInput(){const list=newB.value.split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);if(!list.length)return;
    const have=new Set(rows().map(r=>norm($("[data-b]",r).value)));const dup=[];
    list.forEach(b=>{if(have.has(norm(b))){dup.push(b);return}have.add(norm(b));addRow({id:uid(),brinco:b,grupoId:newG.value})});
    newB.value="";refresh();if(dup.length)toast(`Já estava na lista: ${dup.join(", ")}`)}
  grupos.forEach(addG);
  (ed?ed.animais:[]).forEach(addRow);refresh();
  $("#addG",app).onclick=()=>{addG({id:uid(),nome:"Dieta "+String.fromCharCode(65+gs.children.length),dieta:"",gmdMeta:1});refresh()};
  $("#addA",app).onclick=()=>{addFromInput();newB.focus()};
  newB.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();addFromInput()}});
  if(ed)$("#delX",app).onclick=ev=>{const b=ev.currentTarget;if(!b.dataset.armed){b.dataset.armed=1;b.textContent="Confirmar: apagar experimento e seus registros?";return}
    db.experiments=db.experiments.filter(x=>x!==ed);db.sessions=db.sessions.filter(s=>s.expId!==ed.id);db.active=db.experiments[0]?.id||null;save();toast("Experimento apagado");go({name:"dash"})};
  $("#f",app).onsubmit=ev=>{ev.preventDefault();
    addFromInput(); // brincos digitados sem tocar em Adicionar também entram
    const sp=db.species.find(s=>s.id===$("#xSp",app).value);
    const G=$$("[data-gid]",gs).map(c=>({id:c.dataset.gid,nome:$('[data-k="nome"]',c).value.trim()||"Tratamento",dieta:$('[data-k="dieta"]',c).value.trim(),gmdMeta:parseFloat(String($('[data-k="gmdMeta"]',c).value).replace(",","."))||0}));
    const A=rows().map(r=>({id:r.dataset.aid,brinco:$("[data-b]",r).value.trim(),grupoId:$("[data-g]",r).value}));
    if(!A.length){toast("Adicione pelo menos um animal");return}
    if(A.some(a=>!a.brinco)){toast("Há um animal sem brinco");return}
    const seen=new Set(),rep=A.find(a=>{const k=norm(a.brinco);if(seen.has(k))return true;seen.add(k);return false});
    if(rep){toast(`Brinco repetido: ${rep.brinco}`);return}
    const data={nome:$("#xNome",app).value.trim()||"Experimento",especieId:sp.id,especie:sp.nome,responsavel:$("#xResp",app).value.trim(),inicio:$("#xIni",app).value,grupos:G,animais:A};
    if(ed){const keep=new Set(A.map(a=>a.id)),gone=ed.animais.filter(a=>!keep.has(a.id)).map(a=>a.id);
      ed.pesagens.forEach(p=>gone.forEach(id=>delete p.pesos[id]));ed.consumo.forEach(c=>gone.forEach(id=>delete c.valores[id]));
      Object.assign(ed,data)}
    else{const x={id:uid(),...data,pesagens:[],consumo:[]};db.experiments.push(x);db.active=x.id}
    save();toast(ed?"Experimento salvo":"Experimento criado");go({name:"dash"});
  };
};

/* ================= OBSERVAR ================= */
function currentSlot(s){const i=Math.floor((Date.now()-s.inicio)/(s.intervalo*60000));return(i>=0&&i<nSlots(s))?i:null}
function filledCount(s){let n=0;for(const a in s.marks)for(const i in s.marks[a])if(s.marks[a][i].length)n++;return n}

VIEWS.obsHome=function(){
  const e=exp();
  const mine=db.sessions.filter(s=>e?s.expId===e.id:false).sort((a,b)=>b.inicio-a.inicio);
  const loose=db.sessions.filter(s=>!s.expId).sort((a,b)=>b.inicio-a.inicio);
  const list=arr=>arr.length?`<div class="list">${arr.map(s=>{const tot=nSlots(s)*s.animais.length,f=filledCount(s);return`<div class="item">
      <div class="grow stack" style="gap:6px"><div><div class="title">${esc(s.nome)} <span class="muted" style="font-weight:500">· ${esc(s.observador||"sem observador")}</span></div>
      <div class="sub">${esc(s.especie)} · animais ${esc(s.animais.join(", "))} · ${dmy(new Date(s.inicio))} às ${hhmm(new Date(s.inicio))} · a cada ${s.intervalo} min</div></div>
      <div class="progress" title="${f} de ${tot} marcações"><span style="width:${Math.round(100*f/Math.max(tot,1))}%"></span></div></div>
      <button class="btn sm" data-open="${s.id}">Abrir</button><button class="btn sm quiet danger" data-del="${s.id}">Apagar</button></div>`}).join("")}</div>`:"";
  app.innerHTML=pageHead("Observar","Análise comportamental","Escolha o animal, marque o que ele está fazendo a cada intervalo e acompanhe a planilha se formando.")+`
  ${e?`<section class="card" style="margin-bottom:18px"><div class="card-h"><div><h3>Nova observação em ${esc(e.nome)}</h3><p>${esc(e.especie)} · ${e.animais.length} animais do experimento</p></div><button class="btn primary" id="newExpObs">${icon("plus")}Começar</button></div></section>`:""}
  <section class="stack" style="margin-bottom:22px"><h3>Observação avulsa</h3><p class="note" style="margin-top:-6px">Sem vínculo com experimento: escolha o animal.</p>
    <div class="species">${db.species.map(s=>`<button class="sp" data-sp="${esc(s.id)}"><span class="gl" aria-hidden="true">${esc(s.nome.charAt(0))}</span><span class="name">${esc(s.nome)}</span><span class="meta">${s.comp.length} comportamentos</span></button>`).join("")}</div>
  </section>
  <section class="stack">
    <h2>Registros${e?` · ${esc(e.nome)}`:""}</h2>
    ${list(mine)||`<div class="list"><div class="empty">Nenhuma observação neste experimento ainda.</div></div>`}
    ${loose.length?`<h3 style="margin-top:10px">Avulsas</h3>${list(loose)}`:""}
    <p class="note">Os registros ficam salvos neste aparelho. Para juntar o trabalho de vários observadores, cada um exporta a planilha e você importa em Ajustes.</p>
  </section>`;
  if(e)$("#newExpObs",app).onclick=()=>go({name:"setup",sp:e.especieId,exp:true});
  $$("[data-sp]",app).forEach(b=>b.onclick=()=>go({name:"setup",sp:b.dataset.sp,exp:false}));
  $$("[data-open]",app).forEach(b=>b.onclick=()=>go({name:"sheet",id:b.dataset.open,animal:0}));
  $$("[data-del]",app).forEach(b=>b.onclick=()=>{if(b.dataset.armed){db.sessions=db.sessions.filter(s=>s.id!==b.dataset.del);save();render();toast("Observação apagada")}else{b.dataset.armed=1;b.textContent="Confirmar?"}});
};

VIEWS.setup=function(){
  const e=view.exp!==false?exp():null;
  const sp=db.species.find(s=>s.id===view.sp)||db.species.find(s=>s.id===e?.especieId)||db.species[0];
  if(!sp)return go({name:"obsHome"});
  const now=new Date();now.setMinutes(Math.ceil(now.getMinutes()/5)*5,0,0);
  app.innerHTML=pageHead(`${esc(sp.nome)} · nova observação`,"Configurar a observação",e?`Vinculada a <b>${esc(e.nome)}</b>. Marque os animais que você vai vigiar.`:"Observação avulsa.",null,"Observar")+`
  <form class="form" id="f"><div class="card">
    <div class="fields">
      <label class="f">Nome<input type="text" id="nome" value="${e?"Etograma 24 h":"Observação"}"></label>
      <label class="f">Observador<input type="text" id="obsr" placeholder="Seu nome"></label>
      <label class="f">Data de início<input type="date" id="data" value="${isoDay(now)}" required></label>
      <label class="f">Hora de início<input type="time" id="hora" value="${hhmm(now)}" required></label>
      <label class="f">Intervalo entre marcações<select id="int">${[1,2,5,10,15,30].map(v=>`<option value="${v}"${v===5?" selected":""}>${v} min</option>`).join("")}</select></label>
      <label class="f">Duração<select id="dur">${[1,2,4,6,8,12,24,48].map(v=>`<option value="${v}"${v===24?" selected":""}>${v} h</option>`).join("")}</select></label>
    </div>
    <div class="stack" style="gap:8px"><span style="font-weight:600;font-size:.86rem;color:var(--ink-2)">Animais que você vai vigiar</span>
      ${e?`<div class="checks">${e.animais.map(a=>`<label class="check"><input type="checkbox" value="${a.id}"><span>${esc(a.brinco)}</span><i class="dot" style="background:${gColor(e,a.grupoId)}" title="${esc(grupo(e,a.grupoId)?.nome||"")}"></i></label>`).join("")}</div>
      <div class="legend">${e.grupos.map((g,i)=>`<span><i class="dot" style="background:var(--s${i%4+1})"></i>${esc(g.nome)}</span>`).join("")}</div>`
      :`<div class="stack" id="animals" style="gap:8px"></div><div><button type="button" class="btn sm quiet" id="addA">${icon("plus")}Adicionar animal</button></div>`}
    </div>
    <p class="note" id="calc"></p>
  </div>
  <div class="row"><button class="btn primary" type="submit">Começar observação</button></div></form>`;
  wireBack({name:"obsHome"});
  const box=$("#animals",app);
  const count=()=>e?$$(".checks input:checked",app).length:box.children.length;
  const calc=()=>{const i=+$("#int",app).value,h=+$("#dur",app).value,n=count(),k=Math.round(h*60/i);$("#calc",app).textContent=`${k} marcações por animal${n?` · ${k*n} no total para ${n} animal(is)`:""}.`};
  if(!e){const addRow=v=>{const r=document.createElement("div");r.className="row";r.style.flexWrap="nowrap";const id="an"+uid();r.innerHTML=`<input type="text" id="${id}" aria-label="Animal" value="${esc(v)}" style="flex:1;min-width:0"><button type="button" class="btn sm quiet danger" aria-label="Remover animal">${icon("x")}</button>`;$("button",r).onclick=()=>{if(box.children.length>1){r.remove();calc()}};box.appendChild(r);calc()};
    addRow(sp.nome+" 1");addRow(sp.nome+" 2");$("#addA",app).onclick=()=>addRow(sp.nome+" "+(box.children.length+1));}
  else $$(".checks input",app).forEach(c=>c.onchange=calc);
  $("#int",app).onchange=calc;$("#dur",app).onchange=calc;calc();
  $("#f",app).onsubmit=ev=>{ev.preventDefault();
    let animais,animalIds=null;
    if(e){const ids=$$(".checks input:checked",app).map(c=>c.value);animalIds=ids;animais=ids.map(id=>e.animais.find(a=>a.id===id).brinco)}
    else animais=$$("input",box).map(i=>i.value.trim()).filter(Boolean);
    if(!animais.length){toast("Escolha pelo menos um animal");return}
    const[Y,M,D]=$("#data",app).value.split("-").map(Number),[h,mi]=$("#hora",app).value.split(":").map(Number);
    const s={id:uid(),expId:e?e.id:null,nome:$("#nome",app).value.trim()||"Observação",especie:sp.nome,comp:sp.comp.map(c=>({...c})),observador:$("#obsr",app).value.trim(),animais,animalIds,inicio:new Date(Y,M-1,D,h,mi).getTime(),intervalo:+$("#int",app).value,duracao:+$("#dur",app).value,marks:{},obs:{}};
    animais.forEach((_,i)=>{s.marks[i]={};s.obs[i]={}});db.sessions.push(s);save();go({name:"sheet",id:s.id,animal:0});
  };
};

VIEWS.sheet=function(){
  const s=db.sessions.find(x=>x.id===view.id);if(!s)return go({name:"obsHome"});
  const a=Math.min(view.animal||0,s.animais.length-1);
  const comuns=s.comp.filter(c=>c.tipo!=="raro"),raros=s.comp.filter(c=>c.tipo==="raro"),cols=[...comuns,...raros];
  const cur=currentSlot(s);const focus=view.slot!=null?view.slot:(cur!=null?cur:0);
  const e=s.expId?db.experiments.find(x=>x.id===s.expId):null;
  app.innerHTML=pageHead(`${esc(s.especie)} · ${esc(s.observador||"sem observador")} · a cada ${s.intervalo} min`,esc(s.nome),e?`Experimento ${esc(e.nome)}`:"",`<button class="btn sm" id="sum">Resumo</button><button class="btn sm" id="exp">${icon("down")}Exportar planilha</button><button class="btn sm" id="vis">${icon("eye")}Preencher com IA</button>`,"Observar")+`
  <div class="stack-lg">
  <div class="tabs" role="tablist">${s.animais.map((n,i)=>`<button class="tab" role="tab" aria-selected="${i===a}" data-a="${i}">${esc(n)}</button>`).join("")}</div>
  <section class="now" aria-live="polite">
    <div class="spread">
      <div><div class="sub-h" id="slotLabel"></div><div class="clock" id="slotTime"></div></div>
      <div class="stack" style="align-items:flex-end;gap:8px"><div class="countdown" id="cd"></div>
        <div class="row"><button class="btn sm" id="prev" aria-label="Horário anterior">${icon("back")}</button><button class="btn sm" id="goNow">Agora</button><button class="btn sm" id="next" aria-label="Próximo horário"><svg class="i" viewBox="0 0 24 24" style="transform:scaleX(-1)">${IC.back}</svg></button></div></div>
    </div>
    <div class="sub-h">O que ${esc(s.animais[a])} está fazendo?</div>
    <div class="chips" id="chips"></div>
    <input type="text" id="obsNow" placeholder="Observação deste horário (opcional)" aria-label="Observação deste horário">
    <p class="note">Deixe esta tela aberta: ela não apaga sozinha, mas se você trocar de app ou bloquear o celular, o aviso de vibração do próximo horário não toca.</p>
  </section>
  <section class="stack">
    <div class="spread"><h2>Planilha · ${esc(s.animais[a])}</h2><span class="note">Toque numa célula para marcar ou desmarcar</span></div>
    <div class="sheetbox" id="sheetbox"><table class="sheet"><thead><tr><th class="time">Hora</th>${cols.map(c=>`<th class="${c.tipo==="raro"?"rare":""}" scope="col">${esc(c.nome)}</th>`).join("")}<th scope="col" style="width:auto;text-align:left;padding-left:10px">Observação</th></tr></thead><tbody id="tb"></tbody></table></div>
  </section></div>`;
  wireBack({name:"obsHome"});
  const tb=$("#tb",app);let html="",lastDay="";
  for(let i=0;i<nSlots(s);i++){const d=slotDate(s,i),day=dmy(d);
    if(day!==lastDay){html+=`<tr class="day"><td colspan="${cols.length+2}">${day}</td></tr>`;lastDay=day}
    const mk=marked(s,a,i);
    html+=`<tr data-i="${i}"${i===cur?' class="isnow"':""}><th class="time" scope="row">${hhmm(d)}</th>${cols.map(c=>{const on=mk.includes(c.id);return`<td class="cell${c.tipo==="raro"?" rare":""}${on?" on":""}"><button data-c="${c.id}" aria-label="${esc(c.nome)} às ${hhmm(d)}" aria-pressed="${on}">${on?"X":""}</button></td>`}).join("")}<td class="obs"><input type="text" data-o="${i}" value="${esc((s.obs[a]||{})[i]||"")}" aria-label="Observação às ${hhmm(d)}"></td></tr>`;}
  tb.innerHTML=html;
  function toggle(i,cid){s.marks[a]=s.marks[a]||{};const arr=s.marks[a][i]||[];s.marks[a][i]=arr.includes(cid)?arr.filter(x=>x!==cid):[...arr,cid];if(!s.marks[a][i].length)delete s.marks[a][i];save();paintRow(i);if(i===view.slot)paintChips()}
  function paintRow(i){const tr=tb.querySelector(`tr[data-i="${i}"]`);if(!tr)return;const mk=marked(s,a,i);$$("button[data-c]",tr).forEach(b=>{const on=mk.includes(b.dataset.c);b.textContent=on?"X":"";b.setAttribute("aria-pressed",on);b.parentElement.classList.toggle("on",on)})}
  function paintChips(){const i=view.slot,mk=marked(s,a,i),d=slotDate(s,i);
    $("#slotTime",app).textContent=hhmm(d);$("#slotLabel",app).textContent=(i===currentSlot(s)?"Marcação de agora":"Marcação")+` · ${i+1} de ${nSlots(s)} · ${dmy(d)}`;
    const ch=c=>{const on=mk.includes(c.id);return`<button class="chip${c.tipo==="raro"?" rare":""}" aria-pressed="${on}" data-c="${c.id}"><span class="box">${on?"X":""}</span>${esc(c.nome)}</button>`};
    $("#chips",app).innerHTML=comuns.map(ch).join("")+(raros.length?`<div class="sub-h" style="grid-column:1/-1;margin-top:4px">Fora do comum</div>`+raros.map(ch).join(""):"");
    $("#obsNow",app).value=(s.obs[a]||{})[i]||"";}
  function setSlot(i,scroll){view.slot=Math.max(0,Math.min(nSlots(s)-1,i));paintChips();
    if(scroll){const tr=tb.querySelector(`tr[data-i="${view.slot}"]`),box=$("#sheetbox",app);if(tr)box.scrollTop=tr.offsetTop-box.clientHeight/2}}
  function updateClock(){const c=currentSlot(s),el=$("#cd",app);if(!el)return;
    $$("tr.isnow",tb).forEach(r=>{if(+r.dataset.i!==c)r.classList.remove("isnow")});if(c!=null){const tr=tb.querySelector(`tr[data-i="${c}"]`);if(tr)tr.classList.add("isnow")}
    if(Date.now()<s.inicio){const ms=s.inicio-Date.now();el.textContent="Começa em "+Math.floor(ms/60000)+" min "+pad(Math.floor(ms/1000)%60)+" s";el.classList.remove("due")}
    else if(c==null){el.textContent="Período de observação encerrado";el.classList.remove("due")}
    else{const ms=s.inicio+(c+1)*s.intervalo*60000-Date.now(),done=marked(s,a,c).length>0;
      el.textContent=done?`Próxima marcação em ${Math.floor(ms/60000)}:${pad(Math.floor(ms/1000)%60)}`:`Marque o horário ${hhmm(slotDate(s,c))}`;el.classList.toggle("due",!done);
      if(lastSlot!=null&&lastSlot!==c){try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(err){}if(view.slot===lastSlot)setSlot(c,true)}lastSlot=c}}
  tb.addEventListener("click",ev=>{const b=ev.target.closest("button[data-c]");if(!b)return;const i=+b.closest("tr").dataset.i;toggle(i,b.dataset.c);if(view.slot!==i)setSlot(i,false)});
  tb.addEventListener("change",ev=>{const inp=ev.target.closest("input[data-o]");if(!inp)return;s.obs[a]=s.obs[a]||{};const v=inp.value.trim();if(v)s.obs[a][inp.dataset.o]=v;else delete s.obs[a][inp.dataset.o];save();if(+inp.dataset.o===view.slot)$("#obsNow",app).value=v});
  $("#chips",app).addEventListener("click",ev=>{const b=ev.target.closest("button[data-c]");if(b)toggle(view.slot,b.dataset.c)});
  $("#obsNow",app).addEventListener("change",ev=>{s.obs[a]=s.obs[a]||{};const v=ev.target.value.trim();if(v)s.obs[a][view.slot]=v;else delete s.obs[a][view.slot];save();const inp=tb.querySelector(`input[data-o="${view.slot}"]`);if(inp)inp.value=v});
  $("#prev",app).onclick=()=>setSlot(view.slot-1,true);$("#next",app).onclick=()=>setSlot(view.slot+1,true);
  $("#goNow",app).onclick=()=>{const c=currentSlot(s);setSlot(c!=null?c:(Date.now()<s.inicio?0:nSlots(s)-1),true)};
  $$("[data-a]",app).forEach(b=>b.onclick=()=>{view.animal=+b.dataset.a;render()});
  $("#sum",app).onclick=()=>go({name:"summary",id:s.id,animal:a});
  $("#exp",app).onclick=()=>exportSession(s);
  $("#vis",app).onclick=()=>go({name:"vision",sid:s.id,animal:a});
  setSlot(focus,true);lastSlot=null;tick=setInterval(updateClock,1000);updateClock();
  keepAwake();
};
function keepAwake(){try{if(!wake&&navigator.wakeLock&&document.visibilityState==="visible")navigator.wakeLock.request("screen").then(w=>{wake=w;w.addEventListener("release",()=>{if(wake===w)wake=null})}).catch(()=>{})}catch(err){}}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&view.name==="sheet"){delete view.slot;keepAwake();render()}});

VIEWS.summary=function(){
  const s=db.sessions.find(x=>x.id===view.id);if(!s)return go({name:"obsHome"});
  app.innerHTML=pageHead(`Resumo · ${esc(s.especie)}`,esc(s.nome),`Tempo estimado = nº de marcações × ${s.intervalo} min. A porcentagem é sobre os horários já marcados de cada animal.`,`<button class="btn sm" id="exp">${icon("down")}Exportar planilha</button>`,"Planilha")+
  `<div class="grid g2">${s.animais.map((n,a)=>{const slots=Object.keys(s.marks[a]||{}).filter(i=>(s.marks[a][i]||[]).length),obsN=slots.length;
    const rows=s.comp.map(c=>{const k=slots.filter(i=>s.marks[a][i].includes(c.id)).length;return{label:c.nome,value:k*s.intervalo,color:c.tipo==="raro"?"var(--rare)":"var(--accent)",tip:`${c.nome}: ${k} marcações · ${obsN?Math.round(100*k/obsN):0}% · ${fmtDur(k*s.intervalo)}`}});
    return`<section class="card"><div class="card-h"><div><h3>${esc(n)}</h3><p>${obsN} de ${nSlots(s)} horários marcados · ${fmtDur(obsN*s.intervalo)} observadas</p></div></div>
    ${obsN?`<div class="viz">${hbars(rows,{fmtv:v=>fmtDur(v)})}</div>`:`<p class="muted">Nenhum horário marcado ainda.</p>`}</section>`}).join("")}</div>`;
  wireBack({name:"sheet",id:s.id,animal:view.animal||0});$("#exp",app).onclick=()=>exportSession(s);
};

/* ================= DESEMPENHO ================= */
VIEWS.perf=function(){
  const e=exp();if(!e){app.innerHTML=pageHead("Desempenho","Desempenho dos animais")+needExp();return wireNeedExp()}
  const P=performance(e);const ord={abaixo:0,ok:1,acima:2,sem:3};
  const sorted=[...P].sort((x,y)=>ord[x.status]-ord[y.status]||(x.ratio||0)-(y.ratio||0));
  const pes=[...e.pesagens].sort((a,b)=>a.data<b.data?-1:1);
  const series=e.grupos.map((g,i)=>({name:g.nome,color:`var(--s${i%4+1})`,pts:pes.map(p=>{const v=e.animais.filter(a=>a.grupoId===g.id).map(a=>+p.pesos[a.id]).filter(isFinite);return v.length?{x:dayDiff(e.inicio,p.data),y:Stats.mean(v)}:null}).filter(Boolean)})).filter(s=>s.pts.length);
  app.innerHTML=pageHead("Desempenho","O lote está rendendo o esperado?","GMD = inclinação da reta do peso ao longo dos dias, usando todas as pesagens (com só duas, é (peso atual − peso inicial) ÷ dias). Conversão alimentar = consumo de matéria seca ÷ GMD. Status comparado à meta de GMD de cada tratamento: abaixo de 90% é alerta.",`<button class="btn primary" id="lp">${icon("plus")}Lançar pesagem</button><button class="btn" id="lc">${icon("plus")}Lançar consumo</button><button class="btn quiet" id="ex">${icon("down")}Exportar</button>`)+`
  <div class="stack-lg">
  <div class="tablebox"><table class="t"><thead><tr><th>Animal</th><th>Tratamento</th><th class="r">Peso inicial</th><th class="r">Peso atual</th><th class="r">Dias</th><th class="r">GMD</th><th class="r">Meta</th><th>Status</th><th class="r">CMS</th><th class="r">CMS %PV</th><th class="r">CA</th></tr></thead><tbody>
  ${sorted.map(p=>`<tr><td><b>${esc(p.brinco)}</b></td><td><span class="row" style="gap:7px;flex-wrap:nowrap"><i class="dot" style="background:${gColor(e,p.grupoId)}"></i>${esc(p.grupo)}</span></td><td class="r num">${fmt(p.p0,1)}</td><td class="r num">${fmt(p.pf,1)}</td><td class="r num">${p.dias??"—"}</td><td class="r num"><b>${fmt(p.gmd,2)}</b></td><td class="r num">${fmt(p.meta,2)}</td><td>${statusPill(p.status)}</td><td class="r num">${fmt(p.cms,1)}</td><td class="r num">${fmt(p.pv,2)}</td><td class="r num">${fmt(p.ca,2)}</td></tr>`).join("")}
  </tbody></table></div>
  <p class="note" style="margin-top:-12px">GMD em kg/dia · CMS = consumo de matéria seca, kg/dia · CA em kg MS por kg de ganho.</p>
  <div class="grid g2">
    <section class="card"><div class="card-h"><div><h3>GMD por animal</h3><p>Barra = ganho diário; traço = meta do tratamento.</p></div></div>
      <div class="viz">${hbars(sorted.filter(p=>isFinite(p.gmd)).map(p=>({label:"Animal "+p.brinco,value:p.gmd,marker:p.meta,color:p.status==="abaixo"?"var(--bad)":gColor(e,p.grupoId),tip:`Animal ${p.brinco} · ${p.grupo}\nGMD ${fmt(p.gmd,2)} kg/dia (${fmt(p.ratio*100,0)}% da meta)`})),{unit:"kg/dia",markerLabel:"Meta"})}</div>
      <div class="legend">${e.grupos.map((g,i)=>`<span><i class="dot" style="background:var(--s${i%4+1})"></i>${esc(g.nome)}</span>`).join("")}<span><i class="dot" style="background:var(--bad)"></i>Abaixo da meta</span></div></section>
    <section class="card"><div class="card-h"><div><h3>Evolução do peso médio</h3><p>Média de cada tratamento em cada pesagem (kg).</p></div></div>
      ${series.length?`<div class="viz">${lines(series,"kg")}</div><div class="legend">${series.map(s=>`<span><i class="dot" style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>`:`<p class="muted">Sem pesagens ainda.</p>`}</section>
  </div>
  <section class="grid g2">
    <div class="stack"><h3>Pesagens</h3><div class="list">${pes.length?pes.map(p=>`<div class="item"><div class="grow"><div class="title">${dmy(parseDay(p.data))} <span class="muted" style="font-weight:500">· dia ${dayDiff(e.inicio,p.data)}</span></div><div class="sub">${Object.values(p.pesos).filter(isFinite).length} animais pesados</div></div><button class="btn sm" data-ed="peso:${p.id}">Editar</button></div>`).join(""):`<div class="empty">Nenhuma pesagem.</div>`}</div></div>
    <div class="stack"><h3>Consumo</h3><div class="list">${e.consumo.length?[...e.consumo].sort((a,b)=>a.data<b.data?-1:1).map(c=>`<div class="item"><div class="grow"><div class="title">${dmy(parseDay(c.data))}</div><div class="sub">Média ${fmt(Stats.mean(Object.values(c.valores).filter(isFinite)),1)} kg MS/dia</div></div><button class="btn sm" data-ed="consumo:${c.id}">Editar</button></div>`).join(""):`<div class="empty">Nenhum registro de consumo.</div>`}</div></div>
  </section></div>`;
  $("#lp",app).onclick=()=>go({name:"entry",kind:"peso"});$("#lc",app).onclick=()=>go({name:"entry",kind:"consumo"});
  $("#ex",app).onclick=()=>{const D=dataset(e);saveFile(`${e.nome} - desempenho.csv`,toCSV([["Animal","Tratamento","Peso inicial","Peso atual","Dias","GMD","Meta GMD","Status","CMS","CMS %PV","CA"],...P.map(p=>[p.brinco,p.grupo,p.p0,p.pf,p.dias,p.gmd,p.meta,{acima:"Acima",ok:"No esperado",abaixo:"Abaixo",sem:"Sem dados"}[p.status],p.cms,p.pv,p.ca])]))};
  $$("[data-ed]",app).forEach(b=>b.onclick=()=>{const[k,id]=b.dataset.ed.split(":");go({name:"entry",kind:k,id})});
};
VIEWS.entry=function(){
  const e=exp();if(!e)return go({name:"perf"});const peso=view.kind==="peso";
  const list=peso?e.pesagens:e.consumo,ed=view.id?list.find(x=>x.id===view.id):null,vals=ed?(peso?ed.pesos:ed.valores):{};
  app.innerHTML=pageHead(peso?"Pesagem":"Consumo",peso?(ed?"Editar pesagem":"Lançar pesagem"):(ed?"Editar consumo":"Lançar consumo"),peso?"Peso vivo de cada animal, em kg. Deixe em branco quem não foi pesado.":"Consumo médio de matéria seca por animal no período, em kg MS/dia (ofertado − sobras, corrigido pela MS).",null,"Desempenho")+`
  <form id="f" class="stack-lg"><div class="card"><div class="fields"><label class="f">Data<input type="date" id="d" value="${ed?.data||isoDay(new Date())}" required></label></div></div>
  <div class="tablebox"><table class="t"><thead><tr><th>Animal</th><th>Tratamento</th><th>${peso?"Peso (kg)":"CMS (kg/dia)"}</th></tr></thead><tbody>
  ${e.animais.map(a=>`<tr><td><b>${esc(a.brinco)}</b></td><td><span class="row" style="gap:7px;flex-wrap:nowrap"><i class="dot" style="background:${gColor(e,a.grupoId)}"></i>${esc(grupo(e,a.grupoId)?.nome||"")}</span></td><td><input type="number" inputmode="decimal" step="0.1" min="0" id="v${a.id}" data-a="${a.id}" value="${vals[a.id]??""}" aria-label="${peso?"Peso":"Consumo"} do animal ${esc(a.brinco)}"></td></tr>`).join("")}
  </tbody></table></div>
  <div class="row"><button class="btn primary" type="submit">Salvar</button>${ed?`<button type="button" class="btn quiet danger" id="del">Apagar este lançamento</button>`:""}</div></form>`;
  wireBack({name:"perf"});
  if(ed)$("#del",app).onclick=ev=>{const b=ev.currentTarget;if(!b.dataset.armed){b.dataset.armed=1;b.textContent="Confirmar exclusão?";return}const i=list.indexOf(ed);list.splice(i,1);save();toast("Lançamento apagado");go({name:"perf"})};
  $("#f",app).onsubmit=ev=>{ev.preventDefault();const o={};$$("input[data-a]",app).forEach(i=>{const v=parseFloat(String(i.value).replace(",","."));if(isFinite(v))o[i.dataset.a]=v});
    if(!Object.keys(o).length){toast("Preencha pelo menos um animal");return}
    const rec=ed||{id:uid()};rec.data=$("#d",app).value;if(peso)rec.pesos=o;else rec.valores=o;if(!ed)list.push(rec);save();toast("Salvo");go({name:"perf"})};
};

/* ================= ESTATÍSTICA ================= */
let statState={v:null,x:null,y:null};
function corrWords(r,p){const a=Math.abs(r);const f=a<.3?"fraca":a<.6?"moderada":"forte";return`Correlação <b>${f} e ${r>0?"positiva":"negativa"}</b> (r = ${fmt(r,2)}). `+(p<.05?`Ela é <b>estatisticamente significativa</b> (p = ${fmtP(p)}): é pouco provável que seja acaso.`:`<b>Não é significativa</b> (p = ${fmtP(p)}): com esses dados, pode ser acaso.`)}
VIEWS.stats=function(){
  const e=exp();if(!e){app.innerHTML=pageHead("Estatística","Análise estatística")+needExp();return wireNeedExp()}
  const D=dataset(e);
  if(D.vars.length<1){app.innerHTML=pageHead("Estatística","Análise estatística","Ainda não há dados suficientes. Lance pesagens, consumo ou observações de comportamento.");return}
  const V=D.vars;if(!V.find(v=>v.key===statState.v))statState.v=(V.find(v=>v.key==="gmd")||V[0]).key;
  if(!V.find(v=>v.key===statState.x))statState.x=(V.find(v=>v.key==="b:ruminando")||V[0]).key;
  if(!V.find(v=>v.key===statState.y))statState.y=(V.find(v=>v.key==="gmd")||V[1]||V[0]).key;
  const opt=sel=>V.map(v=>`<option value="${v.key}"${v.key===sel?" selected":""}>${esc(v.nome)}</option>`).join("");
  const nB=V.filter(v=>v.comp).length;
  app.innerHTML=pageHead("Estatística","Análise automática",`Os dados de comportamento, peso e consumo de ${esc(e.nome)} já entram aqui organizados por animal: ${D.rows.length} animais, ${V.length} variáveis${nB?` (${nB} de comportamento, em min/dia)`:""}.`,`<button class="btn" id="exD">${icon("down")}Exportar dados (SAS/R)</button><button class="btn" id="ai">${icon("spark")}Interpretar com IA</button>`)+`
  <div class="stack-lg">
  <section class="card" id="aiBox" hidden><div class="card-h"><div><h3>Leitura dos resultados</h3><p>Escrita por IA a partir dos números abaixo. Confira antes de usar em trabalho.</p></div><button class="btn sm" id="aiStop" hidden>Parar</button></div><div class="ai-out" id="aiOut"></div></section>
  <section class="card">
    <div class="card-h"><div><h3>Comparar tratamentos</h3><p>ANOVA de um fator. Com mais de 2 grupos, comparações par a par com correção de Bonferroni.</p></div>
      <label class="f" style="min-width:min(100%,280px)">Variável<select id="sv">${opt(statState.v)}</select></label></div>
    <div id="anovaOut" class="stack"></div>
  </section>
  <section class="card">
    <div class="card-h"><div><h3>Relação entre duas variáveis</h3><p>Correlação de Pearson e reta de regressão. Ex.: tempo ruminando × ganho de peso.</p></div>
      <div class="row" style="align-items:flex-end"><label class="f" style="min-width:200px">Eixo X<select id="sx">${opt(statState.x)}</select></label><label class="f" style="min-width:200px">Eixo Y<select id="sy">${opt(statState.y)}</select></label></div></div>
    <div id="corrOut" class="stack"></div>
  </section>
  <section class="card">
    <div class="card-h"><div><h3>Mapa de correlações</h3><p>Todas as variáveis contra todas. Azul = negativa, laranja = positiva; * = significativa depois de corrigir para muitas comparações (Benjamini-Hochberg, p &lt; 0,05). Toque num quadrado para ver o gráfico.</p></div></div>
    <div class="viz" id="heat"></div><p class="note" id="heatNote"></p>
  </section>
  <section class="stack"><h3>Dados por animal</h3>
    <div class="tablebox"><table class="t"><thead><tr><th>Animal</th><th>Tratamento</th>${V.map(v=>`<th class="r">${esc(v.nome)}</th>`).join("")}</tr></thead><tbody>
    ${D.rows.map(r=>`<tr><td><b>${esc(r.brinco)}</b></td><td>${esc(r.grupo)}</td>${V.map(v=>`<td class="r num">${fmt(r.v[v.key],v.comp?0:2)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>
  </div>`;
  const cols=e.grupos.map((g,i)=>`var(--s${i%4+1})`);
  function doAnova(){const v=V.find(x=>x.key===statState.v);const res=Stats.anova(e.grupos.map(g=>({nome:g.nome,vals:D.rows.filter(r=>r.grupoId===g.id).map(r=>r.v[v.key])})));
    const unit=(v.nome.match(/\(([^)]+)\)/)||[])[1]||"";const best=[...res.desc].sort((a,b)=>b.media-a.media)[0];
    const sig=res.p<.05;
    $("#anovaOut",app).innerHTML=res.desc.length<2?`<p class="muted">Precisa de pelo menos 2 tratamentos com dados.</p>`:`
      <div class="verdict${sig?" sig":""}">${sig?`Os tratamentos <b>diferem</b> em ${esc(v.nome)} (p = ${fmtP(res.p)}). Maior média: <b>${esc(best.nome)}</b>, ${fmt(best.media,2)} ${esc(unit)}.`:`<b>Não houve diferença significativa</b> entre os tratamentos em ${esc(v.nome)} (p = ${fmtP(res.p)}).${res.N<30?` Com ${res.N} animais, isso não prova que os tratamentos são iguais: diferenças pequenas podem passar despercebidas.`:""}`}</div>
      <div class="statline"><div><b>${fmt(res.F,2)}</b><span>F</span></div><div><b>${res.dfb}; ${res.dfw}</b><span>gl</span></div><div><b>${fmtP(res.p)}</b><span>p</span></div><div><b>${fmt(res.cv,1)}%</b><span>CV</span></div></div>
      <div class="viz">${meanBars(res.desc.map(d=>({...d,nome:d.nome})),res.desc.map(d=>cols[e.grupos.findIndex(g=>g.nome===d.nome)]),unit)}</div>
      <div class="tablebox"><table class="t"><thead><tr><th>Tratamento</th><th class="r">n</th><th class="r">Média</th><th class="r">Desvio-padrão</th><th class="r">Erro-padrão</th></tr></thead><tbody>${res.desc.map(d=>`<tr><td>${esc(d.nome)}</td><td class="r num">${d.n}</td><td class="r num">${fmt(d.media,2)}</td><td class="r num">${fmt(d.dp,2)}</td><td class="r num">${fmt(d.ep,2)}</td></tr>`).join("")}</tbody></table></div>
      ${res.pares&&res.pares.length>1?`<div class="tablebox"><table class="t"><thead><tr><th>Comparação</th><th class="r">Diferença</th><th class="r">p (Bonferroni)</th></tr></thead><tbody>${res.pares.map(p=>`<tr><td>${esc(p.a)} × ${esc(p.b)}</td><td class="r num">${fmt(p.dif,2)}</td><td class="r num">${fmtP(p.p)}${p.p<.05?" *":""}</td></tr>`).join("")}</tbody></table></div>`:""}`;
    statState.anova={v:v.nome,res};}
  function doCorr(){const vx=V.find(x=>x.key===statState.x),vy=V.find(x=>x.key===statState.y);
    const rows=D.rows.filter(r=>isFinite(r.v[vx.key])&&isFinite(r.v[vy.key]));const c=Stats.pearson(rows.map(r=>r.v[vx.key]),rows.map(r=>r.v[vy.key]));
    statState.corr={x:vx.nome,y:vy.nome,c};
    $("#corrOut",app).innerHTML=c.n<3||!isFinite(c.r)?`<p class="muted">Precisa de pelo menos 3 animais com as duas variáveis.</p>`:`
      <div class="verdict${c.p<.05?" sig":""}">${corrWords(c.r,c.p)}${vx.key!==vy.key?` A reta indica que cada 1 unidade a mais em <i>${esc(vx.nome)}</i> está associada a ${fmt(c.b,3)} em <i>${esc(vy.nome)}</i>.`:""}</div>
      <div class="statline"><div><b>${fmt(c.r,3)}</b><span>r</span></div><div><b>${fmt(c.r2,3)}</b><span>R²</span></div><div><b>${fmtP(c.p)}</b><span>p</span></div><div><b>${c.n}</b><span>n</span></div><div><b>y = ${fmt(c.a,3)} ${c.b<0?"−":"+"} ${fmt(Math.abs(c.b),4)}x</b><span>Equação</span></div></div>
      <div class="viz">${scatter(rows.map(r=>({x:r.v[vx.key],y:r.v[vy.key],color:gColor(e,r.grupoId),tip:`Animal ${r.brinco} · ${r.grupo}\n${vx.nome}: ${fmt(r.v[vx.key],2)}\n${vy.nome}: ${fmt(r.v[vy.key],2)}`})),c,vx.nome,vy.nome)}</div>
      <div class="legend">${e.grupos.map((g,i)=>`<span><i class="dot" style="background:var(--s${i%4+1});border-radius:50%"></i>${esc(g.nome)}</span>`).join("")}<span><svg width="22" height="8"><line x1="0" x2="22" y1="4" y2="4" stroke="var(--ink-2)" stroke-width="2" stroke-dasharray="5 4"/></svg>Reta de regressão</span></div>`;}
  function doHeat(){const M=V.map(a=>V.map(b=>{const rows=D.rows.filter(r=>isFinite(r.v[a.key])&&isFinite(r.v[b.key]));return Stats.pearson(rows.map(r=>r.v[a.key]),rows.map(r=>r.v[b.key]))}));
    // Muitos pares testados de uma vez: corrige o p (Benjamini-Hochberg) para não marcar correlações que são só acaso.
    const up=[];V.forEach((_,i)=>V.forEach((_,j)=>{if(j>i)up.push([i,j])}));const q=Stats.bh(up.map(([i,j])=>M[i][j].p));
    up.forEach(([i,j],k)=>{M[i][j]={...M[i][j],q:q[k]};M[j][i]={...M[j][i],q:q[k]}});
    statState.heat=up.filter(([i,j])=>M[i][j].q<.05).map(([i,j])=>`${V[i].nome} × ${V[j].nome}: r=${fmt(M[i][j].r,2)}, p corrigido=${fmtP(M[i][j].q)}`);
    $("#heatNote",app).textContent=`${up.length} pares testados · ${statState.heat.length} significativo(s) após a correção.`;
    $("#heat",app).innerHTML=heat(V,M);
    $$("[data-heat]",app).forEach(r=>r.addEventListener("click",()=>{const[i,j]=r.dataset.heat.split(",").map(Number);statState.x=V[j].key;statState.y=V[i].key;$("#sx",app).value=statState.x;$("#sy",app).value=statState.y;doCorr();$("#corrOut",app).closest(".card").scrollIntoView({behavior:"smooth",block:"start"})}));}
  $("#sv",app).onchange=ev=>{statState.v=ev.target.value;doAnova()};
  $("#sx",app).onchange=ev=>{statState.x=ev.target.value;doCorr()};$("#sy",app).onchange=ev=>{statState.y=ev.target.value;doCorr()};
  doAnova();doCorr();doHeat();
  $("#exD",app).onclick=()=>saveFile(`${e.nome} - dados por animal.csv`,toCSV([["Animal","Tratamento",...V.map(v=>v.nome)],...D.rows.map(r=>[r.brinco,r.grupo,...V.map(v=>r.v[v.key])])]));
  // IA
  claude().then(cl=>{const btn=$("#ai",app);if(!btn)return;if(!cl.sample){btn.hidden=true;return}
    let ctl=null;$("#aiStop",app).onclick=()=>ctl&&ctl.abort();
    btn.onclick=async()=>{const box=$("#aiBox",app),out=$("#aiOut",app),stop=$("#aiStop",app);box.hidden=false;out.textContent="Pensando…";btn.disabled=true;stop.hidden=false;ctl=new AbortController();
      const an=statState.anova,co=statState.corr;
      const tabela=["Animal;Tratamento;"+V.map(v=>v.nome).join(";"),...D.rows.map(r=>[r.brinco,r.grupo,...V.map(v=>isFinite(r.v[v.key])?(+r.v[v.key]).toFixed(2):"")].join(";"))].join("\n");
      const prompt=`Você é um zootecnista experiente ajudando estudantes de graduação. Interprete, em português do Brasil e linguagem simples, os resultados do experimento "${e.nome}" (${e.especie}; tratamentos: ${e.grupos.map(g=>`${g.nome}${g.dieta?" — "+g.dieta:""}, meta de GMD ${g.gmdMeta} kg/dia`).join("; ")}).
Comportamento foi registrado por varredura instantânea (scan sampling) e convertido para minutos por dia.

DADOS POR ANIMAL (ponto e vírgula):
${tabela}

RESULTADOS CALCULADOS:
- ANOVA para ${an?.v}: F=${fmt(an?.res.F,2)}, p=${fmtP(an?.res.p)}; médias: ${an?.res.desc.map(d=>`${d.nome} ${fmt(d.media,2)} ± ${fmt(d.ep,2)} (EP)`).join("; ")}
- Correlação ${co?.x} × ${co?.y}: r=${fmt(co?.c.r,3)}, p=${fmtP(co?.c.p)}, n=${co?.c.n}
- Correlações significativas no mapa (p corrigido por Benjamini-Hochberg): ${statState.heat.slice(0,14).join(" | ")||"nenhuma"}

Escreva de 5 a 7 tópicos curtos (use "• " no início de cada um, sem markdown, sem negrito): o que os resultados mostram sobre desempenho, sobre comportamento (ruminação, ingestão, ócio) e a ligação com a dieta; quais animais merecem atenção e por quê; e um último tópico com limitações (tamanho da amostra, poucos dias de observação, correlação não é causa). Não invente números que não estão acima.`;
      try{await cl.sample(prompt,{signal:ctl.signal,onText:({text})=>{out.textContent=text}})}
      catch(err){if(err&&err.code==="cancelled"){out.textContent=err.text||"Interrompido."}else if(err&&err.code==="not_granted"){out.textContent="Sem permissão para usar o Claude nesta página. Libere nas permissões da página para usar esta função."}else{out.textContent=(err&&err.text?err.text+"\n\n":"")+"Não foi possível concluir a leitura agora. Tente de novo em alguns instantes."}}
      finally{btn.disabled=false;stop.hidden=true}};
  });
};

/* ================= VISÃO IA ================= */
let _claude=null;
function claude(){if(_claude)return _claude;
  _claude=(async()=>{const o={};try{if(window.claude&&window.claude.use){const[s,d]=await Promise.all([window.claude.use("sample"),window.claude.use("downloads")]);o.sample=s;o.downloads=d;if(s){try{o.limits=await s.limits()}catch(e){}}}}catch(e){}return o})();
  return _claude}
let vis={file:null,frames:[],results:[]};
// Libera a memória das imagens dos quadros anteriores.
function clearVisResults(){vis.results.forEach(r=>{try{URL.revokeObjectURL(r.url)}catch(e){}});vis.results=[]}
VIEWS.vision=function(){
  const e=exp();
  const sessions=db.sessions.filter(s=>!e||s.expId===e.id||!s.expId).sort((a,b)=>b.inicio-a.inicio);
  if(view.sid&&!sessions.find(s=>s.id===view.sid)){const s=db.sessions.find(x=>x.id===view.sid);if(s)sessions.unshift(s)}
  const sel=db.sessions.find(s=>s.id===(view.sid||sessions[0]?.id));
  app.innerHTML=pageHead("Visão IA","Marcação automática por vídeo","Envie um vídeo do curral. O app tira quadros no intervalo escolhido, a IA identifica o que o animal está fazendo em cada um e preenche a planilha. Você revisa antes de aplicar.")+`
  <div class="stack-lg">
  <div id="visStatus"></div>
  <section class="card">
    <div class="card-h"><div><h3>1. Para onde vão as marcações</h3><p>Escolha a observação e o animal que aparece no vídeo.</p></div></div>
    ${sessions.length?`<div class="fields">
      <label class="f">Observação<select id="vs">${sessions.map(s=>`<option value="${s.id}"${s===sel?" selected":""}>${esc(s.nome)} · ${esc(s.observador||"—")} · ${dmy(new Date(s.inicio))}</option>`).join("")}</select></label>
      <label class="f">Animal<select id="va">${sel.animais.map((n,i)=>`<option value="${i}"${i===(view.animal||0)?" selected":""}>${esc(n)}</option>`).join("")}</select></label>
      <label class="f">Como reconhecer o animal <span class="hint">ajuda a IA quando há vários no vídeo</span><input type="text" id="vd" placeholder="Ex.: vaca preta, brinco amarelo, à esquerda"></label>
    </div>`:`<div class="empty">Crie uma observação primeiro, em Observar.<button class="btn" id="toObs2">Ir para Observar</button></div>`}
  </section>
  ${sessions.length?`<section class="card">
    <div class="card-h"><div><h3>2. Vídeo ou foto</h3><p>Vídeo gravado do animal (celular ou câmera do galpão). Também dá para testar com uma foto.</p></div></div>
    <label class="drop" id="drop" for="vf">${icon("film")}<b>Escolher vídeo ou foto</b><span class="note">ou arraste o arquivo para cá</span><input type="file" id="vf" accept="video/*,image/*" hidden></label>
    <div id="vidInfo"></div>
    <div class="fields">
      <label class="f">Horário em que o vídeo começa<input type="time" id="vt" value="${sel?hhmm(new Date(sel.inicio)):"07:00"}"></label>
      <label class="f">Data<input type="date" id="vdt" value="${sel?isoDay(new Date(sel.inicio)):isoDay(new Date())}"></label>
      <label class="f">Um quadro a cada<select id="vi"><option value="10">10 segundos (teste)</option><option value="30">30 segundos</option><option value="60">1 minuto</option><option value="300" selected>5 minutos</option><option value="600">10 minutos</option></select></label>
    </div>
    <p class="note" id="vCalc"></p>
    <div class="row"><button class="btn primary" id="run" disabled>${icon("spark")}Analisar com IA</button><button class="btn" id="stop" hidden>Parar</button><span class="note" id="prog"></span></div>
  </section>
  <section class="card" id="resCard" hidden>
    <div class="card-h"><div><h3>3. Revisar e aplicar</h3><p>Toque num comportamento para tirar ou pôr antes de aplicar.</p></div><button class="btn primary" id="apply">${icon("check")}Aplicar na planilha</button></div>
    <div class="frames" id="frames"></div>
  </section>`:""}
  </div>`;
  const tb=$("#toObs2",app);if(tb)tb.onclick=()=>go({name:"obsHome"});
  if(!sessions.length)return;
  const getS=()=>db.sessions.find(s=>s.id===$("#vs",app).value);
  $("#vs",app).onchange=ev=>{view.sid=ev.target.value;view.animal=0;clearVisResults();render()};
  let duration=0;
  const calc=()=>{const s=getS(),iv=+$("#vi",app).value;const n=vis.file&&vis.file.type.startsWith("image/")?1:Math.min(60,Math.floor(duration/iv)+1);
    $("#vCalc",app).textContent=vis.file?(vis.file.type.startsWith("image/")?"1 foto será analisada.":`${n} quadros serão analisados${Math.floor(duration/iv)+1>60?" (limite de 60 por vez)":""}. Cada quadro vira a marcação do horário correspondente, em blocos de ${s.intervalo} min.`):""};
  $("#vi",app).onchange=calc;
  const setFile=f=>{if(!f)return;vis.file=f;clearVisResults();$("#resCard",app).hidden=true;
    if(f.type.startsWith("video/")){const v=document.createElement("video");v.preload="metadata";v.muted=true;v.src=URL.createObjectURL(f);v.onloadedmetadata=()=>{duration=isFinite(v.duration)?v.duration:0;URL.revokeObjectURL(v.src);$("#vidInfo",app).innerHTML=`<div class="callout">${icon("film")}<span><b>${esc(f.name)}</b> · ${fmtDur(duration/60)} de vídeo</span></div>`;calc()};v.onerror=()=>{$("#vidInfo",app).innerHTML=`<div class="callout bad">${icon("alert")}<span>Não consegui abrir esse vídeo neste navegador. Tente MP4 (H.264) ou WebM.</span></div>`}}
    else{duration=0;$("#vidInfo",app).innerHTML=`<div class="callout">${icon("film")}<span><b>${esc(f.name)}</b> · foto</span></div>`;calc()}
    $("#run",app).disabled=false;};
  $("#vf",app).onchange=ev=>setFile(ev.target.files[0]);
  const drop=$("#drop",app);drop.addEventListener("dragover",ev=>{ev.preventDefault();drop.classList.add("over")});drop.addEventListener("dragleave",()=>drop.classList.remove("over"));
  drop.addEventListener("drop",ev=>{ev.preventDefault();drop.classList.remove("over");setFile(ev.dataTransfer.files[0])});
  if(vis.results.length)paintResults();
  claude().then(cl=>{const st=$("#visStatus",app);if(!st)return;
    if(!cl.sample||!cl.limits||!cl.limits.images){st.innerHTML=`<div class="callout">${icon("info")}<span>A análise por IA funciona quando o app é aberto pelo Claude (no link do app, com sua conta). Aqui ela não está disponível, mas o resto do app funciona normalmente.</span></div>`;const r=$("#run",app);if(r){r.disabled=true;r.dataset.off=1}}});
  let ctl=null;$("#stop",app).onclick=()=>{ctl&&ctl.abort()};
  $("#run",app).onclick=async()=>{const cl=await claude();if(!cl.sample||!vis.file)return;
    const s=getS(),a=+$("#va",app).value,iv=+$("#vi",app).value,desc=$("#vd",app).value.trim();
    const[Y,M,D]=$("#vdt",app).value.split("-").map(Number),[h,mi]=$("#vt",app).value.split(":").map(Number);const t0=new Date(Y,M-1,D,h,mi).getTime();
    const run=$("#run",app),stop=$("#stop",app),prog=$("#prog",app);run.disabled=true;stop.hidden=false;ctl=new AbortController();
    try{
      prog.innerHTML=`<span class="spin"></span> Tirando quadros…`;
      const frames=vis.file.type.startsWith("image/")?[{t:0,blob:await shrink(vis.file)}]:await extractFrames(vis.file,iv,60,ctl.signal,(k,n)=>prog.innerHTML=`<span class="spin"></span> Tirando quadros… ${k}/${n}`);
      clearVisResults();vis.results=frames.map(f=>({t:f.t,clock:t0+f.t*1000,url:URL.createObjectURL(f.blob),blob:f.blob,comps:[],conf:null,nota:"",status:"wait"}));
      vis.sid=s.id;vis.animal=a;$("#resCard",app).hidden=false;paintResults();
      const max=Math.max(1,Math.min(6,cl.limits.images.maxCount||1));const names=s.comp.map(c=>c.nome);
      for(let i=0;i<vis.results.length;i+=max){if(ctl.signal.aborted)break;
        const batch=vis.results.slice(i,i+max);batch.forEach(b=>b.status="run");paintResults();
        prog.innerHTML=`<span class="spin"></span> Analisando quadros ${i+1}–${i+batch.length} de ${vis.results.length}…`;
        const prompt=`Você é um especialista em etologia de ${s.especie.toLowerCase()}s fazendo uma análise comportamental por varredura instantânea.
Recebeu ${batch.length} imagem(ns), em ordem, de um vídeo de ${s.especie.toLowerCase()}s.${desc?` O animal que importa é: ${desc}.`:" Se houver vários animais, considere o mais visível no centro da imagem."}
Para cada imagem, diga quais comportamentos deste etograma o animal está fazendo naquele instante. Use SOMENTE nomes desta lista, escritos exatamente assim: ${names.map(n=>`"${n}"`).join(", ")}.
Normalmente marque uma atividade (ex.: Comendo, Ruminando, Ócio, Bebendo água) e uma postura (ex.: Deitada ou Em pé), se existirem na lista. Ruminação aparece como mastigação com o animal fora do cocho; se não der para ter certeza, use confiança baixa.
Responda apenas com JSON: um array com ${batch.length} objeto(s), na ordem das imagens, assim: [{"imagem":1,"comportamentos":["Ruminando","Deitada"],"confianca":0.8,"nota":"frase curta do que você vê"}]. Se o animal não estiver visível, use "comportamentos":[] e explique na nota.`;
        try{const out=await cl.sample.json(prompt,{images:batch.map(b=>b.blob),signal:ctl.signal,modelTier:"default"});
          const arr=Array.isArray(out)?out:(out&&Array.isArray(out.resultados)?out.resultados:[]);
          batch.forEach((b,k)=>{const o=arr.find(x=>+x.imagem===k+1)||arr[k]||{};b.comps=(o.comportamentos||[]).map(n=>s.comp.find(c=>norm(c.nome)===norm(n))).filter(Boolean).map(c=>c.id);b.conf=+o.confianca;b.nota=String(o.nota||"");b.status="done"});}
        catch(err){batch.forEach(b=>{b.status="err";b.nota=err&&err.code==="not_granted"?"Sem permissão para usar o Claude.":err&&err.code==="cancelled"?"Interrompido.":"Falhou: tente de novo."});if(err&&(err.code==="not_granted"||err.code==="cancelled"))break}
        paintResults();}
      prog.textContent=vis.results.some(r=>r.status==="done")?"Análise concluída. Revise e aplique.":"";
    }catch(err){prog.textContent=err&&err.message==="abort"?"Interrompido.":"Não consegui ler o vídeo. Tente outro arquivo (MP4 ou WebM)."}
    finally{run.disabled=false;stop.hidden=true}};
  // Um quadro por horário (o primeiro dentro dele, como na varredura instantânea). A marcação revisada substitui a do horário.
  $("#apply",app).onclick=()=>{const s=db.sessions.find(x=>x.id===vis.sid);if(!s)return;const a=vis.animal;let n=0;s.marks[a]=s.marks[a]||{};const used=new Set();
    vis.results.filter(r=>r.status==="done"&&r.comps.length).sort((x,y)=>x.clock-y.clock).forEach(r=>{const i=Math.floor((r.clock-s.inicio)/(s.intervalo*60000));if(i<0||i>=nSlots(s)||used.has(i))return;used.add(i);s.marks[a][i]=[...r.comps];n++});
    save();if(!n){toast("Nenhum quadro caiu dentro do horário dessa observação. Confira o horário de início do vídeo.");return}
    toast(`${n} horário(s) preenchido(s) na planilha`);go({name:"sheet",id:s.id,animal:a,slot:Math.floor((vis.results[0].clock-s.inicio)/(s.intervalo*60000))})};
  function paintResults(){const s=db.sessions.find(x=>x.id===vis.sid)||getS();const box=$("#frames",app);if(!box)return;$("#resCard",app).hidden=!vis.results.length;
    box.innerHTML=vis.results.map((r,k)=>`<div class="frame"><img src="${r.url}" alt="Quadro ${k+1}"><div class="fb"><div class="spread"><span class="t">${hhmm(new Date(r.clock))}</span>${r.status==="run"?'<span class="spin"></span>':r.status==="done"&&isFinite(r.conf)?`<span class="pill ${r.conf>=.7?"good":r.conf>=.4?"warn":"bad"}">${Math.round(r.conf*100)}% de certeza</span>`:r.status==="wait"?'<span class="note">na fila</span>':""}</div>
      ${r.status==="done"?`<div>${s.comp.map(c=>`<button class="mini" data-f="${k}" data-c="${c.id}" style="border:0;${r.comps.includes(c.id)?"":"background:var(--surface-2);color:var(--muted);text-decoration:line-through"}">${esc(c.nome)}</button>`).filter((_,i)=>r.comps.includes(s.comp[i].id)||r.showAll).join("")}<button class="mini" data-more="${k}" style="border:0;background:transparent;color:var(--accent-text)">${r.showAll?"menos":"+ outro"}</button></div>`:""}
      ${r.nota?`<span class="note">${esc(r.nota)}</span>`:""}</div></div>`).join("");
    $$("[data-f]",box).forEach(b=>b.onclick=()=>{const r=vis.results[+b.dataset.f];const c=b.dataset.c;r.comps=r.comps.includes(c)?r.comps.filter(x=>x!==c):[...r.comps,c];paintResults()});
    $$("[data-more]",box).forEach(b=>b.onclick=()=>{const r=vis.results[+b.dataset.more];r.showAll=!r.showAll;paintResults()});}
};
function shrink(blobOrFile,maxW=1024){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{URL.revokeObjectURL(img.src);const k=Math.min(1,maxW/img.naturalWidth),c=document.createElement("canvas");c.width=Math.round(img.naturalWidth*k);c.height=Math.round(img.naturalHeight*k);c.getContext("2d").drawImage(img,0,0,c.width,c.height);c.toBlob(b=>b?res(b):rej(new Error("img")),"image/jpeg",.82)};img.onerror=()=>rej(new Error("img"));img.src=URL.createObjectURL(blobOrFile)})}
async function extractFrames(file,every,max,signal,onProg){
  const v=document.createElement("video");v.muted=true;v.playsInline=true;v.preload="auto";v.src=URL.createObjectURL(file);
  await new Promise((res,rej)=>{v.onloadeddata=res;v.onerror=()=>rej(new Error("video"))});
  if(!isFinite(v.duration)){URL.revokeObjectURL(v.src);throw new Error("video")}
  const times=[];for(let t=0;t<=v.duration&&times.length<max;t+=every)times.push(Math.min(t,Math.max(0,v.duration-.05)));
  const k=Math.min(1,960/v.videoWidth),c=document.createElement("canvas");c.width=Math.round(v.videoWidth*k);c.height=Math.round(v.videoHeight*k);const ctx=c.getContext("2d");
  const out=[];for(let i=0;i<times.length;i++){if(signal.aborted)throw new Error("abort");
    await new Promise(res=>{v.onseeked=res;v.currentTime=times[i]});ctx.drawImage(v,0,0,c.width,c.height);
    const blob=await new Promise(res=>c.toBlob(res,"image/jpeg",.8));out.push({t:times[i],blob});onProg&&onProg(i+1,times.length)}
  URL.revokeObjectURL(v.src);return out;
}

/* ================= AJUSTES ================= */
VIEWS.settings=function(){
  const hasEx=db.experiments.some(x=>x.exemplo)||db.sessions.some(s=>s.exemplo);
  app.innerHTML=pageHead("Ajustes","Dados e configuração")+`
  <div class="grid g2">
    <section class="card"><div class="card-h"><div><h3>Animais e comportamentos</h3><p>Edite o etograma de cada espécie ou crie uma nova.</p></div></div><div><button class="btn" id="spc">Editar etogramas</button></div></section>
    <section class="card"><div class="card-h"><div><h3>Juntar planilhas dos observadores</h3><p>Cada observador exporta a planilha no celular dele; aqui você importa todas no experimento ativo${exp()?` (<b>${esc(exp().nome)}</b>)`:""}.</p></div></div>
      <label class="btn" for="csvIn" style="align-self:flex-start">${icon("up")}Importar planilhas (.csv)</label><input type="file" id="csvIn" accept=".csv,text/csv" multiple hidden><p class="note" id="csvMsg"></p></section>
    <section class="card"><div class="card-h"><div><h3>Cópia de segurança</h3><p>Salve tudo num arquivo e restaure em outro aparelho.</p></div></div>
      <div class="row"><button class="btn" id="bk">${icon("down")}Salvar cópia</button><label class="btn" for="bkIn">${icon("up")}Restaurar cópia</label><input type="file" id="bkIn" accept=".json,application/json" hidden></div><p class="note" id="bkMsg"></p></section>
    ${badCopy()?`<section class="card"><div class="card-h"><div><h3>Dados antigos não lidos</h3><p>Ao abrir, o app encontrou dados salvos que não conseguiu ler (arquivo corrompido ou de outra versão). Eles foram guardados sem alteração. Baixe o arquivo e envie para quem cuida do app.</p></div></div>
      <div class="row"><button class="btn" id="badDl">${icon("down")}Baixar dados não lidos</button><button class="btn quiet danger" id="badRm">Descartar</button></div></section>`:""}
    <section class="card"><div class="card-h"><div><h3>Limpar</h3><p>Apaga dados deste aparelho.</p></div></div>
      <div class="row">${hasEx?`<button class="btn" id="rmEx">Apagar dados de exemplo</button>`:`<button class="btn" id="addEx">Carregar exemplo</button>`}<button class="btn quiet danger" id="wipe">Apagar tudo</button></div></section>
  </div>
  <p class="note" style="margin-top:22px">Etograma · protótipo. Os dados ficam salvos só neste aparelho e navegador.</p>`;
  $("#spc",app).onclick=()=>go({name:"species"});
  $("#bk",app).onclick=()=>saveFile(`etograma-copia-${isoDay(new Date())}.json`,JSON.stringify(db),"application/json");
  $("#bkIn",app).onchange=async ev=>{const f=ev.target.files[0],msg=$("#bkMsg",app);ev.target.value="";if(!f)return;let d;
    try{d=JSON.parse(await f.text());if(d.v!==2||!Array.isArray(d.experiments)||!Array.isArray(d.sessions))throw 0}catch(err){msg.textContent="Esse arquivo não é uma cópia do Etograma.";return}
    msg.innerHTML=`Cópia com ${d.experiments.length} experimento(s) e ${d.sessions.length} observação(ões). Isso substitui tudo o que está neste aparelho. <button class="btn sm primary" id="bkOk">Substituir</button>`;
    $("#bkOk",app).onclick=()=>{db=d;if(!exp())db.active=db.experiments[0]?.id||null;save();toast("Cópia restaurada");go({name:"dash"})}};
  const bd=$("#badDl",app);if(bd){bd.onclick=()=>saveFile(`etograma-dados-nao-lidos-${isoDay(new Date())}.json`,badCopy(),"application/json");
    $("#badRm",app).onclick=ev=>{const b=ev.currentTarget;if(!b.dataset.armed){b.dataset.armed=1;b.textContent="Confirmar descarte?";return}try{localStorage.removeItem(KEYBAD)}catch(e){}render()}}
  $("#csvIn",app).onchange=async ev=>{const fs=[...ev.target.files];ev.target.value="";let n=0,dup=0,errs=[];for(const f of fs){try{const r=importCSV(await f.text());n+=r.added;dup+=r.dup}catch(err){errs.push(f.name)}}save();
    $("#csvMsg",app).textContent=`${n} observação(ões) importada(s)${dup?` · ${dup} já existia(m) e foi(ram) ignorada(s)`:""}${errs.length?`. Não reconheci: ${errs.join(", ")}`:""}.`;if(n)toast("Planilhas importadas")};
  const rm=$("#rmEx",app);if(rm)rm.onclick=()=>{db.experiments=db.experiments.filter(x=>!x.exemplo);db.sessions=db.sessions.filter(s=>!s.exemplo);if(!exp())db.active=db.experiments[0]?.id||null;save();toast("Exemplo apagado");render()};
  const ad=$("#addEx",app);if(ad)ad.onclick=()=>{const ex=exampleData(db.species);db.experiments.push(ex.exp);db.sessions.push(...ex.sessions);db.active=ex.exp.id;save();toast("Exemplo carregado");go({name:"dash"})};
  $("#wipe",app).onclick=ev=>{const b=ev.currentTarget;if(!b.dataset.armed){b.dataset.armed=1;b.textContent="Confirmar: apagar tudo?";return}db={v:2,species:defaultSpecies(),experiments:[],sessions:[],active:null};save();toast("Tudo apagado");go({name:"dash"})};
};
VIEWS.species=function(){
  app.innerHTML=pageHead("Ajustes","Etogramas","Mudanças valem para as próximas observações. As já começadas continuam com a lista original.",`<button class="btn" id="addSp">${icon("plus")}Nova espécie</button><button class="btn quiet danger" id="reset">Restaurar padrão</button>`,"Ajustes")+`<div id="spList" class="grid g2"></div>`;
  wireBack({name:"settings"});
  const list=$("#spList",app);
  db.species.forEach((sp,si)=>{const card=document.createElement("section");card.className="card";
    card.innerHTML=`<div class="row" style="flex-wrap:nowrap"><input type="text" id="spn${sp.id}" value="${esc(sp.nome)}" aria-label="Nome da espécie" style="font-family:var(--display);font-weight:700;font-size:1.2rem;flex:1;min-width:0"><button class="btn sm quiet danger" data-rm>Remover</button></div>
    <div class="stack" style="gap:8px">${sp.comp.map(c=>`<div class="beh" data-id="${c.id}"><input type="text" id="b${c.id}" value="${esc(c.nome)}" aria-label="Comportamento"><select id="t${c.id}" aria-label="Tipo"><option value="comum"${c.tipo!=="raro"?" selected":""}>Comum</option><option value="raro"${c.tipo==="raro"?" selected":""}>Fora do comum</option></select><button class="btn sm quiet danger" aria-label="Remover comportamento" data-x>${icon("x")}</button></div>`).join("")}</div>
    <div><button class="btn sm quiet" data-add>${icon("plus")}Comportamento</button></div>`;
    $(`#spn${sp.id}`,card).onchange=ev=>{sp.nome=ev.target.value.trim()||sp.nome;save()};
    $("[data-rm]",card).onclick=ev=>{const b=ev.currentTarget;if(b.dataset.armed){db.species.splice(si,1);save();render()}else{b.dataset.armed=1;b.textContent="Confirmar?"}};
    $$(".beh",card).forEach(row=>{const c=sp.comp.find(x=>x.id===row.dataset.id);$("input",row).onchange=ev=>{c.nome=ev.target.value.trim()||c.nome;save()};$("select",row).onchange=ev=>{c.tipo=ev.target.value;save()};$("[data-x]",row).onclick=()=>{sp.comp=sp.comp.filter(x=>x!==c);save();render()}});
    $("[data-add]",card).onclick=()=>{sp.comp.push(B("Novo comportamento"));save();render()};list.appendChild(card);});
  $("#addSp",app).onclick=()=>{db.species.push({id:uid(),nome:"Nova espécie",comp:[B("Comendo"),B("Bebendo água"),B("Ócio")]});save();render()};
  $("#reset",app).onclick=ev=>{const b=ev.currentTarget;if(b.dataset.armed){db.species=defaultSpecies();save();render();toast("Etogramas padrão restaurados")}else{b.dataset.armed=1;b.textContent="Confirmar?"}};
};

/* ================= arquivos ================= */
function exportSession(s){saveFile((s.nome+" - "+(s.observador||"observador")+" - "+s.animais.join(", ")).replace(/[\/:*?"<>|]/g,"-")+".csv",sessionCSV(s))}
// Importa as observações de um CSV; ignora as que já existem (mesmo observador, animais e horário de início).
function importCSV(txt){
  const have=new Set(db.sessions.map(Data.sessionSignature));let added=0,dup=0;
  for(const s of Data.sessionsFromCSV(txt,{species:db.species,exp:exp()})){const k=Data.sessionSignature(s);if(have.has(k)){dup++;continue}have.add(k);db.sessions.push(s);added++}
  return{added,dup};
}
async function saveFile(name,data,mime="text/csv"){
  const cl=await claude();
  if(cl.downloads){try{await cl.downloads.save({filename:name,data:new Blob([data],{type:mime})});toast("Arquivo salvo");return}catch(err){if(err&&err.code==="declined")return}}
  // Fora do Claude (navegador comum / VS Code Live Server): download nativo.
  if(!window.claude){const url=URL.createObjectURL(new Blob([data],{type:mime}));const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast("Arquivo baixado");return}
  const card=document.createElement("section");card.className="card";card.style.marginTop="18px";
  card.innerHTML=`<div class="card-h"><div><h3>Copiar dados</h3><p>Não deu para salvar o arquivo aqui. Copie e cole no Excel, Google Planilhas ou num arquivo de texto.</p></div><button class="btn sm quiet" data-close>${icon("x")}</button></div><textarea id="cp${uid()}" rows="8" style="font-family:var(--mono);font-size:.78rem" readonly aria-label="Dados"></textarea><div><button class="btn primary">Copiar</button></div>`;
  app.appendChild(card);const ta=$("textarea",card);ta.value=data.replace(/^﻿/,"");card.scrollIntoView({behavior:"smooth"});
  $(".btn.primary",card).onclick=()=>{(navigator.clipboard?navigator.clipboard.writeText(ta.value):Promise.reject()).then(()=>toast("Copiado")).catch(()=>{ta.focus();ta.select()})};$("[data-close]",card).onclick=()=>card.remove();
}

/* ================= dica flutuante ================= */
const tip=$("#tip");
document.addEventListener("pointerover",ev=>{const t=ev.target.closest&&ev.target.closest("[data-tip]");if(!t||!t.dataset.tip){tip.hidden=true;return}tip.textContent=t.dataset.tip;tip.hidden=false;place(ev)});
document.addEventListener("pointermove",ev=>{if(!tip.hidden)place(ev)});
document.addEventListener("scroll",()=>tip.hidden=true,true);
function place(ev){const w=tip.offsetWidth,h=tip.offsetHeight;let x=ev.clientX+14,y=ev.clientY-h-12;if(x+w>innerWidth-8)x=ev.clientX-w-14;if(y<8)y=ev.clientY+18;tip.style.left=Math.max(8,x)+"px";tip.style.top=y+"px"}

if(!db.active&&db.experiments[0])db.active=db.experiments[0].id;
render();claude();
})();
