// Supabase falso para testar a interface no navegador (injetado antes do app carregar).
(function(){
  const TABLES=["experiments","treatments","animals","weighings","intakes","sessions","acessos"];
  const srv=window.__srv={tables:Object.fromEntries(TABLES.map(t=>[t,new Map()])),offline:false,users:new Map(),session:null,listeners:[],rt:null,calls:0};
  let clock=0;const ts=()=>new Date(Date.UTC(2026,9,10,12)+(++clock)*1000).toISOString();
  srv.ts=ts;
  const netErr={message:"TypeError: Failed to fetch",code:""};
  const builder=t=>{const q={filters:[],op:"select"};
    const run=()=>{srv.calls++;if(srv.offline)return{data:null,error:netErr};const T=srv.tables[t];
      if(q.op==="upsert"){for(const r of [].concat(q.rows)){const key=r.id||r.email;if(t==="acessos"&&!srv.isAdmin())return{error:{message:"new row violates row-level security policy"}};const old=T.get(key);const row={deleted:false,...(old||{}),...JSON.parse(JSON.stringify(r)),updated_at:ts()};
          if(t==="experiments"&&!old){row.codigo=Math.random().toString(16).slice(2,8).toUpperCase();row.owner=srv.session?.user.id}T.set(key,row)}return{error:null}}
      let rows=[...T.values()];for(const f of q.filters)rows=rows.filter(f);
      if(q.op==="delete"){if(t==="acessos"&&!srv.isAdmin())return{error:null};for(const r of rows)if(!(t==="acessos"&&r.email===srv.session?.user.email))T.delete(r.email||r.id);return{error:null}}
      if(t==="acessos"&&!srv.isAdmin())rows=rows.filter(r=>r.email===srv.session?.user.email);
      if(q.op==="update"){for(const r of rows)Object.assign(r,q.patch,{updated_at:ts()});return{error:null}}
      rows.sort((a,b)=>a.updated_at<b.updated_at?-1:1);if(q.rng)rows=rows.slice(q.rng[0],q.rng[1]+1);
      if(q.single)return{data:rows[0]?JSON.parse(JSON.stringify(rows[0])):null,error:null};return{data:JSON.parse(JSON.stringify(rows)),error:null}};
    Object.assign(q,{select(){q.op="select";return q},upsert(rows){q.op="upsert";q.rows=rows;return q},update(p){q.op="update";q.patch=p;return q},delete(){q.op="delete";return q},maybeSingle(){q.single=true;return q},
      gt(c,v){q.filters.push(r=>r[c]>v);return q},eq(c,v){q.filters.push(r=>r[c]===v);return q},in(c,v){q.filters.push(r=>v.includes(r[c]));return q},
      order(){return q},range(a,b){q.rng=[a,b];return q},then(res,rej){return new Promise(r=>setTimeout(r,20)).then(run).then(res,rej)}});
    return q};
  // lista de acessos: o primeiro cadastro vira admin; com srv.fechado=true só entra quem está na lista
  srv.isAdmin=()=>srv.tables.acessos.get(srv.session?.user.email)?.papel==="admin";
  srv.libera=(email,papel="membro")=>srv.tables.acessos.set(email,{email,papel,created_at:ts()});
  srv.entrar=(email,nome)=>{let u=srv.users.get(email);if(!u){u={user:{id:"u-"+(srv.users.size+1),email,user_metadata:{nome}},password:"segredo1"};srv.users.set(email,u)}if(!srv.tables.acessos.has(email))srv.libera(email,"admin");srv.session={user:u.user}};
  const emit=(ev)=>srv.listeners.forEach(cb=>cb(ev,srv.session));
  const auth={
    async getSession(){return{data:{session:srv.session}}},
    onAuthStateChange(cb){srv.listeners.push(cb);return{data:{subscription:{unsubscribe(){}}}}},
    async signUp({email,password,options}){if(srv.offline)return{error:netErr};if(srv.fechado&&!srv.tables.acessos.has(email))return{data:{},error:{message:"Database error saving new user",status:500}};if(!srv.tables.acessos.has(email))srv.libera(email,srv.tables.acessos.size?"membro":"admin");if(srv.users.has(email))return{data:{},error:{message:"User already registered"}};
      const user={id:"u-"+(srv.users.size+1),email,user_metadata:options?.data||{}};srv.users.set(email,{user,password});srv.session={user};emit("SIGNED_IN");return{data:{session:srv.session,user},error:null}},
    async signInWithPassword({email,password}){const u=srv.users.get(email);if(!u||u.password!==password)return{error:{message:"Invalid login credentials"}};srv.session={user:u.user};emit("SIGNED_IN");return{data:{session:srv.session},error:null}},
    async signOut(){srv.session=null;emit("SIGNED_OUT");return{error:null}},
    async resetPasswordForEmail(){return{error:null}},async updateUser(){return{error:null}}};
  window.supabase={createClient(url,key){srv.url=url;srv.key=key;return{auth,from:builder,
    async rpc(name,args){if(srv.offline)return{error:netErr};const e=[...srv.tables.experiments.values()].find(x=>x.codigo===String(args.p_codigo).trim().toUpperCase()&&!x.deleted);
      return e?{data:e.id,error:null}:{data:null,error:{message:"Código não encontrado",code:"P0001"}}},
    channel(){return{on(type,f,cb){srv.rt=cb;return this},subscribe(){return this}}},removeChannel(){}}}};
})();
