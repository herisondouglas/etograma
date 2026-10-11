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

  /* ---------- animais ---------- */
  // Identificação principal: número da baia (rotulo "Baia") ou brinco. Se faltar uma, usa a outra.
  const porBaia=e=>e.rotulo==="Baia";
  // Animal que saiu do experimento (morte, descarte…) tem a.saida = { data, motivo, obs? }: fica no histórico, fora das análises.
  const ativo=a=>!a.saida;
  const ident=(e,a)=>String((porBaia(e)?(a.baia||a.brinco):(a.brinco||a.baia))||"");
  // "1-12, 15" → ["1",…,"12","15"]. Intervalos só com números inteiros (até 500 de uma vez).
  function parseIds(txt){const out=[];
    for(const part of String(txt||"").split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean)){
      const m=part.match(/^(\d+)\s*(?:-|a|até)\s*(\d+)$/i);
      if(m&&+m[2]>=+m[1]&&+m[2]-+m[1]<=500){const w=m[1].length>1&&m[1][0]==="0"?m[1].length:0;for(let i=+m[1];i<=+m[2];i++)out.push(w?String(i).padStart(w,"0"):String(i))}
      else out.push(part)}
    return out}
  // Atualiza dados de versões antigas: antes, em experimentos por baia, o número da baia ficava no campo "brinco".
  function migrate(d){
    for(const e of d.experiments||[])if(porBaia(e))for(const a of e.animais||[])if(a.baia==null){a.baia=a.brinco;a.brinco=""}
    return d}
  /* ---------- fase de adaptação ----------
     g.etapas = [{inicio:"AAAA-MM-DD", conc:%}] em ordem de data; a última é a dieta final.
     Volumoso (silagem, feno…) = 100 − concentrado. Uma etapa só = sem adaptação. */
  const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  const addDays=(s,n)=>{const d=parseDay(s);d.setDate(d.getDate()+n);return iso(d)};
  const r1=x=>Math.round(x*10)/10;
  // De ini% até fim% de concentrado, mudando "passo" pontos a cada "dias" dias. Se ini é maior que fim, desce.
  // abaixo="direto": dieta que fica abaixo do início já começa na final (ex.: Dieta 40% com início 50%).
  function gerarEtapas({inicio,ini,fim,passo,dias,abaixo="desce"}){
    fim=r1(+fim);ini=+ini;passo=Math.abs(+passo);dias=Math.max(1,Math.round(+dias)||7);
    if(!isFinite(ini)||!(passo>0)||Math.abs(ini-fim)<1e-9||(abaixo==="direto"&&fim<ini))return[{inicio,conc:fim}];
    const dir=fim>ini?1:-1,out=[];let c=ini,k=0;
    while(dir*(fim-c)>1e-9&&k<60){out.push({inicio:addDays(inicio,k*dias),conc:r1(c)});c+=dir*passo;k++}
    out.push({inicio:addDays(inicio,k*dias),conc:fim});return out}
  const etapasDe=g=>[...((g&&g.etapas)||[])].filter(x=>x&&x.inicio).sort((a,b)=>a.inicio<b.inicio?-1:a.inicio>b.inicio?1:0);
  const temAdaptacao=e=>(e.grupos||[]).some(g=>etapasDe(g).length>1);
  // Dia em que o tratamento chega na dieta final (null se não tem adaptação)
  const inicioFinal=g=>{const E=etapasDe(g);return E.length>1?E[E.length-1].inicio:null};
  // Etapa em vigor num dia: {i, n, conc, vol, final, inicio, proxima} (null antes da primeira etapa)
  function etapaEm(g,dia){const E=etapasDe(g);let i=-1;for(let k=0;k<E.length;k++)if(E[k].inicio<=dia)i=k;if(i<0)return null;
    return{i,n:E.length,conc:+E[i].conc,vol:r1(100-E[i].conc),final:i===E.length-1,inicio:E[i].inicio,proxima:E[i+1]?E[i+1].inicio:null}}
  // A partir de quando cada animal entra na análise: com soFinal, só da dieta final do tratamento dele em diante.
  const corte=(e,a,soFinal)=>soFinal?inicioFinal(grupo(e,a.grupoId)):null;

  // Idade em meses a partir da data de nascimento (AAAA-MM-DD).
  function ageMonths(nasc,ref=new Date()){if(!nasc)return NaN;const d=parseDay(nasc);if(!isFinite(d))return NaN;
    return (ref.getFullYear()-d.getFullYear())*12+(ref.getMonth()-d.getMonth())-(ref.getDate()<d.getDate()?1:0)}

  /* ---------- desempenho ---------- */
  // Jejum antes da pesagem, em horas (0 = sem jejum; null = não informado). Fica em cada pesagem (p.jejum).
  const jejumDe=p=>p&&p.jejum!=null&&p.jejum!==""&&isFinite(+p.jejum)?+p.jejum:null;
  // jejum (número): só as pesagens com esse jejum entram (as sem jejum informado também). undefined = todas.
  const pesagensUsadas=(e,jejum)=>(e.pesagens||[]).filter(p=>jejum==null||jejumDe(p)==null||jejumDe(p)===+jejum);
  const pesagensFora=(e,jejum)=>jejum==null?[]:(e.pesagens||[]).filter(p=>jejumDe(p)!=null&&jejumDe(p)!==+jejum);
  // GMD = inclinação da reta peso × dias (mínimos quadrados). Com 2 pesagens é igual a (final − inicial) ÷ dias.
  function gmdOf(pts,d0){
    const P=pts.map(p=>({x:dayDiff(d0,p.d),y:p.w}));const mx=S.mean(P.map(p=>p.x)),my=S.mean(P.map(p=>p.y));
    let sxy=0,sxx=0;for(const p of P){sxy+=(p.x-mx)*(p.y-my);sxx+=(p.x-mx)**2}
    return sxx>0?sxy/sxx:NaN;
  }
  // soFinal: deixa de fora a fase de adaptação (pesagens e consumo antes da dieta final do tratamento)
  function performance(e,{soFinal=false,jejum}={}){
    const pes=[...pesagensUsadas(e,jejum)].sort((a,b)=>a.data<b.data?-1:1);
    return e.animais.map(a=>{const desde=corte(e,a,soFinal);
      const pts=pes.filter(p=>isFinite(p.pesos[a.id])&&(!desde||p.data>=desde)).map(p=>({d:p.data,w:+p.pesos[a.id]}));
      const g=grupo(e,a.grupoId)||{};const o={desde,id:a.id,ident:ident(e,a),brinco:a.brinco,baia:a.baia,grupoId:a.grupoId,grupo:g.nome||"—",meta:+g.gmdMeta,pts};
      if(pts.length){o.p0=pts[0].w;o.pf=pts[pts.length-1].w}
      if(pts.length>=2){o.dias=dayDiff(pts[0].d,pts[pts.length-1].d);o.gmd=o.dias>0?gmdOf(pts,pts[0].d):NaN}
      const cs=e.consumo.filter(c=>!desde||c.data>=desde).map(c=>+c.valores[a.id]).filter(isFinite);o.cms=cs.length?S.mean(cs):NaN;
      o.ca=isFinite(o.cms)&&o.gmd>0?o.cms/o.gmd:NaN;
      o.pv=isFinite(o.cms)&&isFinite(o.p0)?100*o.cms/((o.p0+o.pf)/2):NaN;
      if(isFinite(o.gmd)&&o.meta>0){o.ratio=o.gmd/o.meta;o.status=o.ratio>=1.1?"acima":o.ratio>=.9?"ok":"abaixo"}else o.status="sem";
      if(a.saida){o.saida=a.saida;o.status="saiu"}
      return o;});
  }

  /* ---------- peso antes e depois ----------
     Antes = primeira pesagem do animal no experimento; depois = a última. Sempre o período todo (com a adaptação),
     porque a pergunta é quanto o animal mudou do começo ao fim. Quem saiu aparece nas linhas, mas fica fora das médias e testes. */
  function antesDepois(e,{jejum}={}){
    const pes=[...pesagensUsadas(e,jejum)].sort((a,b)=>a.data<b.data?-1:1);
    const rows=e.animais.map(a=>{const pts=pes.filter(p=>isFinite(p.pesos[a.id])).map(p=>({d:p.data,w:+p.pesos[a.id],j:jejumDe(p)}));
      const g=grupo(e,a.grupoId)||{};const o={id:a.id,ident:ident(e,a),brinco:a.brinco,baia:a.baia,grupoId:a.grupoId,grupo:g.nome||"—",n:pts.length,saida:a.saida||null};
      if(pts.length){o.d0=pts[0].d;o.p0=pts[0].w;o.j0=pts[0].j}
      if(pts.length>=2&&pts[pts.length-1].d>pts[0].d){const L=pts[pts.length-1];o.d1=L.d;o.pf=L.w;o.j1=L.j;o.dias=dayDiff(o.d0,o.d1);o.ganho=o.pf-o.p0;o.pct=o.p0>0?100*o.ganho/o.p0:NaN;o.gmd=o.ganho/o.dias}
      return o});
    const A=rows.filter(r=>!r.saida);
    const grupos=e.grupos.map(g=>{const R=A.filter(r=>r.grupoId===g.id),C=R.filter(r=>isFinite(r.ganho));
      const m=k=>C.length?S.mean(C.map(r=>r[k])):NaN;
      return{id:g.id,nome:g.nome,n:C.length,semFinal:R.filter(r=>isFinite(r.p0)&&!isFinite(r.ganho)).length,p0:m("p0"),pf:m("pf"),ganho:m("ganho"),dpGanho:S.sd(C.map(r=>r.ganho)),pct:m("pct"),dias:m("dias"),
        teste:S.pairedT(C.map(r=>r.p0),C.map(r=>r.pf))}});
    // os grupos começaram parecidos? (todos com peso inicial, mesmo sem a pesagem final) · e ganharam diferente?
    const inicial=S.anova(e.grupos.map(g=>({nome:g.nome,vals:A.filter(r=>r.grupoId===g.id).map(r=>r.p0)})));
    const ganho=S.anova(e.grupos.map(g=>({nome:g.nome,vals:A.filter(r=>r.grupoId===g.id).map(r=>r.ganho)})));
    // inicial e final com jejum diferente (as duas informadas): o enchimento do trato muda o peso
    const jejumDif=A.filter(r=>isFinite(r.ganho)&&r.j0!=null&&r.j1!=null&&r.j0!==r.j1);
    return{rows,grupos,inicial,ganho,jejumDif:jejumDif.length,jejuns:[...new Set(jejumDif.map(r=>r.j0+"→"+r.j1))],completos:A.filter(r=>isFinite(r.ganho)).length,comInicial:A.filter(r=>isFinite(r.p0)).length,ativos:A.length,saidas:rows.length-A.length};
  }

  /* ---------- perda de peso no jejum ----------
     Duas pesagens com até 2 dias de diferença e jejum diferente (ex.: cheio no dia 84, 16 h de jejum no dia 85).
     Perda (%) = (peso com menos jejum − peso com mais jejum) ÷ peso com menos jejum × 100. Usa o par mais recente. */
  function perdaJejum(e){
    const pes=[...e.pesagens].filter(p=>jejumDe(p)!=null).sort((a,b)=>a.data<b.data?-1:1);let par=null;
    for(let i=0;i<pes.length;i++)for(let k=i+1;k<pes.length;k++){const a=pes[i],b=pes[k];
      if(dayDiff(a.data,b.data)<=2&&jejumDe(a)!==jejumDe(b))par=jejumDe(a)<jejumDe(b)?[a,b]:[b,a]}
    if(!par)return null;const[cheio,jej]=par;
    const rows=e.animais.filter(ativo).map(a=>{const w0=+cheio.pesos[a.id],w1=+jej.pesos[a.id];
      return{id:a.id,ident:ident(e,a),grupoId:a.grupoId,grupo:(grupo(e,a.grupoId)||{}).nome||"—",cheio:w0,jejum:w1,kg:w0-w1,pct:w0>0?100*(w0-w1)/w0:NaN}}).filter(r=>isFinite(r.kg));
    const grupos=e.grupos.map(g=>{const v=rows.filter(r=>r.grupoId===g.id);return{id:g.id,nome:g.nome,n:v.length,kg:v.length?S.mean(v.map(r=>r.kg)):NaN,pct:v.length?S.mean(v.map(r=>r.pct)):NaN,dp:S.sd(v.map(r=>r.pct))}});
    return{cheio,jejum:jej,horas:[jejumDe(cheio),jejumDe(jej)],rows,grupos,anova:S.anova(e.grupos.map(g=>({nome:g.nome,vals:rows.filter(r=>r.grupoId===g.id).map(r=>r.pct)})))};
  }

  /* ---------- comportamento ---------- */
  function sessionAnimalId(e,s,k){
    if(s.animalIds&&s.animalIds[k]&&e.animais.some(a=>a.id===s.animalIds[k]))return s.animalIds[k];
    // pelo nome salvo na observação ("Baia 7", "07"…): primeiro pela identificação principal, depois pela outra
    const n=norm(s.animais[k]),hit=k=>k&&(n===k||n.endsWith(" "+k));
    // animais ativos têm preferência (a baia de um animal que saiu pode ter sido reocupada)
    const pool=[...e.animais.filter(ativo),...e.animais.filter(a=>!ativo(a))];
    const a=pool.find(a=>hit(norm(ident(e,a))))||pool.find(a=>hit(norm(a.brinco))||hit(norm(a.baia)));return a?a.id:null;
  }
  // min/dia = (marcações do comportamento ÷ horários marcados) × 1440
  function behaviorVars(e,sessions,{soFinal=false}={}){
    const acc={},names={};
    sessions.filter(s=>s.expId===e.id).forEach(s=>{
      s.animais.forEach((_,k)=>{const aid=sessionAnimalId(e,s,k);if(!aid)return;
        const desde=corte(e,e.animais.find(a=>a.id===aid),soFinal),t0=desde?parseDay(desde).getTime():null;
        const M=s.marks[k]||{};const A=acc[aid]=acc[aid]||{obs:0,c:{}};
        for(const i in M){const arr=M[i];if(!arr||!arr.length)continue;if(t0&&s.inicio+i*s.intervalo*60000<t0)continue;A.obs++;
          for(const cid of arr){const c=s.comp.find(x=>x.id===cid);if(!c)continue;const key="b:"+norm(c.nome);names[key]=c.nome;A.c[key]=(A.c[key]||0)+1}}
      });});
    const vars=Object.keys(names).map(k=>({key:k,nome:names[k]+" (min/dia)",curto:names[k],comp:true}));
    const by={};for(const aid in acc){by[aid]={};for(const v of vars)by[aid][v.key]=acc[aid].obs?(acc[aid].c[v.key]||0)/acc[aid].obs*1440:NaN;by[aid]._obs=acc[aid].obs}
    return{vars,by};
  }
  function dataset(e,sessions,opt={}){
    const P=performance(e,opt),BV=behaviorVars(e,sessions,opt),AD=Object.fromEntries(antesDepois(e,opt).rows.map(r=>[r.id,r]));
    const base=[{key:"p0",nome:"Peso inicial (kg)"},{key:"pf",nome:"Peso atual (kg)"},{key:"gmd",nome:"GMD (kg/dia)"},{key:"cms",nome:"Consumo de MS (kg/dia)"},{key:"ca",nome:"Conversão alimentar (kg MS/kg)"},{key:"gt",nome:"Ganho total no experimento (kg)"}];
    // quem saiu do experimento não entra na estatística
    const rows=P.filter(p=>!p.saida).map(p=>({id:p.id,ident:p.ident,brinco:p.brinco,baia:p.baia,grupoId:p.grupoId,grupo:p.grupo,v:{p0:p.p0,pf:p.pf,gmd:p.gmd,cms:p.cms,ca:p.ca,gt:AD[p.id]?.ganho,...(BV.by[p.id]||{})}}));
    const vars=[...base,...BV.vars].filter(v=>rows.filter(r=>isFinite(r.v[v.key])).length>=3);
    return{rows,vars,perf:P,saidas:P.length-rows.length};
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

  return{iso,addDays,gerarEtapas,etapasDe,temAdaptacao,inicioFinal,etapaEm,uid,pad,hhmm,dmy,parseDay,dayDiff,norm,grupo,porBaia,ativo,ident,parseIds,migrate,ageMonths,gmdOf,performance,jejumDe,pesagensUsadas,pesagensFora,antesDepois,perdaJejum,sessionAnimalId,behaviorVars,dataset,
    nSlots,slotDate,marked,sessionSignature,toCSV,sessionCSV,parseCSV,sessionsFromCSV};
})();
if(typeof module!=="undefined")module.exports=Data;
