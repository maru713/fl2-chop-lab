// 3次元の図で共通：ラケット（ラバー2面・板・グリップ）を描く。レシーブ編・サーブ編で使う
// c：描く先、P：3次元の点→画面の点（[x,y,奥行き]、見えないときは null）、eye：目の位置、F：焦点距離（ピクセル）
// ballP：ボールの中心、n：面の向き（ボールのある側）、pref：グリップを向けたい向きの目安、bh：バック面（FL2）で打つ
function racket3D(c,P,eye,F,ballP,n,pref,bh,col){
  const poly=(pts,fill,stroke,lw)=>{const pp=pts.map(P);if(pp.some(x=>!x))return;c.beginPath();pp.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw||1;c.stroke();}};
    const RED="#c0392b",BLK="#262626",WOOD="#c9a46a",front=bh?BLK:RED,back=bh?RED:BLK;
    const T=0.012,HL=0.080,HWd=0.0765,GL=0.100;
    let a=pref;a=sub(a,mul(n,dot(a,n)));a=mul(a,1/nrm(a));const b=cross(n,a);
    const cc=add(ballP,mul(n,-(R+T/2)));
    const rim=sd=>{const r=[];for(let k=0;k<32;k++){const t=k/32*2*Math.PI;r.push(add(add(cc,mul(n,sd*T/2)),add(mul(a,HL*Math.cos(t)),mul(b,HWd*Math.sin(t)))));}return r;};
    const fr=rim(1),bk=rim(-1),seeFront=dot(n,sub(eye,cc))>0,TF=bh?0.0029:0.0038,TB=bh?0.0038:0.0029,m1=rim(1-2*TF/T),m2=rim(-1+2*TB/T);
    {const g0=P(add(cc,mul(a,HL*0.9))),g1=P(add(cc,mul(a,HL+GL)));if(g0&&g1){c.strokeStyle=WOOD;c.lineCap="round";c.lineWidth=Math.max(4,0.026/g1[2]*F);c.beginPath();c.moveTo(g0[0],g0[1]);c.lineTo(g1[0],g1[1]);c.stroke();c.strokeStyle=col("--ink");c.lineWidth=1;c.globalAlpha=0.5;c.stroke();c.globalAlpha=1;c.lineCap="butt";}}
    const far=seeFront?bk:fr,near=seeFront?fr:bk;
    // 面の向き（緑）：打つ面の表から外へ出す。面が向こうを向いているときはラケットの陰になるよう先に描く
    const normal=()=>{const nq0=P(add(cc,mul(n,T/2))),nq1=P(add(cc,mul(n,0.09)));if(nq0&&nq1){c.strokeStyle=col("--out");c.lineWidth=2;c.beginPath();c.moveTo(nq0[0],nq0[1]);c.lineTo(nq1[0],nq1[1]);c.stroke();}};
    if(!seeFront)normal();
    poly(far,seeFront?back:front,null);
    for(const [A,B,C] of [[fr,m1,front],[m1,m2,WOOD],[m2,bk,back]])for(let k=0;k<32;k++){const k2=(k+1)%32;poly([A[k],A[k2],B[k2],B[k]],C,null);}
    poly(near,seeFront?front:back,col("--ink"),1.5);
    if(seeFront)normal();
  return {cc,a,b};}
// ラケットの外形の点（面の縁と、グリップの先）。台に当たるかの判定に使う
function racketPoints(ballP,n,pref){const T=0.012,HL=0.080,HWd=0.0765,GL=0.100;let a=sub(pref,mul(n,dot(pref,n)));a=mul(a,1/nrm(a));const b=cross(n,a),cc=add(ballP,mul(n,-(R+T/2))),pts=[];
  for(let k=0;k<24;k++){const t=k/24*2*Math.PI;for(const sd of [-1,1])pts.push(add(add(cc,mul(n,sd*T/2)),add(mul(a,HL*Math.cos(t)),mul(b,HWd*Math.sin(t)))));}
  pts.push(add(cc,mul(a,HL+GL)));return pts;}
