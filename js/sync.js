/* ===== Sincronização com o Supabase =====
   O app continua salvando primeiro no aparelho (funciona sem internet). Este módulo:
   • converte o db local em linhas das tabelas (toRows) e de volta (applyRows);
   • push: envia só o que mudou desde a última sincronização (comparando com a "sombra" do que já está no banco);
   • pull: busca o que mudou no banco desde a última vez e aplica aqui, sem passar por cima de alteração local ainda não enviada.
   Funções puras + cliente do Supabase injetado → testado em tests/sync.test.js com um banco falso. */
const Sync=(function(){
  const TABLES=["experiments","treatments","animals","weighings","intakes","sessions"];
  const CHILD=["treatments","animals","weighings","intakes","sessions"];
  const nn=v=>v===undefined||v===""?null:v;
  // JSON com chaves em ordem: o banco (jsonb) reordena chaves, então a comparação não pode depender da ordem
  const stable=v=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?"["+v.map(stable).join(",")+"]":"{"+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")+"}";
  const setOpt=(o,k,v)=>{if(v===null||v===undefined||v==="")delete o[k];else o[k]=v};
  const key=(t,id)=>t+":"+id;

  /* ---------- local → linhas ---------- */
  function toRows(db){
    const out=Object.fromEntries(TABLES.map(t=>[t,[]]));
    const exps=db.experiments.filter(e=>!e.exemplo),ids=new Set(exps.map(e=>e.id));
    for(const e of exps){
      out.experiments.push({id:e.id,nome:e.nome||"Experimento",especie_id:nn(e.especieId),especie:nn(e.especie),responsavel:nn(e.responsavel),inicio:nn(e.inicio),rotulo:e.rotulo==="Baia"?"Baia":"Animal",...(e.config?{config:e.config}:{})}); // igual ao app: sem rótulo = identificado pelo brinco
      // config (opções da adaptação/análise) e etapas só vão quando existem: experimentos antigos não mudam
      (e.grupos||[]).forEach((g,i)=>out.treatments.push({id:g.id,experiment_id:e.id,nome:g.nome||"Tratamento",dieta:nn(g.dieta),gmd_meta:g.gmdMeta!==""&&g.gmdMeta!=null&&isFinite(+g.gmdMeta)?+g.gmdMeta:null,cor:nn(g.cor),ordem:i,...(g.etapas?{etapas:g.etapas}:{})}));
      for(const a of e.animais||[])out.animals.push({id:a.id,experiment_id:e.id,treatment_id:nn(a.grupoId),baia:nn(a.baia),brinco:nn(a.brinco),raca:nn(a.raca),sexo:nn(a.sexo),nascimento:nn(a.nascimento),obs:nn(a.obs),saida:a.saida||null});
      for(const p of e.pesagens||[])out.weighings.push({id:p.id,experiment_id:e.id,data:p.data,pesos:p.pesos||{},...(p.jejum!=null&&p.jejum!==""?{jejum:+p.jejum}:{})}); // jejum só vai quando informado
      for(const c of e.consumo||[])out.intakes.push({id:c.id,experiment_id:e.id,data:c.data,valores:c.valores||{}});
    }
    for(const s of db.sessions){if(s.exemplo||(s.expId&&!ids.has(s.expId)))continue; // exemplo nunca vai para o banco
      out.sessions.push({id:s.id,experiment_id:s.expId||null,nome:nn(s.nome),especie:nn(s.especie),observador:nn(s.observador),comp:s.comp||[],animais:s.animais||[],animal_ids:s.animalIds||null,inicio:+s.inicio,intervalo:+s.intervalo,duracao:+s.duracao,marks:s.marks||{},obs:s.obs||{}})}
    return out;
  }
  // { "tabela:id": JSON estável da linha }
  function rowMap(db){const m={},R=toRows(db);for(const t of TABLES)for(const r of R[t])m[key(t,r.id)]=stable(r);return m}

  /* ---------- linhas → local ---------- */
  // Aplica linhas vindas do banco. skip(t,id) = true mantém a versão local (alteração ainda não enviada).
  function applyRows(db,rows,skip=()=>false){
    const findExp=id=>db.experiments.find(e=>e.id===id);
    for(const r of rows.experiments||[]){if(skip("experiments",r.id)&&!r.deleted)continue;let e=findExp(r.id);
      if(r.deleted){if(e){db.experiments=db.experiments.filter(x=>x!==e);db.sessions=db.sessions.filter(s=>s.expId!==r.id);if(db.active===r.id)db.active=db.experiments[0]?.id||null}continue}
      if(!e){e={id:r.id,grupos:[],animais:[],pesagens:[],consumo:[]};db.experiments.push(e);if(!db.active)db.active=e.id}
      e.nome=r.nome;e.rotulo=r.rotulo||"Baia";setOpt(e,"especieId",r.especie_id);setOpt(e,"especie",r.especie);setOpt(e,"responsavel",r.responsavel);setOpt(e,"inicio",r.inicio);setOpt(e,"codigo",r.codigo);if(r.config!==undefined)setOpt(e,"config",r.config)}
    const ordem={};
    const child=(t,list,build)=>{for(const r of rows[t]||[]){const e=findExp(r.experiment_id);if(!e||(skip(t,r.id)&&!r.deleted))continue;
      const arr=e[list],i=arr.findIndex(x=>x.id===r.id);
      if(r.deleted){if(i>=0)arr.splice(i,1);continue}
      const o=i>=0?arr[i]:{id:r.id};build(o,r);if(i<0)arr.push(o)}};
    child("treatments","grupos",(g,r)=>{g.nome=r.nome;setOpt(g,"dieta",r.dieta);setOpt(g,"cor",r.cor);if(r.gmd_meta==null)delete g.gmdMeta;else g.gmdMeta=+r.gmd_meta;if(r.etapas!==undefined)setOpt(g,"etapas",r.etapas);ordem[r.id]=+r.ordem||0});
    child("animals","animais",(a,r)=>{a.grupoId=r.treatment_id;a.baia=r.baia??"";a.brinco=r.brinco??"";for(const k of ["raca","sexo","nascimento","obs","saida"])setOpt(a,k,r[k])});
    child("weighings","pesagens",(p,r)=>{p.data=r.data;p.pesos=r.pesos||{};if(r.jejum!==undefined)setOpt(p,"jejum",r.jejum==null?null:+r.jejum)});
    child("intakes","consumo",(c,r)=>{c.data=r.data;c.valores=r.valores||{}});
    for(const e of db.experiments)if(e.grupos.some(g=>g.id in ordem))e.grupos=e.grupos.map((g,i)=>[g,g.id in ordem?ordem[g.id]:i]).sort((x,y)=>x[1]-y[1]).map(x=>x[0]);
    for(const r of rows.sessions||[]){if(skip("sessions",r.id)&&!r.deleted)continue;const i=db.sessions.findIndex(s=>s.id===r.id);
      if(r.deleted){if(i>=0)db.sessions.splice(i,1);continue}
      if(r.experiment_id&&!findExp(r.experiment_id))continue;
      const s=i>=0?db.sessions[i]:{id:r.id};
      Object.assign(s,{expId:r.experiment_id||null,nome:r.nome||"Observação",especie:r.especie||"",observador:r.observador||"",comp:r.comp||[],animais:r.animais||[],animalIds:r.animal_ids||null,inicio:+r.inicio,intervalo:+r.intervalo,duracao:+r.duracao,marks:r.marks||{},obs:r.obs||{}});
      if(i<0)db.sessions.push(s)}
    return db;
  }

  /* ---------- rede ---------- */
  const isNetwork=err=>!!err&&!err.code&&/fetch|network|load failed|timeout|offline/i.test(String(err.message||err));
  const fail=err=>{const e=new Error(err.message||String(err));e.network=isNetwork(err);e.code=err.code;throw e};
  async function fetchAll(client,t,{since,experimentId,ids}={}){
    const out=[];for(let from=0;;from+=1000){
      let q=client.from(t).select("*");
      if(since)q=q.gt("updated_at",since);
      if(experimentId)q=t==="experiments"?q.eq("id",experimentId):q.eq("experiment_id",experimentId);
      if(ids)q=q.in("id",ids);
      const{data,error}=await q.order("updated_at").range(from,from+999);
      if(error)fail(error);out.push(...data);if(data.length<1000)return out}
  }

  // Envia as alterações locais. shadow é atualizado no lugar. Devolve { enviados, erros, refetch }.
  async function push(client,db,shadow){
    const R=toRows(db),now={};for(const t of TABLES)for(const r of R[t])now[key(t,r.id)]=stable(r);
    let enviados=0;const erros=[],refetch={};
    const noted=(t,id,err)=>{erros.push({tabela:t,id,mensagem:err.message||String(err)});(refetch[t]=refetch[t]||[]).push(id)};
    // 1) inserir / atualizar, na ordem das dependências
    for(const t of TABLES){const ch=R[t].filter(r=>shadow[key(t,r.id)]!==now[key(t,r.id)]);
      for(let i=0;i<ch.length;i+=200){const b=ch.slice(i,i+200);const{error}=await client.from(t).upsert(b,{onConflict:"id"});
        if(!error){b.forEach(r=>shadow[key(t,r.id)]=now[key(t,r.id)]);enviados+=b.length;continue}
        if(isNetwork(error))fail(error);
        for(const r of b){const{error:e2}=await client.from(t).upsert([r],{onConflict:"id"}); // um por um para achar o que falhou
          if(!e2){shadow[key(t,r.id)]=now[key(t,r.id)];enviados++}else{if(isNetwork(e2))fail(e2);shadow[key(t,r.id)]=now[key(t,r.id)];noted(t,r.id,e2)}}}}
    // 2) exclusões: estava no banco e sumiu daqui. Experimento apagado leva junto o que é dele (não precisa apagar filho por filho).
    const gone=t=>Object.keys(shadow).filter(k=>k.startsWith(t+":")&&!(k in now)).map(k=>({id:k.slice(t.length+1),row:JSON.parse(shadow[k])}));
    const expGone=new Set(gone("experiments").map(x=>x.id));
    for(const t of ["experiments",...CHILD]){
      const list=gone(t);if(t!=="experiments")for(const x of list.filter(x=>expGone.has(x.row.experiment_id)))delete shadow[key(t,x.id)];
      const ids=list.filter(x=>t==="experiments"||!expGone.has(x.row.experiment_id)).map(x=>x.id);
      for(let i=0;i<ids.length;i+=200){const b=ids.slice(i,i+200);const{error}=await client.from(t).update({deleted:true}).in("id",b);
        if(!error){b.forEach(id=>delete shadow[key(t,id)]);enviados+=b.length;continue}
        if(isNetwork(error))fail(error);
        for(const id of b){const{error:e2}=await client.from(t).update({deleted:true}).in("id",[id]);
          if(!e2){delete shadow[key(t,id)];enviados++}else{if(isNetwork(e2))fail(e2);delete shadow[key(t,id)];noted(t,id,e2)}}}}
    return{enviados,erros,refetch};
  }

  // Busca o que mudou no banco e aplica. Devolve { changed: Set("tabela:id"), lastPull }.
  async function pull(client,db,shadow,{since=null,experimentId=null,ids=null}={}){
    const got={};let max=since;
    for(const t of TABLES){if(ids&&!ids[t]){got[t]=[];continue}
      got[t]=await fetchAll(client,t,{since,experimentId,ids:ids?ids[t]:null});
      for(const r of got[t])if(r.updated_at&&(!max||r.updated_at>max))max=r.updated_at}
    const before=rowMap(db),codes=()=>Object.fromEntries(db.experiments.map(e=>[e.id,e.codigo])),codesBefore=codes();
    // alteração local ainda não enviada (ou criada durante a sincronização) não é sobrescrita
    const pending=(t,id)=>{const k=key(t,id);return k in before&&before[k]!==shadow[k]};
    applyRows(db,got,pending);
    const after=rowMap(db),changed=new Set();
    for(const k of new Set([...Object.keys(before),...Object.keys(after)]))if(before[k]!==after[k])changed.add(k);
    // o código de convite vem só do banco (não é enviado), mas também precisa ser guardado e mostrado
    const codesAfter=codes();for(const id in codesAfter)if(codesAfter[id]!==codesBefore[id])changed.add(key("experiments",id));
    for(const t of TABLES)for(const r of got[t]){const k=key(t,r.id);if(pending(t,r.id)&&!r.deleted)continue;
      if(k in after)shadow[k]=after[k];else delete shadow[k]}
    return{changed,lastPull:max};
  }

  // Quantas alterações locais ainda não foram para o banco
  function pendingCount(db,shadow){const now=rowMap(db);let n=0;for(const k in now)if(shadow[k]!==now[k])n++;for(const k in shadow)if(!(k in now))n++;return n}
  // Remove do aparelho o que veio do banco (ao sair da conta). O exemplo e o que nunca foi sincronizado ficam.
  function forget(db,shadow){
    const exps=new Set(Object.keys(shadow).filter(k=>k.startsWith("experiments:")).map(k=>k.slice(12)));
    const sess=new Set(Object.keys(shadow).filter(k=>k.startsWith("sessions:")).map(k=>k.slice(9)));
    db.experiments=db.experiments.filter(e=>!exps.has(e.id));
    db.sessions=db.sessions.filter(s=>!sess.has(s.id)&&!exps.has(s.expId));
    if(!db.experiments.some(e=>e.id===db.active))db.active=db.experiments[0]?.id||null;return db}

  // Valida a chave: nunca aceitar a service_role/secret (daria acesso total ao banco a qualquer um com o app)
  function checkKey(k){k=String(k||"").trim();
    if(/^sb_secret_/i.test(k))return"Essa é a chave secreta. Use a chave pública (anon / publishable).";
    if(/^sb_publishable_/i.test(k))return null;
    const p=k.split(".");if(p.length!==3)return"Chave inválida. Copie a chave pública (anon / publishable) em Project Settings → API.";
    try{const b=p[1].replace(/-/g,"+").replace(/_/g,"/");const json=typeof atob==="function"?atob(b+"===".slice((b.length+3)%4)):Buffer.from(b,"base64").toString();
      const role=JSON.parse(json).role;if(role==="service_role")return"Essa é a chave service_role (secreta). Use a chave pública (anon).";if(role!=="anon")return"Chave inválida: use a chave pública (anon / publishable).";}
    catch(e){return"Chave inválida. Copie a chave pública (anon / publishable)."}
    return null}
  const checkUrl=u=>/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(String(u||"").trim())||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(String(u||"").trim())?null:"Endereço inválido. Ex.: https://abcdefgh.supabase.co";

  return{TABLES,stable,toRows,rowMap,applyRows,push,pull,pendingCount,forget,isNetwork,checkKey,checkUrl};
})();
if(typeof module!=="undefined")module.exports=Sync;
