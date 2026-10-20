// カット（index.html）と攻撃編（attack.html）共通：横から見た図・人・ラケット・手元ルーペ・再生
const fmt=(n,d=1)=>(Math.round(n*10**d)/10**d).toFixed(d);
const css=()=>{const c=getComputedStyle(document.documentElement);return n=>c.getPropertyValue(n).trim();};

let S=null,anim={t:0,speed:0.25,playing:!matchMedia("(prefers-reduced-motion: reduce)").matches,last:0,hold:0,ang:0};
let VIEW=(window.innerWidth<700)?"zoom":"fit";
// 拡大表示の縮尺（1mあたりのピクセル数）。画面の高さだけで決め、ページや設定によらず同じにする
function zoomScale(){return Math.min(85,Math.max(50,window.innerHeight*0.3/2.7));}
function geom(){const cv=$("court"),wrap=$("courtWrap"),CW=wrap.clientWidth||340;
  const dist=S.dist,xmin=Math.min(-dist-0.95,-0.9),xmax=TL+(typeof courtXPad==="function"?courtXPad():1.1);let ymax=Math.max(0.5,FLOOR+HUMAN+0.08);
  [S.inc.pts,S.out?S.out.pts:[]].forEach(p=>{for(let i=0;i<p.length;i+=20){const q=p[i];if(q[0]>xmin&&q[0]<xmax)ymax=Math.max(ymax,q[1]);}});
  ymax+=0.12;const xr=xmax-xmin,yr=ymax-FLOOR;let sc,W,H;
  if(VIEW==="zoom"){sc=zoomScale();H=Math.round(yr*sc+18);W=Math.max(CW,Math.round(xr*sc));}else{W=CW;sc=W/xr;H=Math.round(yr*sc+18);}
  return {cv,W,H,X:x=>(x-xmin)*sc,Y:y=>H-12-(y-FLOOR)*sc,xmin,xmax};}
function drawCourt(){if(!S)return;const g=geom(),{cv,W,H,X,Y,xmin,xmax}=g,dpr=window.devicePixelRatio||1;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.height=H+"px";cv.style.width=W+"px";}
  const c=cv.getContext("2d"),col=css();c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  c.font="11px "+col("--f-body");
  c.strokeStyle=col("--line");c.lineWidth=1;c.beginPath();c.moveTo(0,Y(FLOOR));c.lineTo(W,Y(FLOOR));c.stroke();
  c.fillStyle=col("--table");c.fillRect(X(0),Y(0),X(TL)-X(0),5);
  c.strokeStyle=col("--table");c.lineWidth=2;[0.25,TL-0.25].forEach(x=>{c.beginPath();c.moveTo(X(x),Y(0));c.lineTo(X(x),Y(FLOOR));c.stroke();});
  c.strokeStyle=col("--net");c.beginPath();c.moveTo(X(NETX),Y(0));c.lineTo(X(NETX),Y(NETH));c.stroke();
  c.fillStyle=col("--muted");c.fillText("自分",X(0.35),Y(0)+16);c.fillText("相手",X(TL-0.65),Y(0)+16);
  if(S.dist>0)c.fillText(fmt(S.dist,1)+"m後方",Math.max(2,X(-S.dist)+4),Y(FLOOR)+11);
  const nIn=S.inc.pts.length,nOut=S.out?S.out.pts.length:0,idx=Math.floor(anim.t/DT);LP=null;
  const path=(pts,color,w,alpha,upto)=>{c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=w;c.beginPath();let st=false;const end=Math.min(pts.length,upto);
    for(let i=0;i<end;i+=6){const p=pts[i];if(p[0]<xmin-0.2||p[0]>xmax+0.4)continue;if(!st){c.moveTo(X(p[0]),Y(p[1]));st=true;}else c.lineTo(X(p[0]),Y(p[1]));}
    if(end>0&&end<pts.length){const p=pts[end-1];c.lineTo(X(p[0]),Y(p[1]));}c.stroke();c.globalAlpha=1;};
  const outCol=S.ok?col("--out"):col("--bad");
  path(S.inc.pts,col("--in"),2,0.25,1e9);if(S.out)path(S.out.pts,outCol,2,0.25,1e9);
  path(S.inc.pts,col("--in"),2.4,1,idx+1);if(S.out&&idx>=nIn)path(S.out.pts,outCol,2.8,1,idx-nIn+1);
  if(S.o){const th=S.face*Math.PI/180,tx=-Math.sin(th),ty=Math.cos(th),L=0.08,cx=-S.dist,cy=S.inc.s.y;
    let off=0;if(idx<nIn){const rem=(nIn-idx)*DT;off=Math.min(0.35,rem*S.sw);}else{off=-Math.min(0.3,(idx-nIn)*DT*S.sw);}
    const bx=cx-Math.cos(S.sa*Math.PI/180)*off,by=cy+Math.sin(S.sa*Math.PI/180)*off;
    const BR=Math.max(2,0.02*Math.abs(X(1)-X(0))),nx=-Math.cos(th),ny=Math.sin(th),ox=nx*(BR+2.25),oy=ny*(BR+2.25);
    drawPerson(c,x=>X(x)+ox,y=>Y(y)+oy,bx,by,col,bx-Math.cos(th)*0.03,by+Math.sin(th)*0.03);
    {const ca=Math.cos(S.sa*Math.PI/180),sa_=Math.sin(S.sa*Math.PI/180),P=o=>[cx-ca*o,cy+sa_*o],A=P(0.35),Bp=P(-0.3);
     c.save();c.strokeStyle=col("--swing");c.lineWidth=2;c.setLineDash([5,4]);c.beginPath();c.moveTo(X(A[0])+ox,Y(A[1])+oy);c.lineTo(X(Bp[0])+ox,Y(Bp[1])+oy);c.stroke();c.setLineDash([]);
     const ang=Math.atan2((Y(Bp[1])-Y(A[1])),(X(Bp[0])-X(A[0]))),ex=X(Bp[0])+ox,ey=Y(Bp[1])+oy;c.fillStyle=col("--swing");c.beginPath();c.moveTo(ex,ey);c.lineTo(ex-9*Math.cos(ang-0.45),ey-9*Math.sin(ang-0.45));c.lineTo(ex-9*Math.cos(ang+0.45),ey-9*Math.sin(ang+0.45));c.closePath();c.fill();
     c.globalAlpha=0.22;c.strokeStyle=col("--ink");c.lineWidth=3;c.lineCap="round";for(const o of [0.35,0.2,0,-0.15,-0.3]){const q=P(o);c.beginPath();c.moveTo(X(q[0]-tx*L)+ox,Y(q[1]-ty*L)+oy);c.lineTo(X(q[0]+tx*L)+ox,Y(q[1]+ty*L)+oy);c.stroke();}
     c.restore();}
    {const rb=document.querySelector("input[name=rub]:checked").value,bh=(rb==="11"||rb==="ox"),FR=bh?"#262626":"#c0392b",BK=bh?"#c0392b":"#262626",WD="#c9a46a";LP={bx,by,th,sa:S.sa*Math.PI/180,FR,BK,WD};
     const seg=(k,colr,w,a0,a1)=>{c.strokeStyle=colr;c.lineWidth=w;c.beginPath();c.moveTo(X(bx+tx*a0)+nx*(BR+k),Y(by+ty*a0)+ny*(BR+k));c.lineTo(X(bx+tx*a1)+nx*(BR+k),Y(by+ty*a1)+ny*(BR+k));c.stroke();};
     c.lineCap="butt";seg(3.75,BK,1.5,-L,L);seg(2.25,WD,1.5,-L,L);seg(0.75,FR,1.5,-L,L);
     if(bh){c.strokeStyle=col("--muted");c.lineWidth=0.8;seg(0,col("--muted"),0.8,-L,L);}}}
  let p=null;if(idx<nIn)p=S.inc.pts[idx];else if(S.out&&idx-nIn<nOut)p=S.out.pts[idx-nIn];else if(S.out)p=S.out.pts[nOut-1];else p=S.inc.pts[nIn-1];
  if(p){const px=X(p[0]),py=Y(p[1]),r=Math.max(2,0.02*Math.abs(X(1)-X(0)));c.fillStyle=col("--ball");c.strokeStyle=col("--ink");c.lineWidth=1.2;c.beginPath();c.arc(px,py,r,0,Math.PI*2);c.fill();c.stroke();
    c.strokeStyle=col("--ballmark");c.lineWidth=1.2;c.beginPath();c.moveTo(px-Math.cos(anim.ang)*r,py-Math.sin(anim.ang)*r);c.lineTo(px+Math.cos(anim.ang)*r,py+Math.sin(anim.ang)*r);c.stroke();
    c.beginPath();c.arc(px+Math.cos(anim.ang)*r*0.55,py+Math.sin(anim.ang)*r*0.55,Math.max(0.8,r*0.25),0,Math.PI*2);c.fillStyle=col("--ballmark");c.fill();}
  if(VIEW==="zoom"&&anim.playing&&p){const wrap=$("courtWrap");const target=X(p[0])-wrap.clientWidth*0.5;wrap.scrollLeft+=(target-wrap.scrollLeft)*0.15;}
  const ia=S.inc.pts[0]?S.inc.pts[0][2]:0,oa=S.o?S.o.om:0;let ph="";if(idx<nIn)ph="相手の打球（"+(ia>=0?"上回転":"下回転")+"）";else if(S.out&&idx-nIn<nOut)ph="返球（相手から見て"+(oa>=0?"下回転":"上回転")+"）";else ph="着地";
  $("phase").textContent=ph;drawLoupe(p,col,idx,nIn);}
let LP=null;
// 手元ルーペ：図の下に置く横長の帯。ラケットを左寄りに置き、台側（右）からボールが来るのを見せる
let LOUPE_ON=true;try{LOUPE_ON=localStorage.getItem("loupeOn")!=="0";}catch(e){}
{const b=document.getElementById("loupeBtn");if(b){b.setAttribute("aria-pressed",LOUPE_ON?"true":"false");
  b.addEventListener("click",()=>{LOUPE_ON=!LOUPE_ON;b.setAttribute("aria-pressed",LOUPE_ON?"true":"false");try{localStorage.setItem("loupeOn",LOUPE_ON?"1":"0");}catch(e){}if(S)drawCourt();});}}
function drawLoupe(p,col,idx,nIn){const lc=document.getElementById("loupe");if(!lc)return;if(!LP||!LOUPE_ON){lc.style.display="none";return;}lc.style.display="block";
  const w=lc.clientWidth||340,h=lc.clientHeight||110,dpr=window.devicePixelRatio||1;if(lc.width!==Math.round(w*dpr)||lc.height!==Math.round(h*dpr)){lc.width=Math.round(w*dpr);lc.height=Math.round(h*dpr);}
  const c=lc.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const K=h/0.26,{bx,by,th,sa,FR,BK,WD}=LP,ox0=w*0.35,LX=x=>ox0+(x-bx)*K,LY=y=>h/2-(y-by)*K,BRm=0.02;
  const nx=-Math.cos(th),ny=Math.sin(th),tx=-Math.sin(th),ty=Math.cos(th),HL=0.079;
  const inWin=q=>LX(q[0])>-20&&LX(q[0])<w+20&&Math.abs(q[1]-by)<0.2;
  const pth=(pts,color,w_,alpha,upto)=>{c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=w_;c.beginPath();let st=false;const end=Math.min(pts.length,upto);
    for(let i=0;i<end;i++){const q=pts[i];if(!inWin(q)){st=false;continue;}if(!st){c.moveTo(LX(q[0]),LY(q[1]));st=true;}else c.lineTo(LX(q[0]),LY(q[1]));}c.stroke();c.globalAlpha=1;};
  const outCol=S.ok?col("--out"):col("--bad");
  pth(S.inc.pts,col("--in"),2,0.25,1e9);if(S.out)pth(S.out.pts,outCol,2,0.25,1e9);
  pth(S.inc.pts,col("--in"),2.4,1,idx+1);if(S.out&&idx>=nIn)pth(S.out.pts,outCol,2.8,1,idx-nIn+1);
  {const ax=Math.cos(sa),ay=-Math.sin(sa),mx=bx-tx*0.105+nx*0.03,my=by-ty*0.105+ny*0.03,x0=mx-ax*0.035,y0=my-ay*0.035,x1=mx+ax*0.035,y1=my+ay*0.035,ang=Math.atan2(LY(y1)-LY(y0),LX(x1)-LX(x0));
   c.strokeStyle=col("--swing");c.fillStyle=col("--swing");c.lineWidth=2;c.setLineDash([4,3]);c.beginPath();c.moveTo(LX(x0),LY(y0));c.lineTo(LX(x1),LY(y1));c.stroke();c.setLineDash([]);
   const ex=LX(x1),ey=LY(y1);c.beginPath();c.moveTo(ex,ey);c.lineTo(ex-8*Math.cos(ang-0.45),ey-8*Math.sin(ang-0.45));c.lineTo(ex-8*Math.cos(ang+0.45),ey-8*Math.sin(ang+0.45));c.closePath();c.fill();}
  let d=BRm;for(const [w_,colr] of [[0.0035,FR],[0.006,WD],[0.0035,BK]]){const a=d,b=d+w_;c.fillStyle=colr;c.beginPath();
    c.moveTo(LX(bx+nx*a+tx*HL),LY(by+ny*a+ty*HL));c.lineTo(LX(bx+nx*b+tx*HL),LY(by+ny*b+ty*HL));c.lineTo(LX(bx+nx*b-tx*HL),LY(by+ny*b-ty*HL));c.lineTo(LX(bx+nx*a-tx*HL),LY(by+ny*a-ty*HL));c.closePath();c.fill();c.strokeStyle=col("--muted");c.lineWidth=0.6;c.stroke();d=b;}
  if(p&&inWin(p)){const px=LX(p[0]),py=LY(p[1]),r=BRm*K;c.fillStyle=col("--ball");c.strokeStyle=col("--ink");c.lineWidth=1.2;c.beginPath();c.arc(px,py,r,0,Math.PI*2);c.fill();c.stroke();
    c.strokeStyle=col("--ballmark");c.lineWidth=2;c.beginPath();c.moveTo(px-Math.cos(anim.ang)*r,py-Math.sin(anim.ang)*r);c.lineTo(px+Math.cos(anim.ang)*r,py+Math.sin(anim.ang)*r);c.stroke();
    c.beginPath();c.arc(px+Math.cos(anim.ang)*r*0.55,py+Math.sin(anim.ang)*r*0.55,1.8,0,Math.PI*2);c.fillStyle=col("--ballmark");c.fill();}
  c.fillStyle=col("--muted");c.font="10px "+col("--f-body");c.fillText("手元（実物比）",6,13);}
const HUMAN=1.65;
function personPose(hx,hy,gx,gy){const H=HUMAN,f=H/1.65,L1=0.30*f,L2=0.36*f,grip=0.12;
  const cx=-S.dist;const gdx=gx==null?0:gx-hx+grip;const footX=Math.min(cx+gdx-0.45*f,-0.2);
  const base=0.10*f;let drop=base,lean=0.04;
  const tx=gx??hx-grip,ty=gy??hy;
  for(let i=0;i<60;i++){const sx=footX+0.06+lean,sy=FLOOR+1.40*f-drop;if(Math.hypot(tx-sx,ty-sy)<=(L1+L2)*0.97)break;drop=Math.min(0.55*f,drop+0.0125*f);lean=Math.min(0.35*f,0.04+(drop-base)*0.7);}
  const shX=footX+0.06+lean,sY=FLOOR+1.40*f-drop,hipX=footX+0.02-(drop-base)*0.25,hY=FLOOR+0.86*f-drop*0.85;
  const kneeX=footX+0.18*f*(0.6+drop/(0.5*f)),kneeY=FLOOR+0.46*f-drop*0.3;
  let dx=tx-shX,dy=ty-sY,d=Math.hypot(dx,dy);const ext=d/(L1+L2);const dd=Math.min(d,(L1+L2)*0.999);
  const ang=Math.atan2(dy,dx),cosA=(L1*L1+dd*dd-L2*L2)/(2*L1*dd),a1=Math.acos(Math.max(-1,Math.min(1,cosA)));
  const elX=shX+L1*Math.cos(ang-a1),elY=sY+L1*Math.sin(ang-a1);
  const handX=shX+dd*Math.cos(ang),handY=sY+dd*Math.sin(ang);
  const elbowDeg=180-Math.acos(Math.max(-1,Math.min(1,(L1*L1+L2*L2-dd*dd)/(2*L1*L2))))*180/Math.PI;
  const lv=[[FLOOR+0.47*f-drop*0.3,"膝"],[hY,"腰"],[hY+0.14*f,"へそ"],[sY-0.12*f,"胸"],[sY,"肩"]];
  let body="肩より上";for(const [y,n] of lv){if(hy<=y+0.04){body=n+"の高さ"+(hy<y-0.06?"より下":"");break;}}
  return {f,footX,shX,sY,hipX,hY,kneeX,kneeY,elX,elY,handX,handY,ext,elbowDeg,drop,lean,body};}
function armLabel(ext){return ext>0.95?["伸びきり（届くのがやっと）","--bad"]:ext>0.85?["かなり伸びている","--in"]:ext<0.45?["窮屈（体に近すぎ）","--in"]:["肘に余裕あり","--out"];}
function drawPerson(c,X,Y,hx,hy,col,gx,gy){const P=personPose(hx,hy,gx,gy),f=P.f,H=HUMAN;
  c.save();c.globalAlpha=0.55;c.strokeStyle=col("--muted");c.lineCap="round";c.lineJoin="round";c.lineWidth=3;
  c.beginPath();c.moveTo(X(P.footX+0.12),Y(FLOOR));c.lineTo(X(P.kneeX),Y(P.kneeY));c.lineTo(X(P.hipX),Y(P.hY));c.lineTo(X(P.shX),Y(P.sY));c.stroke();
  c.beginPath();c.moveTo(X(P.footX-0.28*f),Y(FLOOR));c.lineTo(X(P.kneeX-0.24*f),Y(P.kneeY+0.02));c.lineTo(X(P.hipX),Y(P.hY));c.stroke();
  c.beginPath();c.moveTo(X(P.shX),Y(P.sY));c.lineTo(X(P.elX),Y(P.elY));c.lineTo(X(P.handX),Y(P.handY));c.stroke();
  const headX=P.shX+0.05+P.lean*0.4,headY=P.sY+0.15*f;const r=Math.max(4,X(0.11*f)-X(0));c.beginPath();c.arc(X(headX),Y(headY),r,0,Math.PI*2);c.stroke();
  c.globalAlpha=1;const [lab,cv]=armLabel(P.ext);c.fillStyle=col(cv);c.beginPath();c.arc(X(P.elX),Y(P.elY),3.5,0,Math.PI*2);c.fill();
  c.fillStyle=col("--muted");c.font="10px "+col("--f-body");c.textAlign="center";c.fillText(Math.round(H*100)+"cm",X(headX),Y(headY)-r-4);c.textAlign="left";c.restore();
  const el=$("o-arm");if(el){const txt=lab+"（肘 "+Math.round(P.elbowDeg)+"°曲げ）";if(el.textContent!==txt)el.textContent=txt;const b=$("o-body");if(b&&b.textContent!==P.body)b.textContent=P.body;}}
function curOm(){if(!S)return 0;const nIn=S.inc.pts.length,idx=Math.floor(anim.t/DT);
  if(idx<nIn)return S.inc.pts[idx][2];if(S.out&&idx-nIn<S.out.pts.length)return S.out.pts[idx-nIn][2];return 0;}
function total(){return S?(S.inc.pts.length+(S.out?S.out.pts.length:0))*DT:0;}
function tick(ts){const dt=anim.last?Math.min(0.05,(ts-anim.last)/1000):0;anim.last=ts;
  if(anim.playing&&S){if(anim.t>=total()){anim.hold+=dt;if(anim.hold>0.9){anim.t=0;anim.hold=0;}}else anim.t+=dt*anim.speed;
    const om=curOm();anim.ang-=Math.sign(om)*Math.min(Math.abs(om)/(2*Math.PI)/25,6)*2*Math.PI*dt;}
  drawCourt();requestAnimationFrame(tick);}
function arrow(c,x0,y0,x1,y1,color,w,dash){c.strokeStyle=color;c.fillStyle=color;c.lineWidth=w;c.setLineDash(dash||[]);c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();c.setLineDash([]);
  const a=Math.atan2(y1-y0,x1-x0),h=8;c.beginPath();c.moveTo(x1,y1);c.lineTo(x1-h*Math.cos(a-0.4),y1-h*Math.sin(a-0.4));c.lineTo(x1-h*Math.cos(a+0.4),y1-h*Math.sin(a+0.4));c.closePath();c.fill();}
function drawInset(){if(!S||!S.o)return;const s=S.inc.s,o=S.o,cv=$("inset"),dpr=window.devicePixelRatio||1,W=cv.clientWidth||300,H=200;
  cv.width=W*dpr;cv.height=H*dpr;cv.style.height=H+"px";const c=cv.getContext("2d"),col=css();c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  const cx=W*0.42,cy=H*0.5,mx=Math.max(Math.hypot(s.vx,s.vy),Math.hypot(o.vx,o.vy),Math.hypot(o.Rx,o.Ry),1),sc=Math.min(W*0.5,H*0.42)/mx;
  c.strokeStyle=col("--ink");c.lineWidth=4;c.lineCap="round";c.beginPath();c.moveTo(cx-o.tx*55,cy+o.ty*55);c.lineTo(cx+o.tx*55,cy-o.ty*55);c.stroke();c.lineCap="butt";
  arrow(c,cx-s.vx*sc,cy+s.vy*sc,cx,cy,col("--in"),2.5);arrow(c,cx,cy,cx+o.Rx*sc,cy-o.Ry*sc,col("--swing"),2,[5,4]);arrow(c,cx,cy,cx+o.vx*sc,cy-o.vy*sc,col("--out"),3);
  c.fillStyle=col("--muted");c.font="11px "+col("--f-body");c.fillText("← 自分側",6,H-8);c.textAlign="right";c.fillText("相手側 →",W-6,H-8);c.textAlign="left";}
function aimMode(){return document.querySelector("input[name=aim]:checked").value;}
function getInc(dist){const arc=$("arc").checked?"high":"low";return aimMode()==="angle"?incoming(+$("v0").value,+$("rps").value,0,dist,arc,+$("la").value):incoming(+$("v0").value,+$("rps").value,+$("bx").value,dist,arc);}
function allowH(x){const hb=+$("hb").value;if(hb>=100)return Infinity;return hb/100+(+$("hs").value/100)*Math.max(0,x-TL);}
function critMode(){return document.querySelector("input[name=crit]:checked").value;}
function okRes(r){if(r.res!=="入る")return false;if(critMode()==="target"){return Math.abs((TL-r.land)-(+$("tg").value))<=(+$("tol").value)/100&&(!r.pk||r.pk.y<=(+$("pmax").value)/100);}return !r.pk||r.pk.y<=allowH(r.pk.x);}
function pkWhere(x){const d=x-TL;return d>=0?"エンド後方"+fmt(d,2)+"m":"台の上（エンドの"+fmt(-d,2)+"m手前）";}
