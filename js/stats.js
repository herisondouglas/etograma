/* ===== Estatística (funções puras) ===== */
const Stats=(function(){
  function lgamma(x){const c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];let y=x,t=x+5.5;t-=(x+0.5)*Math.log(t);let s=1.000000000190015;for(let j=0;j<6;j++)s+=c[j]/++y;return -t+Math.log(2.5066282746310005*s/x)}
  function betacf(a,b,x){const MAXIT=300,EPS=3e-14,FPMIN=1e-300;let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;if(Math.abs(d)<FPMIN)d=FPMIN;d=1/d;let h=d;for(let m=1;m<=MAXIT;m++){const m2=2*m;let aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<FPMIN)d=FPMIN;c=1+aa/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;h*=d*c;aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<FPMIN)d=FPMIN;c=1+aa/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<EPS)break}return h}
  function ibeta(x,a,b){if(x<=0)return 0;if(x>=1)return 1;const bt=Math.exp(lgamma(a+b)-lgamma(a)-lgamma(b)+a*Math.log(x)+b*Math.log(1-x));return x<(a+1)/(a+b+2)?bt*betacf(a,b,x)/a:1-bt*betacf(b,a,1-x)/b}
  const pT=(t,df)=>df>0&&isFinite(t)?ibeta(df/(df+t*t),df/2,.5):NaN;          // bicaudal
  const pF=(F,d1,d2)=>(d1>0&&d2>0&&isFinite(F))?ibeta(d2/(d2+d1*F),d2/2,d1/2):NaN;
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  const sd=a=>{if(a.length<2)return NaN;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1))};
  const se=a=>sd(a)/Math.sqrt(a.length);
  function pearson(xs,ys){
    const P=xs.map((x,i)=>[x,ys[i]]).filter(([x,y])=>isFinite(x)&&isFinite(y));const n=P.length;
    if(n<3)return{n,r:NaN,p:NaN};
    const mx=mean(P.map(p=>p[0])),my=mean(P.map(p=>p[1]));let sxy=0,sxx=0,syy=0;
    for(const[x,y]of P){sxy+=(x-mx)*(y-my);sxx+=(x-mx)**2;syy+=(y-my)**2}
    if(!sxx||!syy)return{n,r:NaN,p:NaN};
    const r=sxy/Math.sqrt(sxx*syy),b=sxy/sxx,a=my-b*mx,df=n-2;
    const t=Math.abs(r)>=1?Infinity:r*Math.sqrt(df/(1-r*r));
    return{n,r,r2:r*r,p:isFinite(t)?pT(t,df):0,a,b,df,t};
  }
  function anova(groups){ // groups: [{nome, vals:[]}]
    const G=groups.map(g=>({...g,vals:g.vals.filter(v=>isFinite(v))})).filter(g=>g.vals.length);
    const all=G.flatMap(g=>g.vals),N=all.length,k=G.length;
    const desc=G.map(g=>({nome:g.nome,n:g.vals.length,media:mean(g.vals),dp:sd(g.vals),ep:se(g.vals)}));
    if(k<2||N-k<1)return{desc,k,N,F:NaN,p:NaN};
    const gm=mean(all);let ssb=0,ssw=0;
    for(const g of G){const m=mean(g.vals);ssb+=g.vals.length*(m-gm)**2;for(const v of g.vals)ssw+=(v-m)**2}
    const dfb=k-1,dfw=N-k,msb=ssb/dfb,msw=ssw/dfw,F=msw>0?msb/msw:Infinity;
    const p=isFinite(F)?pF(F,dfb,dfw):0;
    // comparações par a par: t usando QM do resíduo, Bonferroni
    const pares=[];const m=k*(k-1)/2;
    for(let i=0;i<k;i++)for(let j=i+1;j<k;j++){const a=G[i],b=G[j];const t=(mean(a.vals)-mean(b.vals))/Math.sqrt(msw*(1/a.vals.length+1/b.vals.length));const pr=Math.min(1,pT(Math.abs(t),dfw)*m);pares.push({a:a.nome,b:b.nome,dif:mean(a.vals)-mean(b.vals),p:pr})}
    return{desc,k,N,ssb,ssw,dfb,dfw,msb,msw,F,p,pares,cv:100*Math.sqrt(msw)/gm};
  }
  function niceTicks(min,max,count){
    if(!isFinite(min)||!isFinite(max))return[0,1];
    if(min===max){const d=Math.abs(min)||1;min-=d*.1;max+=d*.1}
    const span=max-min,step0=span/Math.max(1,count),mag=Math.pow(10,Math.floor(Math.log10(step0))),f=step0/mag;
    const step=(f<1.5?1:f<3?2:f<7?5:10)*mag;const lo=Math.floor(min/step)*step,hi=Math.ceil(max/step)*step;
    const out=[];for(let v=lo;v<=hi+step/2;v+=step)out.push(+v.toFixed(10));return out;
  }
  return{lgamma,ibeta,pT,pF,mean,sd,se,pearson,anova,niceTicks};
})();
if(typeof module!=="undefined")module.exports=Stats;
