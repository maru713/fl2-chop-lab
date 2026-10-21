// レシーブ編・サーブ編・サーブレシーブ編で共通：3次元のボールの飛び方、台での弾み、ラケットとの接触
// 座標：x＝台の長さ方向（0が自分（レシーバー）側のエンド、TLがサーバー側のエンド）、y＝レシーバーから見て左、z＝台の上面からの高さ
const M=0.0027,R=0.02,AR=Math.PI*R*R,RHO=1.2,CD=0.5,G=9.8;
const TL=2.74,HW=0.7625,NETX=1.37,NETH=0.1525;
const PRE={g9:{k:0.95,e:0.84,es:0.021,et:0.35,keep:1,pip:false},inv:{k:0.8,e:0.88,es:0.021,et:0.45,keep:1,pip:false},ox:{k:0.15,e:0.45,es:0,et:0,keep:0.8,pip:true},"11":{k:0.15,e:0.55,es:0,et:0,keep:0.8,pip:true}};
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],nrm=a=>Math.hypot(a[0],a[1],a[2]);
function acc(v,w){const sp=nrm(v)||1e-6,q=0.5*RHO*AR*sp*sp/M;const c=cross(w,v),cn=nrm(c),Sp=R*(cn/sp)/sp;const [cd,cl]=aero(Sp);let a=mul(v,-q*cd/sp);a[2]-=G;
  if(cn>1e-9)a=add(a,mul(c,q*cl/cn));return a;}
function step(s,dt){const a=acc(s.v,s.w);return {p:add(s.p,mul(s.v,dt)),v:add(s.v,mul(a,dt)),w:mul(s.w,Math.exp(-0.15*dt))};}
function bounce(s){const vz=s.v[2],v2=[s.v[0],s.v[1],-0.89*vz];const u=add([s.v[0],s.v[1],0],cross(s.w,[0,0,-R]));const un=Math.hypot(u[0],u[1]);
  let J=[0,0,0];if(un>1e-9){const j=Math.min(0.25*1.89*Math.abs(vz),un/2.5);J=[-u[0]/un*j,-u[1]/un*j,0];}
  return {p:[s.p[0],s.p[1],1e-4],v:add(v2,J),w:add(s.w,mul(cross([0,0,1],J),-1.5/R))};}
const deg=Math.PI/180;
function hitBall(s,n,V,pr){const rv=sub(s.v,V),vn=dot(rv,n);if(vn>-0.3)return {miss:true};
  const vt=sub(rv,mul(n,vn)),u=add(vt,cross(s.w,mul(n,-R)));let k=pr.k;
  let keepX=pr.keep,et=pr.et,eT=null;const ik=invKey();if(ik){k=kLook(Math.abs(vn),nrm(u),ik);eT=kLook(Math.abs(vn),nrm(u),ik+"_e");et=0;keepX=1;}else if(pr.pip){k=kLook(Math.abs(vn),nrm(u));keepX=1;}
  const dvt=mul(u,-k*(1+et)/2.5),e=eT!==null?eT:Math.max(0.3,pr.e-pr.es*Math.max(0,Math.abs(vn)-2));
  const v2=add(add(mul(n,-e*vn),add(vt,dvt)),V),w2=mul(add(s.w,mul(cross(n,dvt),-1.5/R)),keepX);
  return {p:[...s.p],v:v2,w:w2};}
