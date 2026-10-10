/* ===== Dados: cálculos de desempenho, comportamento e CSV (funções puras, testadas em tests/data.test.js) ===== */
const Data=(function(){
  const S=typeof Stats!=="undefined"?Stats:require("./stats.js");
  const uid=()=>Math.random().toString(36).slice(2,9);
  const pad=n=>String(n).padStart(2,"0");
  const hhmm=d=>pad(d.getHours())+":"+pad(d.getMinutes());
  const dmy=d=>pad(d.getDate())+"/"+pad(d.getMonth()+1)+"/"+d.getFullYear();
  const parseDay=s=>{const[y,m,d]=String(s).split("-").map(Number);return new Date(y,m-1,d)};
  const dayDiff=(a,b)=>Math.round((parseDay(b)-parseDay(a))/864e5);
  const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").trim();
  const grupo=(e,gid)=>e.grupos.find(g=>g.id===gid);

  /* ---------- desempenho ---------- */
  // GMD = inclinação da reta peso × dias (mínimos quadrados). Com 2 pesagens é igual a (final − inicial) ÷ dias.
  function gmdOf(pts,d0){
    const P=pts.map(p=>({x:dayDiff(d0,p.d),y:p.w}));const mx=S.mean(P.map(p=>p.x)),my=S.mean(P.map(p=>p.y));
    let sxy=0,sxx=0;for(const p of P){sxy+=(p.x-mx)*(p.y-my);sxx+=(p.x-mx)**2}
    return sxx>0?sxy/sxx:NaN;
  }
  function performance(e){
    const pes=[...e.pesagens].sort((a,b)=>a.data<b.data?-1:1);
    return e.animais.map(a=>{
      const pts=pes.filter(p=>isFinite(p.pesos[a.id])).map(p=>({d:p.data,w:+p.pesos[a.id]}));
      const g=grupo(e,a.grupoId)||{};const o={id:a.id,brinco:a.brinco,grupoId:a.grupoId,grupo:g.nome||"—",meta:+g.gmdMeta,pts};
      if(pts.length){o.p0=pts[0].w;o.pf=pts[pts.length-1].w}
      if(pts.length>=2){o.dias=dayDiff(pts[0].d,pts[pts.length-1].d);o.gmd=o.dias>0?gmdOf(pts,pts[0].d):NaN}
      const cs=e.consumo.map(c=>+c.valores[a.id]).filter(isFinite);o.cms=cs.length?S.mean(cs):NaN;
      o.ca=isFinite(o.cms)&&o.gmd>0?o.cms/o.gmd:NaN;
      o.pv=isFinite(o.cms)&&isFinite(o.p0)?100*o.cms/((o.p0+o.pf)/2):NaN;
      if(isFinite(o.gmd)&&o.meta>0){o.ratio=o.gmd/o.meta;o.status=o.ratio>=1.1?"acima":o.ratio>=.9?"ok":"abaixo"}else o.status="sem";
      return o;});
  }

  /* ---------- comportamento ---------- */
  function sessionAnimalId(e,s,k){
    if(s.animalIds&&s.animalIds[k]&&e.animais.some(a=>a.id===s.animalIds[k]))return s.animalIds[k];
    const n=norm(s.animais[k]);const a=e.animais.find(a=>norm(a.brinco)===n||n.endsWith(" "+norm(a.brinco)));return a?a.id:null;
  }
  // min/dia = (marcações do comportamento ÷ horários marcados) × 1440
  function behaviorVars(e,sessions){
    const acc={},names={};
    sessions.filter(s=>s.expId===e.id).forEach(s=>{
      s.animais.forEach((_,k)=>{const aid=sessionAnimalId(e,s,k);if(!aid)return;
        const M=s.marks[k]||{};const A=acc[aid]=acc[aid]||{obs:0,c:{}};
        for(const i in M){const arr=M[i];if(!arr||!arr.length)continue;A.obs++;
          for(const cid of arr){const c=s.comp.find(x=>x.id===cid);if(!c)continue;const key="b:"+norm(c.nome);names[key]=c.nome;A.c[key]=(A.c[key]||0)+1}}
      });});
    const vars=Object.keys(names).map(k=>({key:k,nome:names[k]+" (min/dia)",curto:names[k],comp:true}));
    const by={};for(const aid in acc){by[aid]={};for(const v of vars)by[aid][v.key]=acc[aid].obs?(acc[aid].c[v.key]||0)/acc[aid].obs*1440:NaN;by[aid]._obs=acc[aid].obs}
    return{vars,by};
  }
  function dataset(e,sessions){
    const P=performance(e),BV=behaviorVars(e,sessions);
    const base=[{key:"p0",nome:"Peso inicial (kg)"},{key:"pf",nome:"Peso atual (kg)"},{key:"gmd",nome:"GMD (kg/dia)"},{key:"cms",nome:"Consumo de MS (kg/dia)"},{key:"ca",nome:"Conversão alimentar (kg MS/kg)"}];
    const rows=P.map(p=>({id:p.id,brinco:p.brinco,grupoId:p.grupoId,grupo:p.grupo,v:{p0:p.p0,pf:p.pf,gmd:p.gmd,cms:p.cms,ca:p.ca,...(BV.by[p.id]||{})}}));
    const vars=[...base,...BV.vars].filter(v=>rows.filter(r=>isFinite(r.v[v.key])).length>=3);
    return{rows,vars,perf:P};
  }

  /* ---------- observações ---------- */
  const nSlots=s=>Math.round(s.duracao*60/s.intervalo);
  const slotDate=(s,i)=>new Date(s.inicio+i*s.intervalo*60000);
  const marked=(s,a,i)=>(s.marks[a]&&s.marks[a][i])||[];
  // Mesma observação = mesmo observador, mesmos animais, mesmo início e intervalo (evita duplicar ao importar 2 vezes).
  const sessionSignature=s=>[norm(s.observador),s.animais.map(norm).join(","),s.inicio,s.intervalo].join("|");

  /* ---------- CSV ---------- */
  // Texto que começa com = + - @ vira fórmula no Excel: prefixa com apóstrofo (o Excel esconde o apóstrofo).
  const FORMULA=/^[=+\-@\t\r]/;
  function toCSV(rows){return"﻿"+rows.map(r=>r.map(v=>{if(typeof v==="number")v=isFinite(v)?String(+v.toFixed(4)).replace(".",","):"";v=String(v??"");if(FORMULA.test(v))v="'"+v;return/[;"\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(";")).join("\r\n")}
  function sessionCSV(s){const head=["Experimento","Espécie","Observador","Animal","Data","Hora","Intervalo (min)",...s.comp.map(c=>c.nome),"Observação"];const rows=[head];
    s.animais.forEach((n,a)=>{for(let i=0;i<nSlots(s);i++){const d=slotDate(s,i),mk=marked(s,a,i);rows.push([s.nome,s.especie,s.observador,n,dmy(d),hhmm(d),String(s.intervalo),...s.comp.map(c=>mk.includes(c.id)?"1":"0"),(s.obs[a]||{})[i]||""])}});return toCSV(rows)}
  function parseCSV(txt){txt=txt.replace(/^﻿/,"");
    const firstLine=txt.slice(0,txt.indexOf("\n")>=0?txt.indexOf("\n"):txt.length);
    const sep=firstLine.includes(";")?";":firstLine.includes("\t")?"\t":",";
    const rows=[];let row=[],f="",q=false;for(let i=0;i<txt.length;i++){const ch=txt[i];
      if(q){if(ch==='"'){if(txt[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}
      else if(ch==='"')q=true;else if(ch===sep){row.push(f);f=""}else if(ch==="\n"){row.push(f.replace(/\r$/,""));rows.push(row);row=[];f=""}else f+=ch}
    if(f||row.length){row.push(f.replace(/\r$/,""));rows.push(row)}
    return rows.filter(r=>r.some(x=>x!=="")).map(r=>r.map(x=>/^'[=+\-@]/.test(x)?x.slice(1):x));
  }
  // Aceita 10/10/2026, 10/10/26 e 2026-10-10 (o Excel às vezes muda o formato ao salvar).
  function toTs(d,t){d=String(d||"").trim();let D,M,Y;
    if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(d))[Y,M,D]=d.split("-").map(Number);else[D,M,Y]=d.split("/").map(Number);
    if(Y<100)Y+=2000;const[hh,mm]=String(t||"").trim().split(":").map(Number);
    const ts=new Date(Y,M-1,D,hh,mm).getTime();if(!isFinite(ts))throw new Error("data");return ts}
  // Lê o CSV exportado pelo app e devolve as observações (não grava nada).
  function sessionsFromCSV(txt,{species=[],exp=null}={}){
    const R=parseCSV(txt);if(R.length<2)throw new Error("vazio");
    const h=R[0].map(norm);const ix=n=>h.indexOf(norm(n));
    const iE=ix("Experimento"),iS=ix("Espécie"),iO=ix("Observador"),iA=ix("Animal"),iD=ix("Data"),iH=ix("Hora"),iI=ix("Intervalo (min)"),iObs=ix("Observação");
    if(iA<0||iD<0||iH<0)throw new Error("fmt");
    const first=Math.max(iH,iI)+1,last=iObs>=0?iObs:R[0].length;const compNames=R[0].slice(first,last);
    const spName=(iS>=0&&R[1][iS])||exp?.especie||"Animal";const sp=species.find(x=>norm(x.nome)===norm(spName));
    const comp=compNames.map(n=>{const ref=sp?.comp.find(c=>norm(c.nome)===norm(n));return{id:uid(),nome:n,tipo:ref?.tipo||"comum"}});
    const groups={};R.slice(1).forEach(r=>{const k=(r[iE]||"")+"|"+(r[iO]||"");(groups[k]=groups[k]||[]).push(r)});
    const out=[];
    for(const k in groups){const rows=groups[k];const animais=[...new Set(rows.map(r=>r[iA]))];
      const ts=rows.map(r=>toTs(r[iD],r[iH]));const t0=Math.min(...ts),tEnd=Math.max(...ts);
      const a0=rows.filter(r=>r[iA]===animais[0]).map(r=>toTs(r[iD],r[iH])).sort((a,b)=>a-b);
      const intervalo=iI>=0&&+rows[0][iI]?+rows[0][iI]:(a0.length>1?Math.round((a0[1]-a0[0])/60000):5);
      const duracao=Math.max(intervalo/60,(tEnd-t0)/36e5+intervalo/60);
      const s={id:uid(),expId:exp?exp.id:null,nome:rows[0][iE]||"Observação importada",especie:sp?.nome||spName,comp,observador:(iO>=0&&rows[0][iO])||"",animais,animalIds:null,inicio:t0,intervalo,duracao,marks:{},obs:{}};
      if(exp)s.animalIds=animais.map((_,i)=>sessionAnimalId(exp,s,i));
      animais.forEach((_,i)=>{s.marks[i]={};s.obs[i]={}});
      rows.forEach((r,j)=>{const a=animais.indexOf(r[iA]),i=Math.round((ts[j]-t0)/(intervalo*60000));
        const m=comp.filter((c,ci)=>{const v=norm(r[first+ci]);return v==="1"||v==="x"}).map(c=>c.id);
        if(m.length)s.marks[a][i]=m;if(iObs>=0&&r[iObs])s.obs[a][i]=r[iObs]});
      out.push(s)}
    return out;
  }

  return{uid,pad,hhmm,dmy,parseDay,dayDiff,norm,grupo,gmdOf,performance,sessionAnimalId,behaviorVars,dataset,
    nSlots,slotDate,marked,sessionSignature,toCSV,sessionCSV,parseCSV,sessionsFromCSV};
})();
if(typeof module!=="undefined")module.exports=Data;
