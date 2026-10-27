// 設定の保存（4ページ共通）：スライダー・選択肢の今の値を自動で覚えて次に開いたときに戻す。名前を付けて保存・呼び出しもできる
// ページ側は <section class="panel saves" id="saves"></section> を置き、ページの処理を全部つないだ後で labSettings({...}) を呼ぶ
// page：保存の名前の区別、refresh：値を戻した後にページを計算し直す処理、skip：true を返すと前回の値を戻さない（URLで値を受け取ったときなど）
function labSettings(opt){
  const KEY="fl2lab:"+opt.page+":",box=document.getElementById("saves");
  const load=k=>{try{return JSON.parse(localStorage.getItem(KEY+k));}catch(e){return null;}};
  const store=(k,v)=>{try{localStorage.setItem(KEY+k,JSON.stringify(v));}catch(e){}};
  // 対象：スライダー（id）・チェック（id）・選択肢（name）。保存欄そのものは除く
  const ins=()=>[...document.querySelectorAll("input")].filter(i=>!i.closest("#saves")&&(i.type==="range"&&i.id||i.type==="checkbox"&&i.id||i.type==="radio"&&i.name));
  const keyOf=i=>i.type==="radio"?"r:"+i.name:(i.type==="checkbox"?"c:":"n:")+i.id;
  function collect(){const v={};for(const i of ins()){const k=keyOf(i);if(i.type==="radio"){if(!(k in v))v[k]="";if(i.checked)v[k]=i.value;}else v[k]=i.type==="checkbox"?i.checked:i.value;}return v;}
  function setAll(v){const all=ins();
    for(const i of all){const k=keyOf(i);if(!(k in v))continue;
      if(i.type==="radio"){// ページが変わって無くなった選択肢は、今のまま残す
        if(v[k]===""||all.some(x=>x.type==="radio"&&x.name===i.name&&x.value===v[k]))i.checked=i.value===v[k];}
      else if(i.type==="checkbox")i.checked=!!v[k];else i.value=v[k];}}
  let applying=false;
  // 選ばれている選択肢の処理（表示の切り替え・プリセット）を一度通してから、値をもう一度そろえる
  function apply(v){applying=true;setAll(v);
    for(const i of ins())if(i.type==="checkbox"||i.type==="radio"&&i.checked)i.dispatchEvent(new Event("change",{bubbles:true}));
    setAll(v);if(opt.refresh)opt.refresh();applying=false;}
  let resetting=false,tm=0;
  const saveLast=()=>{clearTimeout(tm);if(!resetting)store("last",collect());};
  const onUser=e=>{if(applying||e.target.closest&&e.target.closest("#saves"))return;clearTimeout(tm);tm=setTimeout(saveLast,400);if(sel.value){sel.value="";syncBtns();}};
  document.addEventListener("input",onUser,true);document.addEventListener("change",onUser,true);
  window.addEventListener("pagehide",saveLast);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveLast();});

  if(!document.getElementById("saves-css")){const st=document.createElement("style");st.id="saves-css";st.textContent=
    ".saves .sv-row{display:flex;gap:6px;align-items:center}"+
    ".saves select{flex:1;min-width:0;font:inherit;font-size:13px;min-height:36px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);padding:0 8px}"+
    ".saves .sv-sub{margin-top:2px}.saves .sv-sub .note{margin:0 auto 0 0;font-size:11.5px}"+
    ".saves .lnk{font:inherit;font-size:12px;border:0;background:none;color:var(--table);padding:4px 6px;min-height:32px;cursor:pointer;white-space:nowrap}"+
    ".saves .lnk.del{color:var(--bad)}";document.head.appendChild(st);}
  box.setAttribute("aria-label","設定の保存");
  box.innerHTML='<div class="sv-row"><select id="sv-list" aria-label="保存した設定"></select><button class="btn sm" id="sv-save" type="button">今の設定を保存</button></div>'+
    '<div class="sv-row sv-sub"><span class="note">動かした設定は自動で覚えて、次に開いたときに戻ります</span><button class="lnk del" id="sv-del" type="button" hidden>削除</button><button class="lnk" id="sv-reset" type="button">初期値に戻す</button></div>';
  const sel=box.querySelector("#sv-list"),slots=()=>load("saves")||[];
  function fill(name){const s=slots();sel.innerHTML="";const o0=document.createElement("option");o0.value="";o0.textContent=s.length?"保存した設定（"+s.length+"件）":"保存した設定なし";sel.appendChild(o0);
    for(const x of s){const o=document.createElement("option");o.value=x.n;o.textContent=x.n;sel.appendChild(o);}sel.value=name||"";syncBtns();}
  function syncBtns(){box.querySelector("#sv-del").hidden=!sel.value;}
  sel.addEventListener("change",()=>{const x=slots().find(s=>s.n===sel.value);if(x){apply(x.v);saveLast();}syncBtns();});
  box.querySelector("#sv-save").addEventListener("click",()=>{const d=new Date(),def=sel.value||(d.getMonth()+1)+"/"+d.getDate()+" "+d.getHours()+":"+String(d.getMinutes()).padStart(2,"0")+"の設定";
    const n=(prompt("保存する名前",def)||"").trim();if(!n)return;const s=slots(),j=s.findIndex(x=>x.n===n);
    if(j>=0&&!confirm("「"+n+"」を今の設定で上書きしますか？"))return;const it={n,v:collect(),t:Date.now()};if(j>=0)s[j]=it;else s.push(it);store("saves",s);fill(n);});
  box.querySelector("#sv-del").addEventListener("click",()=>{const n=sel.value;if(!n||!confirm("「"+n+"」を削除しますか？"))return;store("saves",slots().filter(x=>x.n!==n));fill();});
  box.querySelector("#sv-reset").addEventListener("click",()=>{if(!confirm("すべての設定を初期値に戻しますか？（保存した設定は消えません）"))return;
    resetting=true;try{localStorage.removeItem(KEY+"last");}catch(e){}location.href=location.pathname;});
  fill();
  const last=load("last");if(last&&!(opt.skip&&opt.skip()))apply(last);}
