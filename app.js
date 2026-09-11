/* ============================================================
   Purchase & Payment — Supplier Book
   app.js  (Purchase / Payment ledger with supplier bank details)
   ============================================================ */
"use strict";

const $  = (s,r=document) => r.querySelector(s);
const $$ = (s,r=document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const uid = p => { const k="_uid_"+p; const n=(parseInt(localStorage.getItem(k)||"0",10)||0)+1; localStorage.setItem(k,String(n)); return p+"-"+String(n).padStart(4,"0"); };
const fmtMoney = n => { const v=Number(n)||0, neg=v<0, a=Math.abs(v); const s=a.toLocaleString("en-IN",{maximumFractionDigits:2,minimumFractionDigits:a%1?2:0}); return neg?"-₹"+s:"₹"+s; };
const moneyNum = n => (Number(n)||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const fmtDate = iso => { if(!iso) return "—"; const s=String(iso); const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); const d = m ? new Date(+m[1], +m[2]-1, +m[3]) : new Date(s); if(isNaN(d)) return s; return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); };
const fmtTime = iso => {
  if(!iso) return "";
  const s=String(iso);
  const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0,10)) && s.length<=10;
  const d=new Date(s);
  if(isNaN(d)) return "";
  const date=d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"});
  if(dateOnly) return date;
  return date+", "+d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
};
const todayISO = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const nowStamp = () => new Date().toISOString();

function amountToWords(n){
  n=Number(n)||0; if(n<=0) return "";
  const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function two(num){ if(num<20) return ones[num]; return tens[Math.floor(num/10)]+(num%10?" "+ones[num%10]:""); }
  function three(num){ const h=Math.floor(num/100), r=num%100; return (h?ones[h]+" Hundred"+(r?" ":""):"")+(r?two(r):""); }
  const crore=Math.floor(n/10000000); n%=10000000;
  const lakh=Math.floor(n/100000); n%=100000;
  const thousand=Math.floor(n/1000); n%=1000;
  const rest=Math.round(n);
  let w="";
  if(crore) w+=three(crore)+" Crore ";
  if(lakh) w+=two(lakh)+" Lakh ";
  if(thousand) w+=two(thousand)+" Thousand ";
  if(rest) w+=three(rest)+" ";
  return w.trim()+" Rupees Only";
}

/* ============================================================
   AMOUNT ANIMATION HELPERS
   ============================================================ */
const amountAnimations = new WeakMap();

function animateCountUp(el, target, options={}){
  if(!el) return;
  const value=Number(target)||0;
  const prefix=options.prefix||"";
  const suffix=options.suffix||"";
  const formatter=options.formatter||fmtMoney;
  const duration=options.duration||700;
  const previous=amountAnimations.get(el);
  if(previous) cancelAnimationFrame(previous);
  const render=n=>{ el.textContent=prefix+formatter(n)+suffix; };
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    render(value);
    return;
  }
  render(0);
  const started=performance.now();
  const tick=now=>{
    const progress=Math.min(1,(now-started)/duration);
    const eased=1-Math.pow(1-progress,3);
    render(value*eased);
    if(progress<1){
      amountAnimations.set(el, requestAnimationFrame(tick));
    }else{
      amountAnimations.delete(el);
    }
  };
  amountAnimations.set(el, requestAnimationFrame(tick));
}

function animateAmounts(container, delay=0){
  if(!container) return;
  const amountEls=$$(".party-bal[data-countup-value]", container);
  amountEls.forEach((el, idx)=>{
    setTimeout(()=>{
      animateCountUp(el, Number(el.dataset.countupValue));
      el.classList.remove("party-bal-animate");
      void el.offsetWidth; // trigger reflow
      el.classList.add("party-bal-animate");
    }, delay + (idx * 50));
  });
}

function animateKhataBalance(container, delay=100){
  if(!container) return;
  const balEl=$(".khata-balance", container);
  if(balEl){
    setTimeout(()=>{
      const amountEl=$(".amt[data-countup-value]", balEl);
      if(amountEl) animateCountUp(amountEl, Number(amountEl.dataset.countupValue));
      balEl.classList.remove("khata-balance-animate");
      void balEl.offsetWidth;
      balEl.classList.add("khata-balance-animate");
    }, delay);
  }
}

function animateKhataEntries(container, delay=200){
  if(!container) return;
  const entries=$$("#khataList .khata-entry", container);
  entries.forEach((el, idx)=>{
    setTimeout(()=>{
      $$(".ke-amt-value[data-countup-value],.ke-bal[data-countup-value]", el).forEach(amountEl=>{
        animateCountUp(amountEl, Number(amountEl.dataset.countupValue), {
          prefix: amountEl.dataset.countupPrefix||""
        });
      });
      el.classList.remove("khata-entry-animate");
      void el.offsetWidth;
      el.classList.add("khata-entry-animate");
    }, delay + (idx * 60));
  });
}

function animateSummaryValues(container, delay=0, values={}){
  if(!container) return;
  const summaryEls=[
    [$("#sumToPay", container), values.totalToPay, fmtMoney],
    [$("#headerToPay", container), values.totalToPay, fmtMoney],
    [$("#partyCount", container), values.partyCount, moneyNum]
  ];
  summaryEls.forEach((el, idx)=>{
    if(!el[0] || el[1]===undefined) return;
    setTimeout(()=>{
      animateCountUp(el[0], el[1], { formatter: el[2] });
      el[0].classList.remove("summary-value-animate");
      void el[0].offsetWidth;
      el[0].classList.add("summary-value-animate");
    }, delay + (idx * 80));
  });
}

/* ---------- db ----------
   party: { id, name, phone, city, color, createdAt,
            bank:{ name, account, ifsc }, history:[{type:"gave"|"got", amount, note, billNo, date, ts}] }
*/
const DB_KEY = "bahikhata.v1";
let db = { parties: [] };

function loadDB(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    if(raw){ const p=JSON.parse(raw); db={parties:p.parties||[]}; }
    else{
      // migrate from older versions if present
      const old = localStorage.getItem("supplierBook.v1") || localStorage.getItem("supplierLedgerPro.v3");
      if(old){
        const o=JSON.parse(old);
        const parties=[]; const sup=(o.suppliers||[]);
        sup.forEach(s=>{
          const history=[];
          (o.purchases||[]).filter(p=>p.supplier===s.id).forEach(p=>history.push({type:"gave",amount:p.amount,note:(p.ref||"")+" (bill)",date:p.date,ts:p.date}));
          (o.payments||[]).filter(p=>p.supplier===s.id).forEach(p=>history.push({type:"got",amount:p.amount,note:p.mode||"",date:p.date,ts:p.date}));
          parties.push({id:s.id,name:s.name,phone:s.phone||"",city:(s.address||"").split(",").pop().trim()||"",color:paletteFor(s.id),createdAt:s.added||todayISO(),bank:{name:"",account:"",ifsc:""},history});
        });
        db={parties};
      }
    }
  }catch(e){}
  ensureEntryIds();
  saveDB();
}
function ensureEntryIds(){
  // assign stable ids to any entry lacking one (for partial-payment allocation)
  db.parties.forEach(p=>{ (p.history||[]).forEach(e=>{ if(!e.id) e.id=uid("E"); }); });
}
function saveDB(){ try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }catch(e){ toast("Storage full — couldn't save"); } }

const AV=["#E84C3D","#1FA56E","#2563EB","#D97706","#7C3AED","#DB2777","#0D9488","#4F46E5","#0891B2","#CA8A04"];
function paletteFor(seed){ let h=0; const s=String(seed); for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0; return AV[h%AV.length]; }
// fixed colour per group (deterministic across sessions), distinct saturated palette
const GROUP_PALETTE=["#2563EB","#D97706","#7C3AED","#DB2777","#0D9488","#4F46E5","#0891B2","#CA8A04","#DC2626","#16A34A","#9333EA","#EA580C"];
function groupColor(name){
  let h=0; const s=String(name||"");
  for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  return GROUP_PALETTE[h%GROUP_PALETTE.length];
}
function initials(n){ const p=String(n||"?").trim().split(/\s+/); return p.length===1?p[0].slice(0,1).toUpperCase():p[0][0]+p[p.length-1][0]; }

/* balance: gave (purchases) - got (payments). + opening. if + : outstanding payable; if - : advance/overpaid */
function partyBalance(p){
  let gave=0, got=0;
  (p.history||[]).forEach(t=>{ if(t.type==="gave")gave+=Number(t.amount)||0; else got+=Number(t.amount)||0; });
  const opening=Number(p.opening)||0;
  // purchase total includes the opening balance (amount already due before tracking)
  return { gave: gave+opening, got, opening, net: (gave+opening)-got };
}
const partyById = id => db.parties.find(p=>p.id===id);

/* ---- partial payments: bill allocation ---- */
// total explicitly allocated against a specific bill (entry id) via payment allocations
function billAllocated(p, entryId){
  let s=0;
  const bill=(p.history||[]).find(e=>String(e.id)===String(entryId));
  (p.history||[]).forEach(e=>{
    if(e.type!=="got") return;
    // Support older Day Book payments created before explicit allocations
    // were stored by linking them through their shared daybook id.
    if(!(e.allocations&&e.allocations.length) && bill && e.daybookId && e.daybookId===bill.daybookId){
      s+=Number(e.amount)||0;
      return;
    }
    (e.allocations||[]).forEach(a=>{
      if(String(a.id)===String(entryId)) s+=Number(a.amount)||0;
    });
  });
  return s;
}
// Reconcile every bill using only explicit payment allocations.
// Unallocated payments remain account-level payments and do not clear a bill.
function billStates(p){
  // opening balance is treated as the first "bill" (paid first, before purchases)
  const opening=Number(p.opening)||0;
  const openingBill = (opening>0.009)
    ? [{ id: "__opening__", billNo:"", note:"Opening balance", date:"", amount: opening, _isOpening:true }]
    : [];
  const purchaseBills=(p.history||[]).filter(e=>e.type==="gave").slice().sort((a,b)=>(a.date||a.ts||"").localeCompare(b.date||b.ts||""));
  const bills=openingBill.concat(purchaseBills.map(b=>({ id:b.id, billNo:b.billNo||"", note:b.note||"", date:b.date||"", amount:Number(b.amount)||0 })));
  // explicit allocations map
  const explicit={};
  bills.forEach(b=>{ explicit[b.id]=billAllocated(p,b.id); });
  const out=[];
  bills.forEach(b=>{
    const amt=Number(b.amount)||0;
    const exp=Math.min(amt, Math.max(0, explicit[b.id]||0));
    const paid=exp;
    const remaining=amt-paid;
    out.push({ id:b.id, billNo:b.billNo||"", note:b.note||"", date:b.date||"", amount:amt, paid, remaining, _isOpening:!!b._isOpening });
  });
  return out;
}
function paymentSettlesBills(p, payment){
  if(!payment || payment.type!=="got") return false;
  const history=p.history||[];
  const allocations=(payment.allocations&&payment.allocations.length)
    ? payment.allocations.map(a=>({ id:String(a.id), amount:Number(a.amount)||0 }))
    : history.filter(e=>e.type==="gave" && payment.daybookId && e.daybookId===payment.daybookId)
      .map(e=>({ id:String(e.id), amount:Number(payment.amount)||0 }));
  if(!allocations.length) return false;
  const occursBefore=(a,b)=>{
    const ak=String(a.ts||a.date||"");
    const bk=String(b.ts||b.date||"");
    if(ak!==bk) return ak<bk;
    return history.indexOf(a)<history.indexOf(b);
  };
  return allocations.every(allocation=>{
    const bill=history.find(e=>e.type==="gave" && String(e.id)===allocation.id);
    if(!bill) return false;
    const billAmount=Number(bill.amount)||0;
    const paidBefore=history.reduce((sum, candidate)=>{
      if(candidate===payment || candidate.type!=="got" || !occursBefore(candidate,payment)) return sum;
      if(candidate.allocations&&candidate.allocations.length){
        const match=candidate.allocations.find(a=>String(a.id)===allocation.id);
        return sum+(match ? Number(match.amount)||0 : 0);
      }
      if(candidate.daybookId && candidate.daybookId===bill.daybookId) return sum+(Number(candidate.amount)||0);
      return sum;
    },0);
    return allocation.amount+paidBefore>=billAmount-0.009;
  });
}
// list of open bills (remaining > 0)
function openBills(p){
  return billStates(p).filter(b=>b.remaining>0.009);
}

let currentParty = null;
let khataDateFilter = "all"; // all | this-month | last-month | custom
let khataCustomFrom = "";
let khataCustomTo = "";
let groupFilter = ""; // "" = all groups

/* ---------- toast ---------- */
function toast(msg, type){
  const box=$("#toasts"); const el=document.createElement("div");
  el.className="toast"; el.textContent=msg;
  box.appendChild(el);
  setTimeout(()=>{el.style.opacity="0";el.style.transition="opacity .3s";},2200);
  setTimeout(()=>el.remove(),2600);
}

/* ---------- sheet (bottom modal) ---------- */
function openSheet(html){
  const m=$("#modalMount");
  m.innerHTML='<div class="sheet"><div class="sheet-handle"></div>'+html+"</div>";
  $("#overlay").classList.add("open");
}
function closeSheet(){ $("#overlay").classList.remove("open"); $("#modalMount").innerHTML=""; }

/* ---------- lightbox (full-size photo viewer) ---------- */
let lbPhotos=[]; let lbIndex=0;
function openLightbox(photos, index){
  lbPhotos=Array.isArray(photos)?photos:[];
  lbIndex=Math.max(0, Math.min(index||0, lbPhotos.length-1));
  renderLightbox();
  $("#lightbox").classList.add("open");
}
function closeLightbox(){
  $("#lightbox").classList.remove("open");
  lbPhotos=[]; lbIndex=0;
}
function renderLightbox(){
  const lb=$("#lightbox"); if(!lb) return;
  const n=lbPhotos.length;
  if(!n) return;
  lb.innerHTML='<div class="lb-backdrop" id="lbBackdrop"></div>'
    +'<div class="lb-stage">'
    +'<button class="lb-close" id="lbClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button>'
    +(n>1?'<button class="lb-nav lb-prev" id="lbPrev"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>':'')
    +'<img class="lb-img" id="lbImg" src="'+lbPhotos[lbIndex]+'" alt="">'
    +(n>1?'<button class="lb-nav lb-next" id="lbNext"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>':'')
    +'<a class="lb-download" id="lbDownload" href="'+lbPhotos[lbIndex]+'" download="attachment-'+(lbIndex+1)+'.jpg" title="Download attachment"><svg viewBox="0 0 24 24"><use href="#i-download"/></svg><span>Download</span></a>'
    +'<div class="lb-count" id="lbCount">'+(lbIndex+1)+' / '+n+'</div>'
    +'</div>';
  $("#lbClose").onclick=closeLightbox;
  $("#lbBackdrop").onclick=closeLightbox;
  $("#lbDownload").onclick=e=>e.stopPropagation();
  if(n>1){
    $("#lbPrev").onclick=e=>{ e.stopPropagation(); lbIndex=(lbIndex+n-1)%n; updateLightbox(); };
    $("#lbNext").onclick=e=>{ e.stopPropagation(); lbIndex=(lbIndex+1)%n; updateLightbox(); };
  }
}
function updateLightbox(){
  const img=$("#lbImg"), count=$("#lbCount"), n=lbPhotos.length;
  if(img) img.src=lbPhotos[lbIndex];
  if(count) count.textContent=(lbIndex+1)+" / "+n;
  const download=$("#lbDownload");
  if(download){
    download.href=lbPhotos[lbIndex];
    download.download="attachment-"+(lbIndex+1)+".jpg";
  }
}

/* ============================================================
   HOME
   ============================================================ */
function renderHome(){
  const list=db.parties.slice();
  const q=($("#partySearch").value||"").toLowerCase().trim();
  const filtered = q ? list.filter(p=>{
    if(p.name.toLowerCase().includes(q)) return true;
    if((p.phone||"").includes(q)) return true;
    if((p.city||"").toLowerCase().includes(q)) return true;
    // global search: match bill no., note, amount, date in history
    return (p.history||[]).some(h=>
      (h.billNo||"").toLowerCase().includes(q)
      || (h.note||"").toLowerCase().includes(q)
      || String(h.amount||"").includes(q)
      || (h.date||"").includes(q)
    );
  }) : list;
  // apply group filter
  const grouped = groupFilter ? filtered.filter(p=>(p.group||"")===groupFilter) : filtered;
  grouped.sort((a,b)=>Math.abs(partyBalance(b).net)-Math.abs(partyBalance(a).net));

  // render group filter chips
  renderGroupRow();

  let totalToPay=0;
  const summaryParties=groupFilter ? list.filter(p=>(p.group||"")===groupFilter) : list;
  summaryParties.forEach(p=>{ const bal=partyBalance(p); if(bal.net>0) totalToPay+=bal.net; });
  const stp=$("#sumToPay"); if(stp) stp.textContent=fmtMoney(0);
  const htp=$("#headerToPay"); if(htp) htp.textContent=fmtMoney(0);
  const n=groupFilter ? list.filter(p=>(p.group||"")===groupFilter).length : db.parties.length;
  const pc=$("#partyCount"); if(pc) pc.textContent=moneyNum(0);
  updateBellDot();

  const body=$("#partyList");
  if(!grouped.length){
    body.innerHTML = (q||groupFilter)
      ? '<div class="empty"><div class="big">🔍</div><p>No supplier found</p><small>Try a different search or group</small></div>'
      : '<div class="empty"><div class="big">📒</div><p>No suppliers yet</p><small>Tap + to add your first supplier</small></div>';
    return;
  }
  body.innerHTML=grouped.map(p=>{
    const b=partyBalance(p); const n=b.net;
    const isGet = n>=0;
    const tag = n>0.009 ? "To pay" : n<-0.009 ? "Advance" : "Settled";
    const balCls = n>0.009 ? "you-get" : n<-0.009 ? "you-give" : "";
    const c=p.color||paletteFor(p.id);
    const gc=p.group?groupColor(p.group):'';
    const groupBadge = p.group ? '<span class="group-badge" style="background:'+gc+'22;color:'+gc+'">'+esc(p.group)+'</span>' : '';
    return '<button class="party" data-open="'+esc(p.id)+'">'
      +'<div class="party-av" style="background:'+c+'">'+esc(initials(p.name))+'</div>'
      +'<div class="party-main"><div class="party-name">'+esc(p.name)+' '+groupBadge+'</div>'
      +'<div class="party-sub">'+esc(p.phone||"")+((p.city?" · "+esc(p.city):""))+'</div></div>'
      +'<div class="party-right"><div class="party-bal '+balCls+'" data-countup-value="'+Math.abs(n)+'">'+fmtMoney(0)+'</div>'
      +'<div class="party-tag">'+tag+'</div></div></button>';
  }).join('');
  $$("#partyList .party").forEach(b=>b.onclick=()=>openKhata(b.dataset.open));
  
  // Animate amounts
  setTimeout(()=>{
    animateSummaryValues(document, 0, { totalToPay, partyCount:n });
    animateAmounts(body, 100);
  }, 10);
}

const GROUPS_KEY = "bahikhata.groups";
function allGroups(){
  const set=new Set();
  // from persisted group store
  try{ const g=JSON.parse(localStorage.getItem(GROUPS_KEY)||"[]"); if(Array.isArray(g)) g.forEach(x=>{ if(x) set.add(x); }); }catch(e){}
  // from parties (in case store is empty but parties have groups)
  db.parties.forEach(p=>{ if(p.group) set.add(p.group); });
  return Array.from(set).sort();
}
function getGroupStore(){ try{ const g=JSON.parse(localStorage.getItem(GROUPS_KEY)||"[]"); return Array.isArray(g)?g:[]; }catch(e){ return []; } }
function saveGroupStore(g){ try{ localStorage.setItem(GROUPS_KEY, JSON.stringify(g)); }catch(e){} }

// notification threshold: notify only when a supplier is due within N days (or already overdue)
const NOTIFY_DAYS_KEY = "bahikhata.notifyDays";
function getNotifyDays(){ try{ const v=localStorage.getItem(NOTIFY_DAYS_KEY); return (v===null||v==="") ? null : (Number(v)||0); }catch(e){ return null; } }
function setNotifyDays(n){ try{ if(n===null||n===""){ localStorage.removeItem(NOTIFY_DAYS_KEY); } else { localStorage.setItem(NOTIFY_DAYS_KEY, String(n)); } }catch(e){} }
function addGroup(name){
  name=String(name||"").trim(); if(!name) return;
  const g=getGroupStore(); if(!g.includes(name)){ g.push(name); saveGroupStore(g); }
}
function removeGroup(name){
  const g=getGroupStore().filter(x=>x!==name); saveGroupStore(g);
}
function openGroupManager(){
  const render=()=>{
    const groups=allGroups();
    const list=$("#gmList"); if(!list) return;
    if(!groups.length){ list.innerHTML='<div class="empty"><div class="big">🏷️</div><p>No groups yet</p><small>Create a group from the supplier form or below</small></div>'; return; }
    list.innerHTML=groups.map(g=>{
      const count=db.parties.filter(p=>p.group===g).length;
      return '<div class="gm-row">'
        +'<div class="gm-main"><span class="gm-name">'+esc(g)+'</span>'
        +'<span class="gm-count">'+count+' supplier'+(count===1?"":"s")+'</span></div>'
        +'<button class="mini-btn danger gm-del" data-g="'+esc(g)+'" style="flex:none;padding:6px 12px">Remove</button>'
        +'</div>';
    }).join('');
    $$("#gmList .gm-del").forEach(b=>b.onclick=()=>{
      const g=b.dataset.g;
      const count=db.parties.filter(p=>p.group===g).length;
      if(count>0){
        if(!confirm("Remove group \""+g+"\"? "+count+" supplier(s) will become ungrouped.")) return;
        db.parties.forEach(p=>{ if(p.group===g) p.group=""; });
        saveDB();
      } else {
        if(!confirm("Remove group \""+g+"\"?")) return;
      }
      removeGroup(g);
      render(); renderHome();
      toast("Group removed");
    });
  };
  openSheet(
    '<div class="sheet-head"><h3>🏷️ Manage groups</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body">'
    +'<div class="field"><label>New group</label><div style="display:flex;gap:8px"><input id="gmNew" placeholder="e.g. Dairy"><button class="mini-btn" id="gmAdd" style="flex:none;padding:0 18px">Add</button></div></div>'
    +'<div class="gm-list" id="gmList"></div>'
    +'</div>'
  );
  $("#sClose").onclick=closeSheet;
  const addGroupBtn=()=>{
    const inp=$("#gmNew"); const name=(inp&&inp.value||"").trim();
    if(!name){ toast("Enter a group name"); return; }
    addGroup(name);
    if(inp) inp.value="";
    render(); renderHome();
    toast("Group added");
  };
  $("#gmAdd").onclick=addGroupBtn;
  const nEl=$("#gmNew"); if(nEl) nEl.addEventListener("keydown",e=>{ if(e.key==="Enter")addGroupBtn(); });
  render();
}
function renderGroupRow(){
  const row=$("#groupRow"); if(!row) return;
  const groups=allGroups();
  if(!groups.length){ row.classList.add("hidden"); row.innerHTML=""; return; }
  row.classList.remove("hidden");
  const chips = [''].concat(groups).map(g=>{
    const dot = g ? '<span class="gchip-dot" style="background:'+groupColor(g)+'"></span>' : '';
    return '<button type="button" class="gchip'+(groupFilter===g?" active":"")+'" data-g="'+esc(g)+'">'+dot+(g?esc(g):"All")+'</button>';
  }).join('');
  row.innerHTML=chips;
  $$("#groupRow .gchip").forEach(c=>c.onclick=()=>{ groupFilter=c.dataset.g; renderHome(); });
}

/* ============================================================
   KHATA
   ============================================================ */
function openKhata(id){
  currentParty=partyById(id);
  if(!currentParty){ toast("Not found"); return; }
  $("#screen-home").classList.add("hidden");
  $("#screen-khata").classList.remove("hidden");
  $("#khataParty").textContent=currentParty.name;
  renderKhata();
}
function closeKhata(){
  currentParty=null;
  resetDateFilter();
  $("#screen-khata").classList.add("hidden");
  $("#screen-home").classList.remove("hidden");
  renderHome();
}
function resetDateFilter(){
  khataDateFilter="all"; khataCustomFrom=""; khataCustomTo="";
}
function dateInRange(iso, from, to){
  if(!iso) return true;
  const d = iso.slice(0,10);
  if(from && d < from) return false;
  if(to && d > to) return false;
  return true;
}

function dateFilterRange(){
  let fFrom="", fTo="", label="All time";
  const now=new Date();
  const y=now.getFullYear(), m=now.getMonth(); // m is 0-based
  const pad=n=>String(n).padStart(2,"0");
  if(khataDateFilter==="this-month"){
    fFrom = y+"-"+pad(m+1)+"-01";
    fTo   = y+"-"+pad(m+1)+"-"+pad(new Date(y,m+1,0).getDate());
    label="This month";
  }
  else if(khataDateFilter==="last-month"){
    fFrom = y+"-"+pad(m)+"-01";
    fTo   = y+"-"+pad(m)+"-"+pad(new Date(y,m,0).getDate());
    label="Last month";
  }
  else if(khataDateFilter==="custom"){ fFrom=khataCustomFrom; fTo=khataCustomTo; label="Custom"; }
  return { fFrom, fTo, label };
}

function ledgerEntryOrder(entries, newestFirst=true, paymentFirst=true){
  const byDate=new Map();
  entries.forEach((entry,index)=>{
    const date=(entry.date||entry.ts||"").slice(0,10);
    if(!byDate.has(date)) byDate.set(date,[]);
    byDate.get(date).push({entry,index});
  });
  const dates=Array.from(byDate.keys()).sort((a,b)=>newestFirst?b.localeCompare(a):a.localeCompare(b));
  const ordered=[];
  dates.forEach(date=>{
    const dayEntries=byDate.get(date);
    dayEntries.sort((a,b)=>{
      const aTime=a.entry.ts||"";
      const bTime=b.entry.ts||"";
      return newestFirst ? bTime.localeCompare(aTime) : aTime.localeCompare(bTime);
    });
    const used=new Set();
    const daybookGroups=new Map();
    dayEntries.forEach(item=>{
      if(!item.entry.daybookId) return;
      if(!daybookGroups.has(item.entry.daybookId)) daybookGroups.set(item.entry.daybookId,[]);
      daybookGroups.get(item.entry.daybookId).push(item);
    });
    dayEntries.forEach(item=>{
      if(used.has(item.index)) return;
      const group=item.entry.daybookId ? daybookGroups.get(item.entry.daybookId) : null;
      if(group){
        group.slice().sort((a,b)=>{
          const aOrder=a.entry.type==="got" ? (paymentFirst?0:1) : (paymentFirst?1:0);
          const bOrder=b.entry.type==="got" ? (paymentFirst?0:1) : (paymentFirst?1:0);
          return aOrder-bOrder;
        }).forEach(groupItem=>{
          if(!used.has(groupItem.index)){ ordered.push(groupItem.entry); used.add(groupItem.index); }
        });
      }else{
        ordered.push(item.entry);
        used.add(item.index);
      }
    });
  });
  return ordered;
}

function renderKhata(){
  const p=currentParty; if(!p)return;
  const b=partyBalance(p); const n=b.net;
  const balanceEl=$("#khataBalance");
  balanceEl.className="khata-balance "+(n>0.009?"you-get":n<-0.009?"you-give":"");
  balanceEl.innerHTML='<div class="amt" data-countup-value="'+Math.abs(n)+'">'+fmtMoney(0)+'</div>'
    +'<div class="lbl">'+(n>0.009?"To pay":n<-0.009?"Advance (you overpaid)":"Settled — no balance")+'</div>';

  const list=$("#khataList");

  // resolve date filter range
  const { fFrom, fTo } = dateFilterRange();

  const entries=ledgerEntryOrder((p.history||[]).slice()
    .filter(e=> (khataDateFilter==="all") ? true : dateInRange(e.date||e.ts, fFrom, fTo))
    );
  if(!entries.length){
    const hasAny=(p.history&&p.history.length)>0;
    list.innerHTML='<div class="empty"><div class="big">📝</div><p>'+(hasAny?"No entries in this period":"No entries yet")+'</p><small>'+(hasAny?"Try a different date range":"Use “Purchase” or “Payment” below")+'</small></div>';
    return;
  }
  // compute running balance from oldest to newest, starting from opening balance
  const opening=Number(p.opening)||0;
  // Calculate balances in accounting order: purchase first, then its payment.
  // The visible ledger may intentionally show the linked payment first.
  const sortedOld=ledgerEntryOrder(entries.slice(),false,false);
  let run=opening; const balMap=new Map();
  sortedOld.forEach(e=>{
    run += e.type==="gave" ? (Number(e.amount)||0) : -(Number(e.amount)||0);
    balMap.set(e,run);
  });
  // opening balance pseudo-row (shown at BOTTOM when non-zero; tap to edit)
  const openingRow = (opening!==0)
    ? '<div class="khata-entry opening" data-open-opening="1" style="cursor:pointer"><div class="sign">☰</div><div class="ke-main"><div class="ke-amt">Opening balance</div><div class="ke-date">Starting balance · tap to edit</div></div><div class="ke-bal" data-countup-value="'+opening+'">'+("Bal "+fmtMoney(0))+'</div></div>'
    : '';
  // partial payment: reconcile bill states once
  const statesById={}; billStates(p).forEach(s=>{ statesById[s.id]=s; });
  const renderLedgerEntry=e=>{
    const isGave = e.type==="gave";
    const bal = balMap.get(e)||0;
    const modeTag = (!isGave && e.mode) ? '<span class="ke-mode">'+esc(e.mode)+'</span>' : '';
    let remainingTag='';
    if(isGave){
      const st=statesById[e.id];
      const paid=st?st.paid:0;
      const rem=st?st.remaining:(Number(e.amount||0)-paid);
      if(paid>0.009 && rem>0.009) remainingTag='<div class="ke-note" style="color:var(--amber)">Paid '+fmtMoney(paid)+' · Remaining '+fmtMoney(rem)+'</div>';
      else if(paid>0.009 && rem<=0.009) remainingTag='<div class="ke-note" style="color:var(--green)">Fully paid ✓</div>';
      else if(rem>0.009) remainingTag='<div class="ke-note bill-due-note"><span class="bill-due-badge">DUE</span> Remaining '+fmtMoney(rem)+'</div>';
    } else {
      const allocations=e.allocations||[];
      if(allocations.length){
        const linkedBills=allocations.map(a=>{
          const bill=(p.history||[]).find(x=>String(x.id)===String(a.id));
          const state=bill ? statesById[bill.id] : null;
          return bill ? {bill,state,amount:Number(a.amount)||0} : null;
        }).filter(Boolean);
        const billLabels=linkedBills.map(item=>item.bill.billNo||"purchase").join(", ");
        const isFull=paymentSettlesBills(p,e);
        remainingTag='<div class="ke-note payment-status-note"><span class="payment-status-badge '+(isFull?"full":"partial")+'">'+(isFull?"FULL PAYMENT":"PARTIAL PAYMENT")+'</span> Paid for '+esc(billLabels)+'</div>';
      }
    }
    const photos=(e.photos||[]);
    const photoBtn = (photos.length)
      ? '<button type="button" class="ke-photo" data-photos=\''+esc(JSON.stringify(photos))+'\'>📎 '+photos.length+' photo'+(photos.length>1?"s":"")+'</button>'
      : '';
    const linkedAttr=e.daybookId ? ' data-daybook-id="'+esc(e.daybookId)+'"' : "";
    const paidClass=isGave && statesById[e.id] && statesById[e.id].remaining<=0.009 ? " bill-paid" : "";
    return '<div class="khata-entry '+(isGave?"you-get":"you-give")+paidClass+'"'+linkedAttr+'>'
      +'<div class="sign">'+(isGave?"+":"−")+'</div>'
      +'<div class="ke-main"><div class="ke-amt"><span class="ke-amt-value" data-countup-value="'+Math.abs(Number(e.amount)||0)+'" data-countup-prefix="'+(isGave?"+":"−")+'">'+(isGave?"+":"−")+fmtMoney(0)+'</span> '+modeTag+'</div>'
      +(e.billNo?'<div class="ke-note">'+esc(e.billNo)+'</div>':'')
      +(e.note?'<div class="ke-note">'+esc(e.note)+'</div>':'')
      + remainingTag
      +'<div class="ke-date">'+fmtTime(e.ts||e.date)+'</div>'
      + photoBtn
      +'</div>'
      +'<div class="ke-bal" data-countup-value="'+bal+'" data-countup-prefix="Bal ">'+("Bal "+fmtMoney(0))+'</div></div>';
  };
  const renderedEntries=[];
  for(let i=0;i<entries.length;i++){
    const entry=entries[i];
    if(!entry.daybookId){
      renderedEntries.push(renderLedgerEntry(entry));
      continue;
    }
    const group=[];
    while(i<entries.length && entries[i].daybookId===entry.daybookId) group.push(entries[i++]);
    i--;
    const payments=group.filter(e=>e.type==="got");
    const purchases=group.filter(e=>e.type==="gave");
    renderedEntries.push(payments.map(renderLedgerEntry).join('')+purchases.map(renderLedgerEntry).join(''));
  }
  list.innerHTML=renderedEntries.join('') + openingRow;
  // bind: tap entry to edit; photo button opens lightbox; opening balance opens supplier edit
  const entryEls=$$("#khataList .khata-entry:not([data-open-opening])");
  entryEls.forEach((el, i)=>{
    const e=entries[i];
    el.onclick=(ev)=>{
      if(ev.target.closest(".ke-photo")) return; // photo button handled separately
      verifyPasswordSheet("Editing an entry requires your password.", ()=>openEntry(e.type, e));
    };
    el.style.cursor="pointer";
  });
  // opening balance row: tap to edit the supplier's opening balance
  const openingEl=$("#khataList .khata-entry[data-open-opening]");
  if(openingEl){
    openingEl.onclick=()=>{ verifyPasswordSheet("Editing a supplier requires your password.", ()=>openPartySheet(p.id)); };
  }
  // bind photo viewer
  $$("#khataList .ke-photo").forEach(btn=>{
    btn.onclick=(ev)=>{
      ev.stopPropagation();
      let arr=[]; try{ arr=JSON.parse(btn.dataset.photos||"[]"); }catch(e){ arr=[]; }
      if(arr.length) openLightbox(arr, 0);
    };
  });
  
  // Animate khata entries and balance
  setTimeout(()=>{
    animateKhataBalance(document, 0);
    animateKhataEntries(document, 150);
  }, 10);
}

/* ============================================================
   ENTRY SHEET (Purchase / Payment)
   ============================================================ */
const PAYMENT_MODES = ["Cash","Bank Transfer","UPI","Cheque","Card"];

function openEntry(type, existingEntry){
  if(!currentParty){ toast("Pick a party first"); return; }
  const editing = !!existingEntry;
  const isGave = type==="gave";
  const e0 = existingEntry || {};
  const color = isGave ? "var(--red)" : "var(--green)";
  const label = isGave ? "Purchase" : "Payment";
  const modeToggles = isGave
    ? ''
    : '<div class="field"><label>Payment mode</label><div class="mode-row" id="eModes">'
      + PAYMENT_MODES.map(m=>'<button type="button" class="mode-chip" data-mode="'+esc(m)+'">'+esc(m)+'</button>').join('')
      +'</div></div>';

  const bills = (!isGave && !editing) ? openBills(currentParty) : [];
  const allocHTML = (!isGave && !editing)
    ? '<div class="field"><label>Allocate payment against bills</label>'
      +'<div class="alloc-box">'
      +'<button type="button" class="alloc-toggle" id="eAllocToggle">'
      +'<span class="alloc-toggle-label" id="eAllocToggleLabel">'+bills.length+' bill'+(bills.length===1?'':'s')+' pending · select to allocate</span>'
      +'<svg class="alloc-chev" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      +'</button>'
      +'<div class="alloc-list hidden" id="eAllocList">'
      +( bills.length
          ? '<label class="alloc-selectall"><input type="checkbox" id="eSelectAll"><span class="cm"></span><span class="alloc-selectall-label">Select all / clear all dues</span></label>'
            + bills.map(b=>{
              const id=b.id;
              const isOpening = !!b._isOpening;
              const datePart = isOpening ? '' : (b.date ? 'Purchased on '+fmtDate(b.date) : '');
              const noPart = isOpening ? 'Opening balance' : (b.billNo ? 'Invoice '+(b.billNo||'') : '');
              const helper = isOpening ? 'Opening balance' : [datePart,noPart].filter(Boolean).join(' | ');
              return '<div class="alloc-row" data-id="'+esc(id)+'" data-rem="'+b.remaining+'">'
                +'<label class="alloc-check"><input type="checkbox" class="acb"><span class="cm"></span></label>'
                +'<div class="alloc-main">'
                +'<div class="alloc-bill-head"><div class="alloc-title">'+esc(noPart)+'</div><div class="alloc-amt-bold">₹'+moneyNum(b.remaining)+'</div></div>'
                +'<div class="alloc-details">'
                +(datePart?'<span><b>Purchased</b> '+esc(fmtDate(b.date))+'</span>':'')
                +(b.note?'<span><b>Note</b> '+esc(b.note)+'</span>':'')
                +'</div>'
                +'</div>'
                +'</div>';
            }).join('')
          : '<div class="empty" style="padding:16px"><p style="font-size:13px">No pending bills — paying as advance / on account.</p></div>'
        )
      +'</div>'
      +'<div class="alloc-total" id="eAllocTotal">Allocated ₹0.00</div>'
      +'</div>'
      +'</div>'
    : '';


  openSheet(
    '<div class="sheet-head"><h3 style="color:'+color+'">'+(editing?"Edit ":"")+label+'</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body">'
    +'<div class="field"><label>Amount ₹ <span class="req">*</span></label><input id="eAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" autofocus value="'+(editing?e0.amount:"")+'"></div>'
    + allocHTML
    +(isGave?'<div class="field"><label>Bill / Invoice no.</label><input id="eBillNo" placeholder="e.g. INV-1024" value="'+esc(e0.billNo||"")+'"></div>':'<div class="field"><label>Reference</label><input id="eBillNo" placeholder="e.g. UTR / cheque no." value="'+esc(e0.billNo||"")+'"></div>')
    + modeToggles
    +'<div class="field"><label>Note</label><input id="eNote" placeholder="e.g. '+ (isGave?"goods purchased":"partial payment") +'" value="'+esc(e0.note||"")+'"></div>'
    +'<div class="field"><label>Date</label><input id="eDate" type="date" value="'+esc(editing?(e0.date||todayISO()):todayISO())+'"></div>'
    +'<div class="field"><label>Attach photos</label>'
    +'<button type="button" class="attach-btn" id="eAttach">📎 Add photo (bill / receipt)</button>'
    +'<input id="ePhoto" type="file" accept="image/*" multiple style="display:none">'
    +'<div class="attach-list" id="eAttachList"></div></div>'
    +'<button class="big-save '+(isGave?"danger":"green")+'" id="eSave">'+(editing?"Save changes":label+' ₹')+'</button>'
    +(editing?'<button class="big-save" id="eReceipt" style="margin-top:10px;background:var(--card);color:var(--blue);border:1px solid var(--blue)">🧾 Receipt / print</button>':'')
    +(editing?'<button class="big-save danger" id="eDel" style="margin-top:10px;background:var(--card);color:var(--red);border:1px solid var(--red)">Delete entry</button>':'')
    +'</div>'
  );
  $("#sClose").onclick=closeSheet;
  let selectedMode = (isGave ? null : (e0.mode||"Cash"));
  const modeRow = $("#eModes");
  if(modeRow){
    const chips=$$(".mode-chip", modeRow);
    chips.forEach(c=>c.onclick=()=>{ chips.forEach(x=>x.classList.remove("active")); c.classList.add("active"); selectedMode=c.dataset.mode; });
    const first=chips.find(c=>c.dataset.mode===selectedMode) || chips.find(c=>c.dataset.mode==="Cash");
    if(first) first.classList.add("active");
  }
  // ---- partial-payment allocation (new payments only) ----
  const amountEl=$("#eAmount");
  const allocTotalEl=$("#eAllocTotal");
  const allocToggle=$("#eAllocToggle");
  const allocToggleLabel=$("#eAllocToggleLabel");
  const allocListEl=$("#eAllocList");
  const syncAlloc=()=>{
    if(!allocTotalEl) return;
    let allocated=0, count=0;
    $$("#eAllocList .alloc-row").forEach(row=>{
      const cb=row.querySelector(".acb");
      if(cb && cb.checked){ count++; allocated+=Number(row.dataset.rem)||0; }
    });
    if(amountEl && !amountEl.dataset.manual) amountEl.value = allocated?String(allocated):"";
    allocTotalEl.innerHTML='Allocated <b>₹'+moneyNum(allocated)+'</b>'+ (count?(' &nbsp;·&nbsp; '+count+' bill'+(count>1?'s':'')):'') ;
  };
  if(allocToggle && allocListEl){
    allocToggle.addEventListener("click",()=>{
      const open=allocListEl.classList.toggle("hidden");
      allocToggle.classList.toggle("open", !open);
    });
  }
  $$("#eAllocList .alloc-row").forEach(row=>{
    const cb=row.querySelector(".acb");
    if(!cb) return;
    cb.addEventListener("change",()=>{
      row.classList.toggle("active", cb.checked);
      syncAlloc();
    });
  });
  // select all / clear all
  const selectAll=$("#eSelectAll");
  if(selectAll){
    selectAll.addEventListener("change",()=>{
      const on=selectAll.checked;
      $$("#eAllocList .alloc-row").forEach(row=>{
        const cb=row.querySelector(".acb");
        if(cb && cb.checked!==on){ cb.checked=on; row.classList.toggle("active", on); }
      });
      syncAlloc();
    });
  }
  if(amountEl) amountEl.addEventListener("input",()=>{ amountEl.dataset.manual="1"; });
  syncAlloc();
  // photo attachment (preload existing)
  const photos=(e0.photos||[]).map(data=>({name:"photo", data}));
  const attachBtn=$("#eAttach"), photoInput=$("#ePhoto"), attachList=$("#eAttachList");
  const renderAttach=()=>{
    if(!photos.length){ attachList.innerHTML=''; return; }
    attachList.innerHTML=photos.map((ph,i)=>'<div class="attach-chip"><img src="'+ph.data+'" alt=""><span>Photo '+(i+1)+'</span><button type="button" data-ri="'+i+'">✕</button></div>').join('');
    $$(".attach-chip button", attachList).forEach(b=>b.onclick=()=>{ photos.splice(Number(b.dataset.ri),1); renderAttach(); });
  };
  renderAttach();
  attachBtn.onclick=()=>photoInput.click();
  photoInput.onchange=()=>{
    const files=Array.from(photoInput.files||[]);
    files.forEach(file=>{
      const rd=new FileReader();
      rd.onload=()=>{ photos.push({name:file.name, data:rd.result}); if(photos.length>10){ photos.shift(); } renderAttach(); };
      rd.readAsDataURL(file);
    });
    photoInput.value="";
  };
  setTimeout(()=>{ const a=$("#eAmount"); if(a)a.focus(); },80);
  $("#eSave").onclick=()=>{
    let amt=parseFloat($("#eAmount").value);
    // if allocating (new payment), fall back to allocated total when amount empty
    if((!amt||amt<=0) && !editing && !isGave){
      let tot=0;
      $$("#eAllocList .alloc-row").forEach(row=>{ const cb=row.querySelector(".acb"); if(cb&&cb.checked) tot+=Number(row.dataset.rem)||0; });
      if(tot>0) amt=tot; else { toast("Enter amount or allocate to bills"); $("#eAmount").focus(); return; }
    }
    if(!amt||amt<=0){ toast("Enter amount"); $("#eAmount").focus(); return; }
    const billNo=$("#eBillNo").value.trim();
    // duplicate bill detection (only for new entries with a bill no.)
    if(!editing && billNo && isGave){
      const dup=currentParty.history.find(h=>String(h.billNo||"").trim().toLowerCase()===billNo.toLowerCase());
      if(dup){
        if(!confirm("Bill \""+billNo+"\" already exists for this supplier. Add it anyway?")) return;
      }
    }
    if(editing){
      e0.amount=amt; e0.billNo=billNo; e0.note=$("#eNote").value.trim();
      e0.date=$("#eDate").value||todayISO();
      if(!isGave) e0.mode=selectedMode||"";
      e0.photos=photos.map(ph=>ph.data);
      auditLog("edit-entry", currentParty.name, label+" ₹"+fmtMoney(amt)+(billNo?" · "+billNo:""));
    } else {
      const entry={ id:uid("E"), type, amount:amt, billNo:billNo, mode:selectedMode||"", note:$("#eNote").value.trim(), date:$("#eDate").value||todayISO(), ts:nowStamp(), photos:photos.length?photos.map(ph=>ph.data):[] };
      // partial-payment allocations
      if(!isGave){
        const selectedRows=$$("#eAllocList .alloc-row").filter(row=>row.querySelector(".acb")?.checked);
        if(openBills(currentParty).length && !selectedRows.length){
          toast("Select the purchase this payment is for");
          return;
        }
        let remainingToAllocate=amt;
        const allocs=[];
        selectedRows.forEach(row=>{
          const billRemaining=Number(row.dataset.rem)||0;
          const allocation=Math.min(billRemaining, remainingToAllocate);
          if(allocation>0){
            allocs.push({ id:row.dataset.id, amount:allocation });
            remainingToAllocate-=allocation;
          }
        });
        if(!allocs.length){
          toast("Enter a payment amount for the selected purchase");
          return;
        }
        if(allocs.length) entry.allocations=allocs;
      }
      currentParty.history.push(entry);
      auditLog("add-entry", currentParty.name, label+" ₹"+fmtMoney(amt)+(billNo?" · "+billNo:""));
    }
    saveDB(); closeSheet(); renderKhata();
    toast(editing?("Updated "+label):(label+" "+fmtMoney(amt)));
  };
  const receipt=$("#eReceipt");
  if(receipt)receipt.onclick=()=>{ closeSheet(); printReceipt(existingEntry); };
  const del=$("#eDel");
  if(del)del.onclick=()=>{
    if(!editing) return;
    currentParty.history=currentParty.history.filter(x=>x!==existingEntry);
    auditLog("delete-entry", currentParty.name, label+" ₹"+fmtMoney(existingEntry.amount));
    saveDB(); closeSheet(); renderKhata(); renderHome();
    toast("Entry deleted");
  };
}

/* ============================================================
   PARTY FORM (add / edit)
   ============================================================ */
function daybookSupplierOptions(selected=""){
  return '<option value="">Select supplier</option>'+db.parties.map(p=>
    '<option value="'+esc(p.id)+'"'+(p.id===selected?" selected":"")+'>'+esc(p.name)+'</option>'
  ).join('');
}

function openDaybookSheet(){
  if(!db.parties.length){ toast("Add a supplier first"); return; }
  openSheet(
    '<div class="sheet-head"><h3>Day book entry</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body daybook-body">'
    +'<div class="daybook-hint">Add purchases for a date. Each row is posted to that supplier ledger.</div>'
    +'<div id="daybookRows"></div>'
    +'<button type="button" class="daybook-add" id="daybookAdd">＋ Add more</button>'
    +'<button class="big-save danger" id="daybookSave">Save day book entries</button>'
    +'</div>'
  );
  $("#modalMount .sheet").classList.add("daybook-sheet");
  $("#sClose").onclick=closeSheet;
  const rowsEl=$("#daybookRows");
  const addRow=()=>{
    const row=document.createElement("div");
    row.className="daybook-row";
    row.innerHTML=
      '<div class="daybook-row-head"><b>Entry '+(rowsEl.children.length+1)+'</b><button type="button" class="daybook-remove" aria-label="Remove entry">✕</button></div>'
      +'<div class="daybook-grid">'
      +'<div class="field"><label>Date</label><input class="db-date" type="date" value="'+todayISO()+'"></div>'
      +'<div class="field"><label>Supplier <span class="req">*</span></label><select class="db-supplier">'+daybookSupplierOptions()+'</select></div>'
      +'<div class="field"><label>Amount ₹ <span class="req">*</span></label><input class="db-amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></div>'
      +'<div class="field"><label>Invoice no.</label><input class="db-invoice" placeholder="e.g. INV-1024"></div>'
      +'<div class="field"><label>Note</label><input class="db-note" placeholder="Goods purchased"></div>'
      +'<div class="field"><label>Payment status</label><select class="db-status"><option value="due">Due</option><option value="paid">Paid / Not due</option></select></div>'
      +'<div class="db-payment-fields hidden">'
      +'<div class="field"><label>Payment amount ₹</label><input class="db-payment-amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></div>'
      +'<div class="field"><label>Payment mode</label><select class="db-payment-mode">'+PAYMENT_MODES.map(m=>'<option>'+esc(m)+'</option>').join('')+'</select></div>'
      +'</div>'
      +'<div class="field"><label>Attach photos</label><button type="button" class="attach-btn db-attach">📎 Add photo</button><input class="db-photo" type="file" accept="image/*" multiple style="display:none"><div class="attach-list db-attach-list"></div></div>'
      +'</div>';
    rowsEl.appendChild(row);
    const status=row.querySelector(".db-status");
    const paymentFields=row.querySelector(".db-payment-fields");
    const paymentAmount=row.querySelector(".db-payment-amount");
    status.onchange=()=>{
      const paid=status.value==="paid";
      paymentFields.classList.toggle("hidden", !paid);
      if(paid && !paymentAmount.value) paymentAmount.value=row.querySelector(".db-amount").value||"";
    };
    row.querySelector(".db-amount").oninput=()=>{
      if(status.value==="paid" && !paymentAmount.value) paymentAmount.value=row.querySelector(".db-amount").value;
    };
    const photos=[];
    const photoInput=row.querySelector(".db-photo");
    const photoList=row.querySelector(".db-attach-list");
    const renderPhotos=()=>{
      photoList.innerHTML=photos.map((ph,i)=>'<div class="attach-chip"><img src="'+ph+'" alt=""><span>Photo '+(i+1)+'</span><button type="button" data-i="'+i+'">✕</button></div>').join('');
      $$(".attach-chip button", photoList).forEach(btn=>btn.onclick=()=>{ photos.splice(Number(btn.dataset.i),1); renderPhotos(); });
    };
    row._photos=photos;
    row.querySelector(".db-attach").onclick=()=>photoInput.click();
    photoInput.onchange=()=>{
      Array.from(photoInput.files||[]).forEach(file=>{
        const reader=new FileReader();
        reader.onload=()=>{ photos.push(reader.result); if(photos.length>10) photos.shift(); renderPhotos(); };
        reader.readAsDataURL(file);
      });
      photoInput.value="";
    };
    row.querySelector(".daybook-remove").onclick=()=>{
      if(rowsEl.children.length===1){ toast("Keep at least one entry"); return; }
      row.remove();
      Array.from(rowsEl.children).forEach((r,i)=>{ const b=r.querySelector(".daybook-row-head b"); if(b)b.textContent="Entry "+(i+1); });
    };
  };
  $("#daybookAdd").onclick=addRow;
  addRow();
  $("#daybookSave").onclick=()=>{
    const entries=Array.from(rowsEl.querySelectorAll(".daybook-row"));
    const payload=[];
    for(const row of entries){
      const supplierId=row.querySelector(".db-supplier").value;
      const amount=parseFloat(row.querySelector(".db-amount").value);
      if(!supplierId){ toast("Select a supplier for every entry"); return; }
      if(!amount || amount<=0){ toast("Enter a valid amount for every entry"); return; }
      const date=row.querySelector(".db-date").value||todayISO();
      const supplier=partyById(supplierId);
      const daybookId=uid("D");
      const purchase={
        id:uid("E"), daybookId, type:"gave", amount,
        billNo:row.querySelector(".db-invoice").value.trim(),
        note:row.querySelector(".db-note").value.trim(), date, ts:nowStamp(),
        photos:row._photos.slice()
      };
      payload.push({ supplier, purchase, row });
      if(row.querySelector(".db-status").value==="paid"){
        const paid=parseFloat(row.querySelector(".db-payment-amount").value);
        if(!paid || paid<=0){ toast("Enter a payment amount for paid entries"); return; }
        payload[payload.length-1].payment={
          id:uid("E"), daybookId, type:"got", amount:Math.min(paid, amount),
          billNo:"", mode:row.querySelector(".db-payment-mode").value,
          note:"Payment for "+(purchase.billNo||"purchase"), date, ts:nowStamp(),
          allocations:[{ id:purchase.id, amount:Math.min(paid, amount) }]
        };
      }
    }
    payload.forEach(item=>{
      item.supplier.history.push(item.purchase);
      if(item.payment) item.supplier.history.push(item.payment);
      auditLog("daybook-entry", item.supplier.name, "Purchase "+fmtMoney(item.purchase.amount)+(item.payment?" · Paid "+fmtMoney(item.payment.amount):" · Due"));
    });
    saveDB(); closeSheet(); renderHome();
    if(currentParty) renderKhata();
    toast(payload.length+" day book entr"+(payload.length===1?"y":"ies")+" saved");
  };
}

function dueCycleOption(val, label, selected){
  return '<option value="'+esc(val)+'"'+(selected?" selected":"")+'>'+esc(label)+'</option>';
}
function notifyOption(val, label, current){
  const selected = (val===null) ? (current===null) : (current!==null && current===val);
  return '<option value="'+(val===null?"":esc(val))+'"'+(selected?" selected":"")+'>'+esc(label)+'</option>';
}
function openPartySheet(id){
  // editing an existing supplier requires password verification (guard active once login is set up)
  if(id){
    verifyPasswordSheet("Editing a supplier requires your password.", ()=>openPartySheetCore(id));
    return;
  }
  openPartySheetCore(null);
}
function openPartySheetCore(id){
  const p = id ? partyById(id) : null;
  const bank = (p&&p.bank) ? p.bank : {name:"",account:"",ifsc:""};
  openSheet(
    '<div class="sheet-head"><h3>'+(p?"Edit supplier":"Add supplier")+'</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body">'
    +'<div class="field"><label>Name <span class="req">*</span></label><input id="pName" value="'+esc(p?p.name:"")+'" placeholder="e.g. Ramesh Kirana"></div>'
    +'<div class="field"><label>Mobile</label><input id="pPhone" value="'+esc(p?p.phone:"")+'" placeholder="+91…"></div>'
    +'<div class="field"><label>City / note</label><input id="pCity" value="'+esc(p?p.city:"")+'" placeholder="e.g. Mumbai"></div>'
    +'<div class="field"><label>Group <span class="hint">(optional — create or choose)</span></label><select id="pGroup"></select></div>'
    +'<div class="field hidden" id="pGroupNewWrap"><label>New group name</label><input id="pGroupNew" placeholder="e.g. Dairy"></div>'
    +'<div class="field"><label>Opening balance ₹ <span class="hint">(amount already due to you before tracking)</span></label><input id="pOpening" type="number" step="0.01" inputmode="decimal" value="'+(p?(Number(p.opening)||0):"")+'" placeholder="0.00"></div>'
    +'<div class="field"><label>Payment due cycle <span class="hint">(when you must pay after purchase)</span></label>'
    +'<select id="pDueCycle">'
    + dueCycleOption("0","As received — no fixed due date", p&&!p.dueDays)
    + dueCycleOption("7","7 days", p&&p.dueDays===7)
    + dueCycleOption("15","15 days", p&&p.dueDays===15)
    + dueCycleOption("30","1 month (30 days)", p&&p.dueDays===30)
    + dueCycleOption("custom","Custom…", p&&p.dueDays>0 && ![7,15,30].includes(p.dueDays))
    +'</select></div>'
    +'<div class="field hidden" id="pDueCustomWrap"><label>Custom days</label><input id="pDueCustom" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 45" value="'+(p&&p.dueDays>0&&![7,15,30].includes(p.dueDays)?p.dueDays:"")+'"></div>'
    +'<div class="bank-sec"><div class="bank-sec-title">Bank details</div>'
    +'<div class="field"><label>Bank name</label><input id="pBankName" value="'+esc(bank.name)+'" placeholder="e.g. State Bank of India"></div>'
    +'<div class="field"><label>Account number</label><input id="pBankAcc" value="'+esc(bank.account)+'" placeholder="Account no."></div>'
    +'<div class="field"><label>IFSC</label><input id="pBankIfsc" value="'+esc(bank.ifsc)+'" placeholder="e.g. SBIN0001234"></div>'
    +'</div>'
    +'<button class="big-save primary" id="pSave">'+(p?"Save":"Add supplier")+'</button>'
    +(p?'<button class="big-save danger" id="pDel" style="margin-top:10px;background:var(--card);color:var(--red);border:1px solid var(--red)">Delete supplier</button>':'')
    +'</div>'
  );
  $("#sClose").onclick=closeSheet;
  // due cycle toggle: show custom-days input when "Custom" selected
  const dueSel=$("#pDueCycle"); const dueCustomWrap=$("#pDueCustomWrap");
  const syncDueCycle=()=>{ if(dueCustomWrap) dueCustomWrap.classList.toggle("hidden", !(dueSel&&dueSel.value==="custom")); };
  if(dueSel) dueSel.onchange=syncDueCycle;
  syncDueCycle();
  // group: dynamic select built from saved groups + create-new
  const grpSel=$("#pGroup"); const grpNewWrap=$("#pGroupNewWrap");
  const currentGroup = p? (p.group||"") : "";
  const populateGroupSelect=()=>{
    if(!grpSel) return;
    const groups=allGroups(); // includes currentGroup if persisted via parties
    let opts='<option value="">No group</option>';
    groups.forEach(g=>{
      opts+='<option value="'+esc(g)+'"'+(g===currentGroup?" selected":"")+'>'+esc(g)+'</option>';
    });
    // if current group isn't in the list (shouldn't happen), still show it
    if(currentGroup && !groups.includes(currentGroup)){
      opts+='<option value="'+esc(currentGroup)+'" selected>'+esc(currentGroup)+'</option>';
    }
    opts+='<option value="__new__">➕ New group…</option>';
    grpSel.innerHTML=opts;
  };
  populateGroupSelect();
  const syncGroup=()=>{
    const isNew = grpSel && grpSel.value==="__new__";
    if(grpNewWrap) grpNewWrap.classList.toggle("hidden", !isNew);
    if(isNew){ const inp=$("#pGroupNew"); if(inp) inp.focus(); }
  };
  if(grpSel) grpSel.onchange=syncGroup;
  syncGroup();
  $("#pSave").onclick=()=>{
    const name=$("#pName").value.trim();
    if(!name){ toast("Name required"); return; }
    const bank={ name:$("#pBankName").value.trim(), account:$("#pBankAcc").value.trim(), ifsc:$("#pBankIfsc").value.trim() };
    const opening=parseFloat($("#pOpening").value)||0;
    // resolve dueDays from cycle selection
    let dueDays=0; const dv=dueSel?dueSel.value:"0";
    if(dv==="custom"){ dueDays=parseInt($("#pDueCustom").value,10)||0; }
    else if(dv && dv!=="0"){ dueDays=parseInt(dv,10)||0; }
    if(dueDays<0) dueDays=0;
    // resolve group
    let group=""; const gv=grpSel?grpSel.value:"";
    if(gv==="__new__"){ group=$("#pGroupNew").value.trim(); if(group) addGroup(group); }
    else { group=gv; }
    if(p){ p.name=name; p.phone=$("#pPhone").value.trim(); p.city=$("#pCity").value.trim(); p.bank=bank; p.opening=opening; p.dueDays=dueDays; p.group=group; auditLog("edit-party", name, ""); }
    else{ db.parties.push({ id:uid("P"), name, phone:$("#pPhone").value.trim(), city:$("#pCity").value.trim(), bank, opening, dueDays, group, color:paletteFor(name), createdAt:todayISO(), history:[] }); auditLog("add-party", name, group||""); }
    saveDB(); closeSheet(); renderHome(); if(currentParty&&p)openKhata(p.id);
    toast(p?"Saved":"Supplier added");
  };
  const dl=$("#pDel"); if(dl)dl.onclick=()=>{ if(!p)return; verifyPasswordSheet("Deleting a supplier requires your password.", ()=>{ db.parties=db.parties.filter(x=>x.id!==p.id); auditLog("delete-party", p.name, ""); saveDB(); closeSheet(); if(currentParty&&currentParty.id===p.id)closeKhata(); renderHome(); toast("Deleted"); }); };
}

/* ============================================================
   AUDIT LOG
   ============================================================ */
const AUDIT_KEY = "bahikhata.audit";
function getAudit(){ try{ const r=localStorage.getItem(AUDIT_KEY); return r?JSON.parse(r):[]; }catch(e){ return []; } }
function saveAudit(a){ try{ localStorage.setItem(AUDIT_KEY, JSON.stringify(a)); }catch(e){} }
const AUDIT_LABELS = {
  "add-party":"Added supplier", "edit-party":"Edited supplier", "delete-party":"Deleted supplier",
  "add-entry":"Added entry", "edit-entry":"Edited entry", "delete-entry":"Deleted entry"
};
function auditLog(type, subject, detail){
  const a=getAudit();
  a.unshift({ ts:nowStamp(), type, subject, detail:detail||"" });
  if(a.length>500) a.length=500;
  saveAudit(a);
}
function openAuditViewer(){
  const a=getAudit();
  const rows = a.length
    ? a.map(e=>{
        const icon = AUDIT_LABELS[e.type]||e.type;
        const cls = e.type.indexOf("delete")>=0 ? "audit-del" : e.type.indexOf("add")>=0 ? "audit-add" : "audit-edit";
        return '<div class="audit-row">'
          +'<div class="audit-main"><div class="audit-type '+cls+'">'+esc(icon)+'</div>'
          +'<div class="audit-subject">'+esc(e.subject)+(e.detail?(' · '+esc(e.detail)):"")+'</div></div>'
          +'<div class="audit-time">'+fmtTime(e.ts)+'</div>'
          +'</div>';
      }).join('')
    : '<div class="empty"><div class="big">📋</div><p>No activity yet</p><small>Every add / edit / delete will be logged here</small></div>';
  openSheet(
    '<div class="sheet-head"><h3>📋 Audit log</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body">'
    +'<div class="reminder-note">A record of every change you make to the ledger.</div>'
    +'<div class="audit-list">'+rows+'</div>'
    +(a.length?'<button class="mini-btn danger" id="auditClear" style="margin-top:12px;flex:none">Clear log</button>':'')
    +'</div>'
  );
  $("#sClose").onclick=closeSheet;
  const clr=$("#auditClear");
  if(clr)clr.onclick=()=>{
    if(!hasAuth()){ if(confirm("Clear the entire audit log?")){ saveAudit([]); closeSheet(); toast("Audit log cleared"); } return; }
    closeSheet();
    verifyPasswordSheet("Clearing the audit log requires your password.", ()=>{
      if(confirm("Clear the entire audit log?")){ saveAudit([]); toast("Audit log cleared"); }
    });
  };
}

/* ============================================================
   RECEIPT (payment / purchase confirmation)
   ============================================================ */
function printReceipt(entry){
  const p=currentParty; if(!p||!entry) return;
  const isGave = entry.type==="gave";
  const label = isGave ? "PURCHASE" : "PAYMENT";
  const color = isGave ? "#E84C3D" : "#1FA56E";
  const bk = p.bank||{name:"",account:"",ifsc:""};
  const hasBank = !!(bk.name||bk.account||bk.ifsc);
  const nowStr = new Date().toLocaleString("en-IN");
  const wordAmount = amountToWords(entry.amount);
  $("#printArea").innerHTML=
    '<div style="color:#111;max-width:520px;margin:0 auto">'
    // header band
    +'<div style="background:'+color+';color:#fff;border-radius:12px 12px 0 0;padding:20px 22px;text-align:center">'
    +'<div style="font-size:10.5px;letter-spacing:3px;opacity:.9">BAHIKHATA · SUPPLIER BOOK</div>'
    +'<div style="font-size:24px;font-weight:800;margin-top:4px">'+label+' RECEIPT</div>'
    +'</div>'
    // body
    +'<div style="border:2px solid '+color+';border-top:0;border-radius:0 0 12px 12px;padding:18px 22px">'
    // meta row
    +'<div style="display:flex;justify-content:space-between;font-size:12.5px;color:#555;margin-bottom:16px">'
    +'<div><span style="color:#999">Receipt no.</span><br><b>'+esc(entry.billNo||"—")+'</b></div>'
    +'<div style="text-align:right"><span style="color:#999">Date</span><br><b>'+fmtDate(entry.date)+'</b></div>'
    +'</div>'
    // party block
    +'<div style="margin-bottom:16px">'
    +'<div style="font-size:10.5px;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">'+(isGave?'Billed to':'Received from')+'</div>'
    +'<div style="font-weight:800;font-size:15.5px">'+esc(p.name)+'</div>'
    +(p.phone?'<div style="font-size:12.5px;color:#444">📱 '+esc(p.phone)+'</div>':'')
    +(p.city?'<div style="font-size:12.5px;color:#444">📍 '+esc(p.city)+'</div>':'')
    +'</div>'
    // amount box
    +'<div style="background:'+color+';color:#fff;border-radius:10px;padding:16px;text-align:center;margin-bottom:16px">'
    +'<div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;opacity:.9">'+(isGave?'Amount purchased':'Amount paid')+'</div>'
    +'<div style="font-size:30px;font-weight:800;margin:4px 0">₹'+moneyNum(entry.amount)+'</div>'
    +(wordAmount?'<div style="font-size:11px;opacity:.92;font-style:italic">('+esc(wordAmount)+')</div>':'')
    +'</div>'
    // details table
    +'<table style="width:100%;font-size:12.5px;border-collapse:collapse;margin-bottom:16px">'
    +'<tr><td style="padding:5px 0;color:#999">Mode</td><td style="padding:5px 0;text-align:right;font-weight:600">'+(isGave?'Goods purchased':(entry.mode||"—"))+'</td></tr>'
    +(entry.note?'<tr><td style="padding:5px 0;color:#999">Note</td><td style="padding:5px 0;text-align:right;font-weight:600">'+esc(entry.note)+'</td></tr>':'')
    +'</table>'
    // bank details (full)
    +(hasBank?'<div style="margin-bottom:16px">'
      +'<div style="font-size:10.5px;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Bank details</div>'
      +'<div style="border:1px solid #ddd;border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.8">'
      +(bk.name?'<div><b style="color:#555">Bank:</b> '+esc(bk.name)+'</div>':'')
      +(bk.account?'<div><b style="color:#555">A/C:</b> '+esc(bk.account)+'</div>':'')
      +(bk.ifsc?'<div><b style="color:#555">IFSC:</b> '+esc(bk.ifsc)+'</div>':'')
      +'</div></div>':'')
    // footer
    +'<div style="font-size:10.5px;color:#666;text-align:center;border-top:1px dashed #ccc;padding-top:10px;margin-bottom:20px">Generated '+nowStr+' · This is a computer-generated receipt and does not require a signature.</div>'
    // signatures
    +'<div style="display:flex;justify-content:space-between;font-size:11px;color:#555;margin-top:26px">'
    +'<span style="border-top:1px solid #666;padding-top:4px;min-width:130px;text-align:center">Customer signature</span>'
    +'<span style="border-top:1px solid #666;padding-top:4px;min-width:130px;text-align:center">Authorized signature</span>'
    +'</div>'
    +'</div>'
    +'</div>';
  window.print();
}

/* ============================================================
   PARTY MENU SHEET (edit / call / report / share)
   ============================================================ */
function openPartyMenu(){
  const p=currentParty; if(!p)return;
  const bk = p.bank||{name:"",account:"",ifsc:""};
  const hasBank = !!(bk.name||bk.account||bk.ifsc);

  let bankSection = '';
  if(hasBank){
    const short = [
      bk.name,
      bk.account?"A/C "+bk.account:"",
      bk.ifsc?"IFSC "+bk.ifsc:""
    ].filter(Boolean).join(" · ");
    bankSection = '<div class="menu-sec"><div class="menu-sec-head">🏦 Bank details</div>'
      +'<div class="menu-bank-line">'+esc(short)+'</div>'
      +'<div class="menu-sec-actions">'
      +'<button class="mini-btn" id="mCopyBank">Copy</button>'
      +'<button class="mini-btn" id="mEditBank">Edit</button>'
      +'</div></div>';
  } else {
    bankSection = '<div class="menu-sec"><div class="menu-sec-head">🏦 Bank details</div>'
      +'<div class="menu-bank-line muted">No bank details added</div>'
      +'<div class="menu-sec-actions"><button class="mini-btn" id="mEditBank">Add</button></div></div>';
  }

  const dateOpts=[["all","All"],["this-month","This mo."],["last-month","Last mo."],["custom","Custom"]];
  openSheet(
    '<div class="sheet-head"><h3>'+esc(p.name)+'</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body" style="display:flex;flex-direction:column;gap:9px">'
    +'<div class="menu-sec"><div class="menu-sec-head">📅 Date filter</div>'
    +'<div class="menu-date-row">'
    + dateOpts.map(o=>'<button type="button" class="df-chip'+(khataDateFilter===o[0]?" active":"")+'" data-df="'+o[0]+'">'+o[1]+'</button>').join('')
    +'</div>'
    +'<div class="df-custom'+(khataDateFilter==="custom"?"":" hidden")+'" id="dfCustom">'
    +'<input id="dfFrom" type="date" value="'+esc(khataCustomFrom)+'">'
    +'<span>to</span>'
    +'<input id="dfTo" type="date" value="'+esc(khataCustomTo)+'">'
    +'</div></div>'
    + bankSection
    +'<button class="row-btn" id="mEdit"><svg viewBox="0 0 24 24" style="color:var(--blue)"><use href="#i-plus"/></svg>Edit party</button>'
    +(p.phone?'<a class="row-btn" href="tel:'+esc(p.phone)+'" style="text-decoration:none;color:var(--txt)"><svg viewBox="0 0 24 24" style="color:var(--green)"><use href="#i-call"/></svg>Call '+esc(p.phone)+'</a>':'')
    +(p.phone?'<button class="row-btn" id="mWaShare"><svg viewBox="0 0 24 24" style="color:var(--green)"><use href="#i-whatsapp"/></svg>Share on WhatsApp</button>':'')
    +'<button class="row-btn" id="mRemind"><svg viewBox="0 0 24 24" style="color:var(--amber)"><use href="#i-call"/></svg>Send payment note</button>'
    +'<button class="row-btn" id="mPrint"><svg viewBox="0 0 24 24" style="color:var(--amber)"><use href="#i-download"/></svg>Print / PDF</button>'
    +'</div>'
  );
  $("#sClose").onclick=closeSheet;

  // date filter chips
  $$("#modalMount .df-chip").forEach(c=>c.onclick=()=>{
    khataDateFilter=c.dataset.df; renderKhata(); openPartyMenu();
  });
  const fromEl=$("#dfFrom"), toEl=$("#dfTo");
  if(fromEl)fromEl.onchange=()=>{ khataCustomFrom=fromEl.value; renderKhata(); openPartyMenu(); };
  if(toEl)toEl.onchange=()=>{ khataCustomTo=toEl.value; renderKhata(); openPartyMenu(); };

  // bank copy / edit
  const cpy=$("#mCopyBank");
  if(cpy)cpy.onclick=()=>{ copyText(p.name+"\nBank: "+bk.name+"\nAccount no.: "+bk.account+"\nIFSC: "+bk.ifsc); };
  const edt=$("#mEditBank");
  if(edt)edt.onclick=()=>{ closeSheet(); openPartySheet(p.id); };

  $("#mEdit").onclick=()=>{ closeSheet(); openPartySheet(p.id); };
  const waShare=$("#mWaShare"); if(waShare)waShare.onclick=()=>{ closeSheet(); waShareParty(p); };
  const remind=$("#mRemind"); if(remind)remind.onclick=()=>{ closeSheet(); waRemindParty(p); };
  const mp=$("#mPrint"); if(mp)mp.onclick=()=>{ closeSheet(); printKhata(); };
}

function waPhone(p){ return String(p.phone||"").replace(/[^0-9]/g,""); }
function waShareParty(p){
  const b=partyBalance(p);
  const msg = '🏪 *'+p.name+'* — Statement\n'
    +(p.city?('📍 '+p.city+'\n'):'')
    +'Purchases: ₹'+moneyNum(b.gave)+'\n'
    +'Payments: ₹'+moneyNum(b.got)+'\n'
    +(b.net>0.009?'💰 *To pay: ₹'+moneyNum(b.net)+'*':b.net<-0.009?'💵 *Advance: ₹'+moneyNum(-b.net)+'*':'✅ Settled');
  openWa(waPhone(p), msg);
}
function waRemindParty(p){
  const b=partyBalance(p);
  if(b.net<=0.009){ toast("Nothing due to "+p.name); return; }
  const msg = '🙏 Dear '+p.name+',\n\nJust to update you — there is an amount of *₹'+moneyNum(b.net)+'* pending from my side. I will clear this payment shortly.\n\nThank you!';
  openWa(waPhone(p), msg);
}
function openWa(phone, text){
  const num=phone;
  if(!num){ toast("No mobile number saved"); return; }
  const url='https://wa.me/'+num+'?text='+encodeURIComponent(text);
  window.open(url, "_blank");
}

function printKhata(){
  const p=currentParty; if(!p)return;
  const b=partyBalance(p);
  const { fFrom, fTo, label } = dateFilterRange();
  const allSorted=(p.history||[]).slice().sort((a,b)=>(a.ts||a.date||"").localeCompare(b.ts||b.date||""));
  const filtered = (khataDateFilter==="all")
    ? allSorted
    : allSorted.filter(e=> dateInRange(e.date||e.ts, fFrom, fTo));

  let opening=Number(p.opening)||0;
  if(khataDateFilter!=="all"){
    allSorted.forEach(e=>{
      const d=(e.date||e.ts||"").slice(0,10);
      if(d < (fFrom||"9999")) opening += (e.type==="gave"?e.amount:-e.amount);
    });
  }

  const entries=filtered;
  let run=opening;
  const rows=entries.map(e=>{ 
    run += e.type==="gave"?e.amount:-e.amount; 
    const isGave = e.type==="gave";
    return '<tr style="border-bottom:1px solid #E5E7EB;'+(Math.random()>0.5?'background:#F9FAFB':'background:#FFFFFF')+'">'
      +'<td style="padding:10px;border:1px solid #E5E7EB;font-size:11px">'+fmtDate(e.date)+'</td>'
      +'<td style="padding:10px;border:1px solid #E5E7EB;font-size:11px"><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-weight:600;'+(isGave?'background:#FECACA;color:#991B1B':'background:#DCFCE7;color:#166534')+'">'+(isGave?"Purchase":"Payment")+'</span></td>'
      +'<td style="padding:10px;border:1px solid #E5E7EB;font-size:11px">'+(e.billNo?esc(e.billNo):e.note?esc(e.note):"—")+'</td>'
      +'<td style="padding:10px;border:1px solid #E5E7EB;font-size:11px">'+(e.mode?esc(e.mode):"—")+'</td>'
      +'<td style="padding:10px;border:1px solid #E5E7EB;text-align:right;font-weight:600;font-size:11px;'+(isGave?'color:#991B1B':'color:#166534')+'">'+(isGave?'+':'-')+moneyNum(e.amount)+'</td>'
      +'<td style="padding:10px;border:1px solid #E5E7EB;text-align:right;font-weight:700;font-size:11px;background:'+(run>0.009?'#FEE2E2':run<-0.009?'#DDD6FE':'#DCFCE7')+'">'+(run>0.009?'₹'+moneyNum(run)+'↑':run<-0.009?'₹'+moneyNum(-run)+'↓':'✓ 0')+'</td>'
      +'</tr>'; 
  }).join("");

  const openingRow = (opening!==0)
    ? '<tr style="background:#EFF6FF;border-bottom:2px solid #BFDBFE;font-weight:700"><td colspan="5" style="padding:10px;border:1px solid #BFDBFE">Opening balance'+(khataDateFilter!=="all"?(' as on '+fmtDate(fFrom||"")+''):'')+'</td><td style="padding:10px;border:1px solid #BFDBFE;text-align:right">₹'+moneyNum(opening)+'</td></tr>'
    : '';

  const bk = p.bank||{name:"",account:"",ifsc:""};
  const bankBlock = (bk.name||bk.account||bk.ifsc)
    ? '<div style="background:linear-gradient(135deg,#2563EB,#60A5FA);color:#fff;border-radius:8px;padding:12px 14px;margin:14px 0;font-size:11px">'
      +'<div style="font-weight:700;margin-bottom:4px">🏦 Bank Details</div>'
      +(bk.name?'<div style="margin:2px 0">Bank: '+esc(bk.name)+'</div>':'')
      +(bk.account?'<div style="margin:2px 0">Account: '+esc(bk.account)+'</div>':'')
      +(bk.ifsc?'<div style="margin:2px 0">IFSC: '+esc(bk.ifsc)+'</div>':'')
      +'</div>'
    : '';
  
  let periodText = label;
  if(khataDateFilter==="custom" || (khataDateFilter!=="all" && (fFrom||fTo))){
    periodText = (fFrom?fmtDate(fFrom):"…")+' → '+(fTo?fmtDate(fTo):"today");
  }
  
  const netLabel = b.net>0.009?"Amount Due to You":b.net<-0.009?"Advance Paid":"Settled";
  const netVal = b.net>0.009?moneyNum(b.net):b.net<-0.009?moneyNum(-b.net):"0";
  const netColor = b.net>0.009?'#DC2626':b.net<-0.009?'#2563EB':'#16A34A';
  const netGradient = b.net>0.009?'linear-gradient(135deg,#DC2626,#F87171)':b.net<-0.009?'linear-gradient(135deg,#2563EB,#60A5FA)':'linear-gradient(135deg,#16A34A,#4ADE80)';
  
  $("#printArea").innerHTML=
    '<div style="max-width:1000px;margin:0 auto;font-family:system-ui,sans-serif;color:#1A1B1E">'
    // Header
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:20px 0;border-bottom:3px solid '+netColor+';margin-bottom:20px">'
    +'<div>'
    +'<div style="font-size:24px;font-weight:900;letter-spacing:-0.4px">'+esc(p.name)+'</div>'
    +'<div style="font-size:12px;color:#6B7280;margin-top:2px">Supplier Statement & Ledger</div>'
    +(p.phone?'<div style="font-size:11px;color:#6B7280;margin-top:4px">📱 '+esc(p.phone)+'</div>':'')
    +(p.city?'<div style="font-size:11px;color:#6B7280">📍 '+esc(p.city)+'</div>':'')
    +'</div>'
    +'<div style="text-align:right">'
    +'<div style="font-size:12px;color:#6B7280">📅 '+periodText+'</div>'
    +'<div style="font-size:12px;color:#6B7280">'+new Date().toLocaleDateString("en-IN")+'</div>'
    +'</div>'
    +'</div>'
    
    // Summary Cards
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0">'
    +'<div style="background:#F3F4F6;border-radius:6px;padding:12px">'
    +'<div style="font-size:10px;color:#6B7280;font-weight:700">Opening</div>'
    +'<div style="font-size:16px;font-weight:900;margin-top:4px">₹'+moneyNum(opening)+'</div>'
    +'</div>'
    +'<div style="background:#FEE2E2;border-radius:6px;padding:12px">'
    +'<div style="font-size:10px;color:#991B1B;font-weight:700">Purchases</div>'
    +'<div style="font-size:16px;font-weight:900;color:#991B1B;margin-top:4px">₹'+moneyNum(b.gave)+'</div>'
    +'</div>'
    +'<div style="background:#DCFCE7;border-radius:6px;padding:12px">'
    +'<div style="font-size:10px;color:#166534;font-weight:700">Payments</div>'
    +'<div style="font-size:16px;font-weight:900;color:#166534;margin-top:4px">₹'+moneyNum(b.got)+'</div>'
    +'</div>'
    +'<div style="background:'+netGradient+';border-radius:6px;padding:12px;color:#fff">'
    +'<div style="font-size:10px;font-weight:700;opacity:0.95">'+netLabel+'</div>'
    +'<div style="font-size:16px;font-weight:900;margin-top:4px">₹'+netVal+'</div>'
    +'</div>'
    +'</div>'
    
    + bankBlock
    
    // Ledger Table
    +'<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:11px">'
    +'<thead><tr style="background:#F3F4F6;border-bottom:2px solid #D1D5DB">'
    +'<th style="padding:10px;text-align:left;font-weight:700;border:1px solid #D1D5DB">Date</th>'
    +'<th style="padding:10px;text-align:left;font-weight:700;border:1px solid #D1D5DB">Type</th>'
    +'<th style="padding:10px;text-align:left;font-weight:700;border:1px solid #D1D5DB">Reference</th>'
    +'<th style="padding:10px;text-align:left;font-weight:700;border:1px solid #D1D5DB">Mode</th>'
    +'<th style="padding:10px;text-align:right;font-weight:700;border:1px solid #D1D5DB">Amount ₹</th>'
    +'<th style="padding:10px;text-align:right;font-weight:700;border:1px solid #D1D5DB">Balance ₹</th>'
    +'</tr></thead><tbody>'
    + openingRow
    + (rows||'<tr><td colspan="6" style="padding:10px;text-align:center;color:#6B7280">No entries in this period</td></tr>')
    +'</tbody></table>'
    
    // Footer Summary
    +'<div style="background:'+netGradient+';color:#fff;border-radius:8px;padding:16px;margin-top:20px;text-align:center">'
    +'<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.2px;opacity:0.95">'+netLabel+'</div>'
    +'<div style="font-size:28px;font-weight:900;margin:8px 0;letter-spacing:-0.5px">₹'+netVal+'</div>'
    +'</div>'
    
    // Footer Info
    +'<div style="margin-top:30px;padding-top:20px;border-top:1px solid #D1D5DB;text-align:center;font-size:10px;color:#6B7280">'
    +'<p>This is a computer-generated statement. For official records, maintain supporting documents.</p>'
    +'<p style="margin-top:8px">Bahikhata © 2026 | www.bahikhata.app</p>'
    +'</div>'
    +'</div>';
  
  window.print();
}

/* ============================================================
   EXPORT (download menu: PDF / Excel / Advanced Reports)
   ============================================================ */

function copyText(txt){
  const done=()=>toast("Copied to clipboard");
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(done).catch(()=>fallbackCopy(txt,done)); }
  else fallbackCopy(txt,done);
}
function fallbackCopy(txt,done){
  const ta=document.createElement("textarea"); ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0";
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand("copy"); done(); }catch(e){ toast("Copy not supported"); }
  document.body.removeChild(ta);
}

function openDownloadMenu(){
  openSheet(
    '<div class="sheet-head"><h3>📊 Export & Reports</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body" style="display:flex;flex-direction:column;gap:8px">'
    +'<div style="font-size:11px;font-weight:700;color:var(--meta);text-transform:uppercase;letter-spacing:0.3px;margin:4px 0">📄 PDF Reports</div>'
    +'<button class="row-btn export-btn" id="dlPdf"><svg viewBox="0 0 24 24" style="color:#DC2626"><use href="#i-download"/></svg><div style="flex:1;text-align:left"><div style="font-weight:700">Summary PDF</div><div style="font-size:11px;color:var(--meta)">All suppliers, dues & bank details</div></div></button>'
    +'<button class="row-btn export-btn" id="dlPayReport"><svg viewBox="0 0 24 24" style="color:#16A34A"><use href="#i-download"/></svg><div style="flex:1;text-align:left"><div style="font-weight:700">Payment Report</div><div style="font-size:11px;color:var(--meta)">Payments with date filter</div></div></button>'
    +'<button class="row-btn export-btn" id="dlPurReport"><svg viewBox="0 0 24 24" style="color:#DC2626"><use href="#i-download"/></svg><div style="flex:1;text-align:left"><div style="font-weight:700">Purchase Report</div><div style="font-size:11px;color:var(--meta)">Purchases with date filter</div></div></button>'
    +'<button class="row-btn export-btn" id="dlDaybookReport"><svg viewBox="0 0 24 24" style="color:#7C3AED"><use href="#i-download"/></svg><div style="flex:1;text-align:left"><div style="font-weight:700">Day Book Report</div><div style="font-size:11px;color:var(--meta)">Datewise purchases, payments & dues</div></div></button>'
    +'<div style="font-size:11px;font-weight:700;color:var(--meta);text-transform:uppercase;letter-spacing:0.3px;margin:8px 0">📊 Excel & Data</div>'
    +'<button class="row-btn export-btn" id="dlExcel"><svg viewBox="0 0 24 24" style="color:#16A34A"><use href="#i-download"/></svg><div style="flex:1;text-align:left"><div style="font-weight:700">Full Excel (.xlsx)</div><div style="font-size:11px;color:var(--meta)">All suppliers with details</div></div></button>'
    +'<button class="row-btn export-btn" id="dlCSV"><svg viewBox="0 0 24 24" style="color:#2563EB"><use href="#i-download"/></svg><div style="flex:1;text-align:left"><div style="font-weight:700">CSV Export</div><div style="font-size:11px;color:var(--meta)">Compatible with Google Sheets</div></div></button>'
    +'</div>'
  );
  $("#sClose").onclick=closeSheet;
  $("#dlPdf").onclick=()=>{ closeSheet(); printAllPDF(); };
  $("#dlPayReport").onclick=()=>{ closeSheet(); openReportDatePicker("got"); };
  $("#dlPurReport").onclick=()=>{ closeSheet(); openReportDatePicker("gave"); };
  $("#dlDaybookReport").onclick=()=>{ closeSheet(); openDaybookReportDatePicker(); };
  $("#dlExcel").onclick=()=>{ closeSheet(); exportExcelAdvanced(); };
  $("#dlCSV").onclick=()=>{ closeSheet(); exportCSV(); };
}

function openDaybookReportDatePicker(){
  let sel="this-month", customFrom="", customTo="";
  const opts=[["all","All time"],["this-month","This month"],["last-month","Last month"],["custom","Custom"]];
  const y=new Date().getFullYear(), m=new Date().getMonth(), pad=n=>String(n).padStart(2,"0");
  const tmFrom=y+"-"+pad(m+1)+"-01", tmTo=y+"-"+pad(m+1)+"-"+pad(new Date(y,m+1,0).getDate());
  const lmFrom=y+"-"+pad(m)+"-01", lmTo=y+"-"+pad(m)+"-"+pad(new Date(y,m,0).getDate());
  const today=y+"-"+pad(m+1)+"-"+pad(new Date().getDate());
  openSheet(
    '<div class="sheet-head"><h3 style="color:var(--blueviolet,#7C3AED)">Day Book report</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body"><div class="field"><label>Date filter</label><div class="date-filter" id="dbReportChips">'
    +opts.map(o=>'<button type="button" class="df-chip'+(sel===o[0]?" active":"")+'" data-f="'+o[0]+'">'+o[1]+'</button>').join('')
    +'</div></div><div class="df-custom" id="dbReportCustom"><input id="dbReportFrom" type="date" value="'+tmFrom+'"><span>to</span><input id="dbReportTo" type="date" value="'+tmTo+'"></div>'
    +'<button class="big-save primary" id="dbReportGo">Generate PDF</button></div>'
  );
  $("#sClose").onclick=closeSheet;
  $$("#dbReportChips .df-chip").forEach(chip=>chip.onclick=()=>{
    sel=chip.dataset.f;
    $$("#dbReportChips .df-chip").forEach(x=>x.classList.remove("active"));
    chip.classList.add("active");
    const from=$("#dbReportFrom"), to=$("#dbReportTo");
    if(sel==="all"){ from.value=""; to.value=""; }
    if(sel==="this-month"){ from.value=tmFrom; to.value=tmTo; }
    if(sel==="last-month"){ from.value=lmFrom; to.value=lmTo; }
  });
  $("#dbReportGo").onclick=()=>{
    const from=$("#dbReportFrom").value;
    const to=$("#dbReportTo").value;
    if(from && to && from>to){ toast("From date cannot be after To date"); return; }
    closeSheet();
    printDaybookReport(from,to);
  };
}

function printDaybookReport(from="", to=""){
  const rows=[];
  let reportPaymentsTotal=0;
  db.parties.forEach(p=>{
    const history=p.history||[];
    history.forEach(e=>{
      if(e.type==="got" && dateInRange(e.date||e.ts,from,to)){
        reportPaymentsTotal+=Number(e.amount)||0;
      }
    });
    history.forEach(e=>{
      if(!dateInRange(e.date||e.ts,from,to)) return;
      if(e.type==="gave"){
        const linkedPayments=[];
        history.forEach(x=>{
          if(x.type!=="got" || !dateInRange(x.date||x.ts,from,to)) return;
          const allocation=(x.allocations||[]).find(a=>String(a.id)===String(e.id));
          if(allocation){
            linkedPayments.push({entry:x,amount:Number(allocation.amount)||0});
          }else if(e.daybookId && x.daybookId===e.daybookId && !(x.allocations&&x.allocations.length)){
            linkedPayments.push({entry:x,amount:Number(x.amount)||0});
          }
        });
        const paid=Math.min(Number(e.amount)||0,linkedPayments.reduce((sum,x)=>sum+x.amount,0));
        const payment=linkedPayments[0]&&linkedPayments[0].entry;
        rows.push({
          date:e.date||e.ts||"", supplier:p.name, invoice:e.billNo||"—",
          note:e.note||"—", amount:Number(e.amount)||0, paid,
          due:Math.max(0,(Number(e.amount)||0)-paid),
          mode:payment&&payment.mode||"—", photos:e.photos||[], isPayment:false
        });
      }else if(e.type==="got" && !e.daybookId){
        const linkedBill=(e.allocations||[]).map(a=>history.find(x=>String(x.id)===String(a.id))).find(Boolean);
        if(!linkedBill) reportPaymentsTotal+=Number(e.amount)||0;
        rows.push({
          date:e.date||e.ts||"", supplier:p.name,
          invoice:linkedBill ? (linkedBill.billNo||"—") : "Payment",
          note:e.note||"Manual payment", amount:0, paid:Number(e.amount)||0,
          due:0, mode:e.mode||"—", photos:e.photos||[],
          isPayment:true, includePaymentTotal:!linkedBill
        });
      }
    });
  });
  rows.sort((a,b)=>b.date.localeCompare(a.date)||a.supplier.localeCompare(b.supplier));
  const grouped={};
  rows.forEach(r=>(grouped[r.date.slice(0,10)] ||= []).push(r));
  const periodText=(!from&&!to)?"All time":(from?fmtDate(from):"…")+" → "+(to?fmtDate(to):"today");
  const total=rows.reduce((s,r)=>s+r.amount,0);
  const paid=reportPaymentsTotal;
  let html='<div style="max-width:1100px;margin:0 auto;font-family:system-ui,sans-serif;color:#1A1B1E">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 0;border-bottom:3px solid #7C3AED;margin-bottom:20px">'
    +'<div><div style="font-size:28px;font-weight:900">Day Book Report</div><div style="font-size:12px;color:#6B7280">Datewise purchase and payment register</div></div>'
    +'<div style="text-align:right;font-size:12px;color:#6B7280">📅 '+periodText+'<br>'+new Date().toLocaleDateString("en-IN")+'</div></div>';
  Object.keys(grouped).sort((a,b)=>b.localeCompare(a)).forEach(date=>{
    const dayRows=grouped[date];
    html+='<div style="margin-bottom:22px"><div style="background:#7C3AED;color:#fff;padding:10px 14px;font-weight:800;font-size:14px">'+fmtDate(date)+'</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed"><colgroup><col style="width:14%"><col style="width:11%"><col style="width:24%"><col style="width:10%"><col style="width:8%"><col style="width:8%"><col style="width:9%"><col class="report-attachments-col" style="width:16%"></colgroup><thead><tr style="background:#F3F4F6">'
      +'<th style="padding:9px;text-align:left;border:1px solid #D1D5DB">Supplier</th><th style="padding:9px;text-align:left;border:1px solid #D1D5DB">Invoice no.</th><th style="padding:9px;text-align:left;border:1px solid #D1D5DB">Note</th><th style="padding:9px;text-align:right;border:1px solid #D1D5DB">Purchase ₹</th><th style="padding:9px;text-align:right;border:1px solid #D1D5DB">Paid ₹</th><th style="padding:9px;text-align:right;border:1px solid #D1D5DB">Due ₹</th><th style="padding:9px;text-align:left;border:1px solid #D1D5DB">Payment</th><th class="report-attachments-col" style="padding:9px;text-align:left;border:1px solid #D1D5DB">Attachments</th></tr></thead><tbody>'
      +dayRows.map(r=>{
        const galleryId="db-gallery-"+Math.random().toString(36).slice(2,9);
        const photos=r.photos.length
          ? '<div class="db-report-gallery" data-gallery="'+galleryId+'" data-index="0" data-photos=\''+esc(JSON.stringify(r.photos))+'\'><button type="button" class="db-gallery-prev" aria-label="Previous attachment">‹</button><img src="'+esc(r.photos[0])+'" alt="Attachment"><button type="button" class="db-gallery-next" aria-label="Next attachment">›</button><a class="db-gallery-download" href="'+esc(r.photos[0])+'" download="attachment-1.jpg" aria-label="Download attachment">↓</a><span class="db-gallery-count">1 / '+r.photos.length+'</span></div>'
          : "—";
        return '<tr><td style="padding:9px;border:1px solid #E5E7EB;vertical-align:top">'+esc(r.supplier)+'</td><td style="padding:9px;border:1px solid #E5E7EB;vertical-align:top;word-break:break-word">'+esc(r.invoice)+'</td><td style="padding:9px;border:1px solid #E5E7EB;vertical-align:top;word-break:break-word;color:#4B5563">'+esc(r.note)+'</td><td style="padding:9px;text-align:right;border:1px solid #E5E7EB;vertical-align:top">₹'+moneyNum(r.amount)+'</td><td style="padding:9px;text-align:right;border:1px solid #E5E7EB;color:#16A34A;vertical-align:top">₹'+moneyNum(r.paid)+'</td><td style="padding:9px;text-align:right;border:1px solid #E5E7EB;color:#DC2626;vertical-align:top">₹'+moneyNum(r.due)+'</td><td style="padding:9px;border:1px solid #E5E7EB;vertical-align:top">'+esc(r.paid>0?r.mode:"Due")+'</td><td class="report-attachments-col" style="padding:5px;border:1px solid #E5E7EB;vertical-align:top">'+(photos||"—")+'</td></tr>';
      }).join("")
      +'</tbody></table></div>';
  });
  if(!rows.length) html+='<div style="padding:40px;text-align:center;color:#6B7280">No day book entries found for this period.</div>';
  const totalDue=Math.max(0,total-paid);
  html+='<div style="display:flex;gap:14px;margin-top:20px"><div style="flex:1;background:#EDE9FE;padding:16px;border-radius:8px"><b>Total purchases</b><div style="font-size:24px;font-weight:900;color:#7C3AED">₹'+moneyNum(total)+'</div></div><div style="flex:1;background:#DCFCE7;padding:16px;border-radius:8px"><b>Total paid</b><div style="font-size:24px;font-weight:900;color:#16A34A">₹'+moneyNum(paid)+'</div></div><div style="flex:1;background:#FEE2E2;padding:16px;border-radius:8px"><b>Total due</b><div style="font-size:24px;font-weight:900;color:#DC2626">₹'+moneyNum(totalDue)+'</div></div></div>'
    +'<div style="margin-top:30px;padding-top:20px;border-top:1px solid #D1D5DB;text-align:center;font-size:10px;color:#6B7280">Bahikhata © 2026 | This is a computer-generated report.</div></div>';
  $("#printArea").innerHTML=html;
  openSheet('<div class="sheet-head"><h3>Day Book Report</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div><div class="sheet-body report-preview-body"><div class="report-preview-actions"><button class="big-save primary" id="printDaybook">Print / Save PDF</button></div>'+html+'</div>');
  $("#modalMount .sheet").classList.add("report-preview-sheet");
  $("#sClose").onclick=closeSheet;
  $("#printDaybook").onclick=()=>window.print();
  $$(".db-report-gallery", $("#modalMount")).forEach(gallery=>{
    let photos=[]; try{ photos=JSON.parse(gallery.dataset.photos||"[]"); }catch(e){ photos=[]; }
    const img=$("img",gallery), count=$(".db-gallery-count",gallery), download=$(".db-gallery-download",gallery);
    const update=index=>{
      if(!photos.length) return;
      const i=(index+photos.length)%photos.length;
      gallery.dataset.index=String(i);
      img.src=photos[i];
      count.textContent=(i+1)+" / "+photos.length;
      download.href=photos[i];
      download.download="attachment-"+(i+1)+".jpg";
    };
    $(".db-gallery-prev",gallery).onclick=()=>update(Number(gallery.dataset.index||0)-1);
    $(".db-gallery-next",gallery).onclick=()=>update(Number(gallery.dataset.index||0)+1);
    img.onclick=()=>openLightbox(photos,Number(gallery.dataset.index||0));
  });
}

/* --- Enhanced Excel export with modern formatting --- */
function exportExcelAdvanced(){
  // Create comprehensive data export
  const rows=[
    ["BAHIKHATA - SUPPLIER BOOK EXPORT"],
    ["Exported: "+new Date().toLocaleString("en-IN")],
    [],
    ["SUPPLIER SUMMARY"],
    ["Supplier Name","Phone","City","Bank Name","Account No.","IFSC","Opening Balance","Total Purchases","Total Payments","Current Balance","Balance Type"]
  ];
  
  db.parties.forEach(p=>{
    const b=partyBalance(p);
    const bk=p.bank||{name:"",account:"",ifsc:""};
    const balType = b.net>0.009?"Payable":b.net<-0.009?"Advance":"Settled";
    rows.push([
      p.name,
      p.phone||"",
      p.city||"",
      bk.name||"",
      bk.account||"",
      bk.ifsc||"",
      moneyNum(b.opening||0),
      moneyNum(b.gave),
      moneyNum(b.got),
      moneyNum(b.net),
      balType
    ]);
  });
  
  // Add summary
  rows.push([]);
  rows.push(["FINANCIAL SUMMARY"]);
  let totalGave=0, totalGot=0, totalNet=0, totalOpen=0;
  db.parties.forEach(p=>{
    const b=partyBalance(p);
    totalGave+=b.gave;
    totalGot+=b.got;
    totalNet+=b.net;
    totalOpen+=b.opening||0;
  });
  rows.push(["Total Opening Balance",moneyNum(totalOpen)]);
  rows.push(["Total Purchases",moneyNum(totalGave)]);
  rows.push(["Total Payments",moneyNum(totalGot)]);
  rows.push(["Total Outstanding",moneyNum(totalNet)]);
  
  const csv="\uFEFF"+rows.map(r=>r.map(v=>{v=String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  saveAs(blob, "Bahikhata-Suppliers-"+todayISO()+".csv");
  toast("✅ Excel exported successfully");
}

/* --- CSV Export for Google Sheets compatibility --- */
function exportCSV(){
  const rows=[["Supplier","Phone","City","Bank","Account","IFSC","Purchases ₹","Payments ₹","Balance ₹"]];
  db.parties.forEach(p=>{
    const b=partyBalance(p);
    const bk=p.bank||{name:"",account:"",ifsc:""};
    rows.push([p.name,p.phone||"",p.city||"",bk.name||"",bk.account||"",bk.ifsc||"",moneyNum(b.gave),moneyNum(b.got),moneyNum(b.net)]);
  });
  const csv="\uFEFF"+rows.map(r=>r.map(v=>{v=String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  saveAs(blob, "suppliers-"+todayISO()+".csv");
  toast("✅ CSV exported (Google Sheets compatible)");
}

/* --- Professional Dues List PDF --- */
function exportDuesListPDF(){
  const dues = dueSuppliers().filter(d=>d.net>0.009);
  if(dues.length===0){ toast("No outstanding dues"); return; }
  
  const rows = dues.map((d,i)=>{
    const ageDays = d.days>0 ? d.days+" days" : d.days===0 ? "Today" : (-d.days)+" days overdue";
    return '<tr><td>'+(i+1)+'</td><td><strong>'+esc(d.p.name)+'</strong></td><td>'+(d.p.phone?esc(d.p.phone):"")+'</td><td class="num">₹'+moneyNum(d.net)+'</td><td>'+ageDays+'</td><td>'+(d.p.bank?.account?esc(d.p.bank.account):"—")+'</td></tr>';
  }).join("");
  
  const totalDue = dues.reduce((s,d)=>s+d.net, 0);
  
  $("#printArea").innerHTML=
    '<div style="max-width:900px;margin:0 auto;font-family:system-ui,sans-serif;color:#1A1B1E">'
    // Header
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 0;border-bottom:3px solid #2563EB">'
    +'<div><div style="font-size:32px;font-weight:900;letter-spacing:-1px">Bahikhata</div><div style="font-size:12px;color:#6B7280;font-weight:600;margin-top:2px">Outstanding Dues Report</div></div>'
    +'<div style="text-align:right"><div style="font-size:11px;color:#6B7280">Generated: '+new Date().toLocaleString("en-IN")+'</div><div style="font-size:11px;color:#6B7280">Total Suppliers: '+dues.length+'</div></div>'
    +'</div>'
    // Summary Cards
    +'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin:20px 0">'
    +'<div style="background:#FEE2E2;border:1px solid #FCA5A5;border-radius:8px;padding:16px"><div style="font-size:12px;font-weight:700;color:#7F1D1D;text-transform:uppercase">Total Dues</div><div style="font-size:28px;font-weight:900;color:#DC2626;margin-top:4px">₹'+moneyNum(totalDue)+'</div></div>'
    +'<div style="background:#E0F2FE;border:1px solid #BAE6FD;border-radius:8px;padding:16px"><div style="font-size:12px;font-weight:700;color:#075985;text-transform:uppercase">Suppliers</div><div style="font-size:28px;font-weight:900;color:#0369A1;margin-top:4px">'+dues.length+'</div></div>'
    +'</div>'
    // Table
    +'<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:12px">'
    +'<thead><tr style="background:#F3F4F6;border-bottom:2px solid #D1D5DB">'
    +'<th style="padding:10px;text-align:left;font-weight:700">#</th>'
    +'<th style="padding:10px;text-align:left;font-weight:700">Supplier</th>'
    +'<th style="padding:10px;text-align:left;font-weight:700">Mobile</th>'
    +'<th style="padding:10px;text-align:right;font-weight:700">Amount Due</th>'
    +'<th style="padding:10px;text-align:left;font-weight:700">Status</th>'
    +'<th style="padding:10px;text-align:left;font-weight:700">Bank A/C</th>'
    +'</tr></thead>'
    +'<tbody>'+rows+'</tbody>'
    +'</table>'
    // Footer
    +'<div style="margin-top:30px;padding-top:20px;border-top:1px solid #E5E7EB;text-align:center;font-size:11px;color:#6B7280">'
    +'<p>This is a computer-generated report. For official records, maintain supporting documents.</p>'
    +'<p style="margin-top:8px">Bahikhata © 2026</p>'
    +'</div>'
    +'</div>';
  
  window.print();
}

/* --- Professional full Excel with bank details --- */
function exportExcel(){
  const rows=[["Supplier","Phone","City","Bank","Account No.","IFSC","Purchases (Dr)","Payments (Cr)","Balance"]];
  db.parties.forEach(p=>{
    const b=partyBalance(p);
    const bk=p.bank||{name:"",account:"",ifsc:""};
    rows.push([p.name,p.phone||"",p.city||"",bk.name||"",bk.account||"",bk.ifsc||"",moneyNum(b.gave),moneyNum(b.got),moneyNum(b.net)]);
  });
  const csv="\uFEFF"+rows.map(r=>r.map(v=>{v=String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  saveAs(blob, "supplier-book.csv");
  toast("Exported Excel (CSV)");
}

function saveAs(blob, name){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),800);
}

/* --- summary PDF report (dues / balance + bank, one row per supplier) --- */
function printAllPDF(from="", to=""){
  const reportBalance=p=>{
    let gave=Number(p.opening)||0, got=0;
    (p.history||[]).forEach(e=>{
      if(!dateInRange(e.date||e.ts,from,to)) return;
      if(e.type==="gave") gave+=Number(e.amount)||0;
      else got+=Number(e.amount)||0;
    });
    return { gave, got, opening:Number(p.opening)||0, net:gave-got };
  };
  let totalGave=0, totalGot=0, totalNet=0;
  db.parties.forEach(p=>{ const b=reportBalance(p); totalGave+=b.gave; totalGot+=b.got; totalNet+=b.net; });
  
  let html='<div style="max-width:1000px;margin:0 auto;font-family:system-ui,sans-serif;color:#1A1B1E">'
    // Header
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 0;border-bottom:3px solid #2563EB;margin-bottom:20px">'
    +'<div style="display:flex;align-items:center;gap:12px">'
    +'<div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#E84C3D,#F07556);color:#fff;font-weight:900;font-size:28px;display:flex;align-items:center;justify-content:center">₹</div>'
    +'<div><div style="font-size:28px;font-weight:900;letter-spacing:-0.5px">Bahikhata</div><div style="font-size:12px;color:#6B7280;font-weight:600">Supplier Book</div></div>'
    +'</div>'
    +'<div style="text-align:right"><div style="font-size:12px;color:#6B7280">Generated: '+new Date().toLocaleString("en-IN")+'</div><div style="font-size:12px;color:#6B7280">Total: '+db.parties.length+' suppliers</div></div>'
    +'</div>'
    
    // Title
    +'<div style="margin-bottom:6px"><div style="font-size:20px;font-weight:900;letter-spacing:-0.4px">Supplier Summary Report</div><div style="font-size:12px;color:#6B7280;font-weight:500">Dues & Balances Overview</div></div>'
    
    // Summary Cards
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:20px 0">'
    +'<div style="background:linear-gradient(135deg,#DC2626,#F87171);color:#fff;border-radius:8px;padding:16px">'
    +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2px;opacity:0.9">Total Purchases</div>'
    +'<div style="font-size:26px;font-weight:900;margin-top:6px;letter-spacing:-0.4px">₹'+moneyNum(totalGave)+'</div>'
    +'</div>'
    +'<div style="background:linear-gradient(135deg,#16A34A,#4ADE80);color:#fff;border-radius:8px;padding:16px">'
    +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2px;opacity:0.9">Total Payments</div>'
    +'<div style="font-size:26px;font-weight:900;margin-top:6px;letter-spacing:-0.4px">₹'+moneyNum(totalGot)+'</div>'
    +'</div>'
    +'<div style="background:linear-gradient(135deg,#2563EB,#60A5FA);color:#fff;border-radius:8px;padding:16px">'
    +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2px;opacity:0.9">Net Outstanding</div>'
    +'<div style="font-size:26px;font-weight:900;margin-top:6px;letter-spacing:-0.4px">₹'+moneyNum(totalNet)+'</div>'
    +'</div>'
    +'</div>'
    
    // Table
    +'<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:11px">'
    +'<thead><tr style="background:#F3F4F6;border-bottom:2px solid #D1D5DB">'
    +'<th style="padding:10px;text-align:left;font-weight:700;border:1px solid #D1D5DB">#</th>'
    +'<th style="padding:10px;text-align:left;font-weight:700;border:1px solid #D1D5DB">Supplier Name</th>'
    +'<th style="padding:10px;text-align:left;font-weight:700;border:1px solid #D1D5DB">Contact</th>'
    +'<th style="padding:10px;text-align:left;font-weight:700;border:1px solid #D1D5DB">Bank Details</th>'
    +'<th style="padding:10px;text-align:right;font-weight:700;border:1px solid #D1D5DB">Purchases ₹</th>'
    +'<th style="padding:10px;text-align:right;font-weight:700;border:1px solid #D1D5DB">Payments ₹</th>'
    +'<th style="padding:10px;text-align:right;font-weight:700;border:1px solid #D1D5DB">Balance</th>'
    +'</tr></thead><tbody>';
  
  db.parties.forEach((p,idx)=>{
    const b=reportBalance(p);
    const bk=p.bank||{name:"",account:"",ifsc:""};
    const bankCell = (bk.name||bk.account||bk.ifsc)
      ? esc((bk.name?bk.name:" ")+(bk.account?" A/C "+bk.account:" ")+(bk.ifsc?" · IFSC "+bk.ifsc:""))
      : "—";
    
    let netText, netBg;
    if(b.net>0.009){
      netText = '🔴 Due ₹'+moneyNum(b.net);
      netBg = '#FEE2E2';
    } else if(b.net<-0.009){
      netText = '🔵 Advance ₹'+moneyNum(-b.net);
      netBg = '#DDD6FE';
    } else {
      netText = '✅ Settled';
      netBg = '#DCFCE7';
    }
    
    html += '<tr style="border-bottom:1px solid #E5E7EB;'+(idx%2===0?'background:#F9FAFB':'background:#FFFFFF')+'">'
      +'<td style="padding:10px;border:1px solid #E5E7EB;font-weight:700">'+ (idx+1) +'</td>'
      +'<td style="padding:10px;border:1px solid #E5E7EB;font-weight:700">'+esc(p.name)+'</td>'
      +'<td style="padding:10px;border:1px solid #E5E7EB;font-size:10px;color:#6B7280">'+esc(p.phone||"")+(p.city?" | "+esc(p.city):"")+'</td>'
      +'<td style="padding:10px;border:1px solid #E5E7EB;font-size:10px;color:#6B7280">'+bankCell+'</td>'
      +'<td style="padding:10px;border:1px solid #E5E7EB;text-align:right;font-weight:600">₹'+moneyNum(b.gave)+'</td>'
      +'<td style="padding:10px;border:1px solid #E5E7EB;text-align:right;font-weight:600">₹'+moneyNum(b.got)+'</td>'
      +'<td style="padding:10px;border:1px solid #E5E7EB;text-align:right;font-weight:700;background:'+netBg+'">'+netText+'</td>'
      +'</tr>';
  });
  
  html += '</tbody></table>'
    // Footer
    +'<div style="margin-top:30px;padding-top:20px;border-top:1px solid #D1D5DB;text-align:center;font-size:10px;color:#6B7280">'
    +'<p>This is a computer-generated report. For official records, maintain supporting documents.</p>'
    +'<p style="margin-top:8px">Bahikhata © 2026 | www.bahikhata.app</p>'
    +'</div>'
    +'</div>';
  
  $("#printArea").innerHTML=html;
  window.print();
}

/* --- date-range report (payments or purchases) with filter chips --- */
function openReportDatePicker(type){
  const isPay = (type==="got");
  const color = isPay ? "var(--green)" : "var(--red)";
  const label = isPay ? "Payment" : "Purchase";
  let sel = "this-month";
  let customFrom = "", customTo = "";
  const opts=[["all","All time"],["this-month","This month"],["last-month","Last month"],["custom","Custom"]];
  const y=new Date().getFullYear(), m=new Date().getMonth();
  const pad=n=>String(n).padStart(2,"0");
  const tmFrom=y+"-"+pad(m+1)+"-01", tmTo=y+"-"+pad(m+1)+"-"+pad(new Date(y,m+1,0).getDate());
  const lmFrom=y+"-"+pad(m)+"-01", lmTo=y+"-"+pad(m)+"-"+pad(new Date(y,m,0).getDate());
  const today=y+"-"+pad(m+1)+"-"+pad(new Date().getDate());
  openSheet(
    '<div class="sheet-head"><h3 style="color:'+color+'">'+label+' report</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body">'
    +'<div class="field"><label>Date filter</label>'
    +'<div class="date-filter" id="rChips">'
    + opts.map(o=>'<button type="button" class="df-chip'+(sel===o[0]?" active":"")+'" data-f="'+o[0]+'">'+o[1]+'</button>').join('')
    +'</div></div>'
    +'<div class="df-custom" id="rCustom">'
    +'<input id="rFrom" type="date" value="'+tmFrom+'"><span>to</span><input id="rTo" type="date" value="'+tmTo+'">'
    +'</div>'
    +'<button class="big-save '+(isPay?"green":"danger")+'" id="rGo">Generate PDF</button>'
    +'</div>'
  );
  $("#sClose").onclick=closeSheet;
  $$("#rChips .df-chip").forEach(c=>c.onclick=()=>{
    sel=c.dataset.f;
    $$("#rChips .df-chip").forEach(x=>x.classList.remove("active"));
    c.classList.add("active");
    const from=$("#rFrom"), to=$("#rTo");
    if(sel==="all"){ from.value=""; to.value=""; }
    if(sel==="this-month"){ from.value=tmFrom; to.value=tmTo; }
    if(sel==="last-month"){ from.value=lmFrom; to.value=lmTo; }
  });
  $("#rGo").onclick=()=>{
    const from=$("#rFrom").value;
    const to=$("#rTo").value;
    if(from && to && from>to){ toast("From date cannot be after To date"); return; }
    closeSheet();
    printTypeReport(type, from, to);
  };
}

function printTypeReport(type, from, to){
  const isPay = (type==="got");
  const label = isPay ? "Payment" : "Purchase";
  const bgColor = isPay ? "#16A34A" : "#DC2626";
  const accentColor = isPay ? "#4ADE80" : "#F87171";
  const periodText = (!from && !to) ? "All time" : (from?fmtDate(from):"…")+' → '+(to?fmtDate(to):"today");
  
  let grandTotal=0, count=0;
  
  let html='<div style="max-width:1000px;margin:0 auto;font-family:system-ui,sans-serif;color:#1A1B1E">'
    // Header
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 0;border-bottom:3px solid '+bgColor+';margin-bottom:20px">'
    +'<div><div style="font-size:28px;font-weight:900;letter-spacing:-0.5px">'+label+' Report</div><div style="font-size:12px;color:#6B7280;font-weight:500">Detailed transaction breakdown</div></div>'
    +'<div style="text-align:right"><div style="font-size:12px;color:#6B7280">📅 '+periodText+'</div><div style="font-size:12px;color:#6B7280">'+new Date().toLocaleDateString("en-IN")+'</div></div>'
    +'</div>';
  
  db.parties.forEach(p=>{
    const entries=(p.history||[]).slice()
      .filter(e=> e.type===type && dateInRange(e.date||e.ts, from, to))
      .sort((a,b)=>(a.ts||a.date||"").localeCompare(b.ts||b.date||""));
    if(!entries.length) return;
    
    let sub=0;
    const rows=entries.map(e=>{ 
      sub+=Number(e.amount)||0; 
      count++; 
      grandTotal+=Number(e.amount)||0;
      return '<tr style="border-bottom:1px solid #E5E7EB">'
        +'<td style="padding:10px;border:1px solid #E5E7EB;font-size:11px">'+fmtDate(e.date)+'</td>'
        +'<td style="padding:10px;border:1px solid #E5E7EB;font-size:11px">'+(e.billNo?esc(e.billNo):e.note?esc(e.note):"—")+'</td>'
        +'<td style="padding:10px;border:1px solid #E5E7EB;font-size:11px">'+(isPay?(e.mode?esc(e.mode):"—"):"Bill")+'</td>'
        +'<td style="padding:10px;border:1px solid #E5E7EB;text-align:right;font-weight:600;font-size:11px">₹'+moneyNum(e.amount)+'</td>'
        +'</tr>'; 
    }).join("");
    
    html += '<div style="margin-bottom:24px;background:#F9FAFB;border-radius:8px;overflow:hidden;border:1px solid #E5E7EB">'
      +'<div style="background:linear-gradient(135deg,'+bgColor+','+accentColor+');color:#fff;padding:14px 16px">'
      +'<div style="font-weight:900;font-size:14px;letter-spacing:-0.2px">'+esc(p.name)+'</div>'
      +(p.phone?'<div style="font-size:11px;opacity:0.9">'+esc(p.phone)+'</div>':'')
      +'</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:11px">'
      +'<thead><tr style="background:#F3F4F6;border-bottom:2px solid #D1D5DB">'
      +'<th style="padding:10px;text-align:left;font-weight:700;border:1px solid #D1D5DB">Date</th>'
      +'<th style="padding:10px;text-align:left;font-weight:700;border:1px solid #D1D5DB">Reference / Note</th>'
      +'<th style="padding:10px;text-align:left;font-weight:700;border:1px solid #D1D5DB">'+(isPay?"Mode":"Bill")+'</th>'
      +'<th style="padding:10px;text-align:right;font-weight:700;border:1px solid #D1D5DB">Amount ₹</th>'
      +'</tr></thead><tbody>'
      + rows
      +'</tbody><tfoot><tr style="background:#F3F4F6;border-top:2px solid #D1D5DB">'
      +'<td colspan="3" style="padding:10px;border:1px solid #D1D5DB;font-weight:700;text-align:right">Subtotal:</td>'
      +'<td style="padding:10px;border:1px solid #D1D5DB;text-align:right;font-weight:700;background:'+accentColor+';color:#fff">₹'+moneyNum(sub)+'</td>'
      +'</tr></tfoot></table></div>';
  });
  
  // Grand Total Card
  html += '<div style="background:linear-gradient(135deg,'+bgColor+','+accentColor+');color:#fff;border-radius:8px;padding:20px;margin-top:20px;text-align:center">'
    +'<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.2px;opacity:0.95">Grand Total</div>'
    +'<div style="font-size:32px;font-weight:900;margin:8px 0;letter-spacing:-0.5px">₹'+moneyNum(grandTotal)+'</div>'
    +'<div style="font-size:11px;opacity:0.9">'+count+' transaction'+(count===1?"":"s")+' processed</div>'
    +'</div>'
    
    // Footer
    +'<div style="margin-top:30px;padding-top:20px;border-top:1px solid #D1D5DB;text-align:center;font-size:10px;color:#6B7280">'
    +'<p>This is a computer-generated report. For official records, maintain supporting documents.</p>'
    +'<p style="margin-top:8px">Bahikhata © 2026 | www.bahikhata.app</p>'
    +'</div>'
    +'</div>';
  
  $("#printArea").innerHTML=html;
  window.print();
}

/* ============================================================
   SETTINGS (backup / restore)
   ============================================================ */
function currentTheme(){ return document.documentElement.getAttribute("data-theme")==="dark" ? "dark" : "light"; }
function applyTheme(t){
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.style.colorScheme = t;
  const mt=document.getElementById("metaTheme");
  if(mt) mt.setAttribute("content", t==="dark" ? "#0F1013" : "#F4F5F7");
  try{ localStorage.setItem("bahikhata.theme", t); }catch(e){}
}

/* ============================================================
   REMINDERS (notification bell)
   ============================================================ */
function dueSuppliers(){
  const now=new Date();
  const out=[];
  db.parties.forEach(p=>{
    const b=partyBalance(p);
    if(b.net<=0.009) return; // nothing due
    // find the oldest entry and the most recent purchase (gave)
    let oldest=null, lastGave=null;
    (p.history||[]).forEach(h=>{ const d=h.date||h.ts; if(!d) return;
      if(!oldest || d<oldest) oldest=d;
      if(h.type==="gave" && (!lastGave || d>lastGave)) lastGave=d;
    });
    const dueDays = Number(p.dueDays)||0;
    let days, dueDate=null;
    if(dueDays>0 && lastGave){
      // due date = last purchase date + dueDays; days = how soon (negative = overdue)
      const lastD = new Date(lastGave.slice(0,10)+"T00:00:00");
      dueDate = new Date(lastD.getTime() + dueDays*86400000);
      days = Math.ceil((dueDate - now)/86400000); // >0 = due in X days, <=0 = overdue
    } else {
      dueDate = oldest ? new Date(oldest.slice(0,10)+"T00:00:00") : null;
      days = oldest ? Math.floor((now - dueDate)/86400000) : 0; // aging (always overdue-ish)
    }
    out.push({ p, net:b.net, oldest, lastGave, dueDate, days, dueDays });
  });
  // apply notification threshold: only notify when due within N days (or already overdue)
  const nd=getNotifyDays();
  const filtered = (nd===null) ? out : out.filter(it=>it.days<=nd);
  // sort: most overdue first, then soonest due
  filtered.sort((a,b)=>(a.days-b.days));
  return filtered;
}
function updateBellDot(){
  const dot=$("#bellDot"); if(!dot) return;
  const dues=dueSuppliers();
  dot.classList.toggle("hidden", dues.length===0);
  dot.textContent = dues.length>9 ? "9+" : String(dues.length);
}
function ageTag(item){
  const dueDays=item.dueDays||0;
  const days=item.days;
  if(dueDays>0){
    if(days>0){ return "Due in "+days+" day"+(days===1?"":"s"); }
    if(days===0){ return "Due today"; }
    const over=-days;
    return "Overdue "+over+" day"+(over===1?"":"s");
  }
  // no cycle: aging by oldest entry
  if(days<0) return "New";
  if(days===0) return "Due today";
  if(days===1) return "1 day";
  if(days<30) return days+" days";
  if(days<60) return Math.floor(days/30)+" mo";
  return Math.floor(days/30)+" mo+";
}
function ageCls(item){
  const dueDays=item.dueDays||0;
  const days=item.days;
  if(dueDays>0){
    if(days>3){ return "soon"; }      // due in >3 days
    if(days>=0){ return "due-soon"; } // due within 3 days
    return "overdue";                  // overdue
  }
  // no cycle: everything positive net is effectively overdue
  return days>=30 ? "overdue" : days>=7 ? "due-soon" : "soon";
}
function openReminders(){
  const dues=dueSuppliers();
  const items = dues.length
    ? dues.map(d=>{
        const cls=ageCls(d);
        const dueLine = (d.dueDays>0 && d.dueDate)
          ? '<div class="party-sub">Due '+fmtDate(d.dueDate.toISOString().slice(0,10))+'</div>'
          : '<div class="party-sub">'+esc(d.p.phone||"")+'</div>';
        return '<button class="party" data-open="'+esc(d.p.id)+'">'
        +'<div class="party-av" style="background:'+esc(d.p.color||paletteFor(d.p.id))+'">'+esc(initials(d.p.name))+'</div>'
        +'<div class="party-main"><div class="party-name">'+esc(d.p.name)+'</div>'
        + dueLine +'</div>'
        +'<div class="party-right"><div class="party-bal you-get" data-countup-value="'+d.net+'">'+fmtMoney(0)+'</div>'
        +'<div class="party-tag '+cls+'">'+ageTag(d)+'</div></div></button>';
      }).join('')
    : '<div class="empty"><div class="big">🎉</div><p>All clear</p><small>Nothing due to suppliers right now</small></div>';

  openSheet(
    '<div class="sheet-head"><h3>🔔 Reminders</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body">'
    +'<div class="reminder-note">You owe these suppliers. Tap one to open their ledger, or tap ⚙ to send a payment note.</div>'
    +(dues.length?'<div class="reminder-list">'+items+'</div>':items)
    +'</div>'
  );
  $("#sClose").onclick=closeSheet;
  $$("#modalMount .party").forEach(b=>b.onclick=()=>{ const id=b.dataset.open; closeSheet(); openKhata(id); });
  animateAmounts($("#modalMount"), 100);
}

function openSettings(){
  const theme = currentTheme();
  openSheet(
    '<div class="sheet-head"><h3>Settings</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body" style="display:flex;flex-direction:column;gap:9px">'
    +'<button class="row-btn" id="setAdd"><svg viewBox="0 0 24 24" style="color:var(--blue)"><use href="#i-plus"/></svg>Add supplier</button>'
    +'<div class="settings-note">Back up your data to a file, or restore from a previous backup. Data is stored only in this browser.</div>'
    +'<div class="set-row"><span class="set-label">🌙 Dark mode</span><button class="switch" id="setDark" role="switch" aria-checked="'+(theme==="dark")+'"><span class="knob"></span></button></div>'
    +'<div class="set-row"><span class="set-label">🔔 Remind me when due within</span>'
    +'<select class="set-select" id="setNotify">'
    + notifyOption(null, "Always", getNotifyDays())
    + notifyOption(0, "Overdue only", getNotifyDays())
    + notifyOption(3, "3 days", getNotifyDays())
    + notifyOption(7, "7 days", getNotifyDays())
    + notifyOption(15, "15 days", getNotifyDays())
    + notifyOption(30, "30 days", getNotifyDays())
    +'</select></div>'
    +'<div class="set-row"><span class="set-label">🔐 Security</span>'
    +(hasAuth()
      ?'<button class="mini-btn" id="setSec">Change</button>'
      :'<button class="mini-btn" id="setSec">Set login</button>')
    +'</div>'
    +'<button class="row-btn" id="setBackup"><svg viewBox="0 0 24 24" style="color:var(--blue)"><use href="#i-download"/></svg>Back up data now</button>'
    +'<button class="row-btn" id="setRestore"><svg viewBox="0 0 24 24" style="color:var(--green)"><use href="#i-upload"/></svg>Restore from backup</button>'
    +'<button class="row-btn" id="setAudit"><svg viewBox="0 0 24 24" style="color:var(--sub)"><use href="#i-dots"/></svg>Audit log</button>'
    +'<button class="row-btn" id="setGroups"><svg viewBox="0 0 24 24" style="color:var(--blue)"><use href="#i-plus"/></svg>Manage groups</button>'
    +(hasAuth()?'<button class="row-btn" id="setLogout" style="color:var(--sub)"><svg viewBox="0 0 24 24" style="color:var(--sub)"><use href="#i-lock"/></svg>Log out</button>':'')
    +'<button class="row-btn" id="setReset" style="color:var(--red)"><svg viewBox="0 0 24 24" style="color:var(--red)"><use href="#i-x"/></svg>Clear all data</button>'
    +'</div>'
  );
  $("#sClose").onclick=closeSheet;
  $("#setAdd").onclick=()=>{ closeSheet(); openPartySheet(); };
  const sw=$("#setDark");
  if(sw){
    if(theme==="dark") sw.classList.add("on");
    sw.onclick=()=>{
      const on = sw.classList.toggle("on");
      applyTheme(on?"dark":"light");
      sw.setAttribute("aria-checked", on);
    };
  }
  const setNotify=$("#setNotify");
  if(setNotify){
    setNotify.onchange=()=>{
      const v=setNotify.value;
      if(v===""){ setNotifyDays(null); } else { setNotifyDays(parseInt(v,10)||0); }
      updateBellDot();
      toast("Reminder setting saved");
    };
  }
  $("#setBackup").onclick=backupData;
  $("#setRestore").onclick=()=>{ closeSheet(); $("#restoreInput").click(); };
  $("#setAudit").onclick=()=>{ closeSheet(); openAuditViewer(); };
  $("#setGroups").onclick=()=>{ closeSheet(); openGroupManager(); };
  const secBtn=$("#setSec");
  if(secBtn) secBtn.onclick=()=>{ closeSheet(); openSecuritySheet(); };
  const logoutBtn=$("#setLogout");
  if(logoutBtn) logoutBtn.onclick=()=>{ closeSheet(); doLogout(); };
  $("#setReset").onclick=()=>{
    closeSheet();
    if(confirm("Delete ALL suppliers and entries? This cannot be undone.")){
      db={parties:[]}; saveDB(); renderHome(); toast("All data cleared");
    }
  };
}

/* ============================================================
   SECURITY SHEET (set / change login)
   ============================================================ */
function openSecuritySheet(){
  const a=getAuth();
  const existingUser = a ? a.user : "";
  openSheet(
    '<div class="sheet-head"><h3>🔐 '+(a?"Change login":"Set up login")+'</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body">'
    +(a?'<div class="field"><label>Current password <span class="req">*</span></label><input id="secCur" type="password" autocomplete="current-password" placeholder="Enter current password"></div>':'')
    +'<div class="field"><label>User ID <span class="req">*</span></label><input id="secUser" type="text" autocomplete="username" placeholder="Choose a user ID" value="'+esc(existingUser)+'"></div>'
    +'<div class="field"><label>'+(a?'New password':'Password')+' <span class="req">*</span></label><input id="secPass" type="password" autocomplete="new-password" placeholder="Minimum 4 characters"></div>'
    +'<div class="field"><label>Confirm password <span class="req">*</span></label><input id="secPass2" type="password" autocomplete="new-password" placeholder="Re-enter password"></div>'
    +'<button class="big-save primary" id="secSave">'+(a?'Update login':'Create login')+'</button>'
    +(a?'<button class="big-save danger" id="secRemove" style="margin-top:10px;background:var(--card);color:var(--red);border:1px solid var(--red)">Remove login (disable security)</button>':'')
    +'</div>'
  );
  $("#sClose").onclick=closeSheet;
  $("#secSave").onclick=()=>{
    const user=$("#secUser").value.trim();
    const pass=$("#secPass").value; const pass2=$("#secPass2").value;
    if(!user){ toast("Enter a user ID"); return; }
    if(pass.length<4){ toast("Password must be at least 4 characters"); return; }
    if(pass!==pass2){ toast("Passwords don't match"); return; }
    if(a){
      if(!verifyAuth(a.user, $("#secCur").value)){ toast("Current password is wrong"); return; }
    }
    const salt=saltStr();
    saveAuth({ user, salt, passHash:computeHash(salt, user, pass) });
    setRemembered(false);
    setSessionActive(true);
    closeSheet();
    toast(a?"Login updated":"Login created");
  };
  const rm=$("#secRemove");
  if(rm) rm.onclick=()=>{
    if(!a) return;
    if(!verifyAuth(a.user, $("#secCur").value)){ toast("Enter your current password to remove login"); return; }
    if(confirm("Remove login security? Your ledger data will NOT be deleted.")){
      try{ localStorage.removeItem(AUTH_KEY); }catch(e){}
      setRemembered(false); setSessionActive(true);
      closeSheet(); toast("Login removed");
    }
  };
}

function doLogout(){
  setRemembered(false); setSessionActive(false);
  closeKhata();
  showLogin("Signed out — sign in to continue");
  toast("Logged out");
}

function backupData(){
  const payload = { app:"supplier-book", version:1, exportedAt:nowStamp(), data: db };
  const blob=new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  saveAs(blob, "supplier-book-backup-"+todayISO()+".json");
  toast("Backup downloaded");
}

function handleRestore(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      const imported = parsed && (parsed.data || parsed);
      if(imported && Array.isArray(imported.parties)){
        if(!confirm("Restore will REPLACE current data with the backup. Continue?")) return;
        db = { parties: imported.parties };
        saveDB(); renderHome();
        toast("Backup restored — "+db.parties.length+" suppliers");
      } else {
        toast("Invalid backup file");
      }
    }catch(e){ toast("Could not read backup file"); }
  };
  reader.readAsText(file);
}

/* ============================================================
   AUTH (User ID + Password)
   ============================================================ */
const AUTH_KEY = "bahikhata.auth"; // { user, passHash, salt }
const SESSION_KEY = "bahikhata.session"; // "remembered" or sessionStorage for current
function hashStr(s){ let h=0x811c9dc5; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193); } return ""+(h>>>0).toString(16); }
function saltStr(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36); }
function getAuth(){ try{ const r=localStorage.getItem(AUTH_KEY); return r?JSON.parse(r):null; }catch(e){ return null; } }
function saveAuth(a){ try{ localStorage.setItem(AUTH_KEY, JSON.stringify(a)); }catch(e){} }
function hasAuth(){ return !!getAuth(); }
function computeHash(salt, user, pass){ return hashStr(salt+"::"+user.toLowerCase()+"::"+pass); }
function verifyAuth(user, pass){
  const a=getAuth(); if(!a) return false;
  return a.user.toLowerCase()===String(user).toLowerCase() && a.passHash===computeHash(a.salt, user, pass);
}
function isRemembered(){
  try{ return localStorage.getItem(SESSION_KEY)==="1"; }catch(e){ return false; }
}
function setRemembered(on){ try{ if(on) localStorage.setItem(SESSION_KEY,"1"); else localStorage.removeItem(SESSION_KEY); }catch(e){} }
function isSessionActive(){
  try{ const s=sessionStorage.getItem(SESSION_KEY); return s==="1"; }catch(e){ return false; }
}
function setSessionActive(on){ try{ if(on) sessionStorage.setItem(SESSION_KEY,"1"); else sessionStorage.removeItem(SESSION_KEY); }catch(e){} }
function isLoggedIn(){ return isSessionActive() || isRemembered(); }

function showLogin(msg){
  const el=$("#lockScreen"); if(!el) return;
  $("#loginErr").classList.add("hidden");
  $("#loginPass").value="";
  if(msg) $("#lockSub").textContent=msg;
  el.classList.remove("hidden");
  setTimeout(()=>{ const u=$("#loginUser"); if(u) u.focus(); }, 50);
}
function hideLogin(){ $("#lockScreen").classList.add("hidden"); }

function initLogin(){
  const btn=$("#loginBtn"), user=$("#loginUser"), pass=$("#loginPass"), rem=$("#loginRemember"), err=$("#loginErr");
  const tryLogin=()=>{
    const u=user.value.trim(), p=pass.value;
    if(!u||!p){ showErr("Enter user ID and password"); return; }
    if(!hasAuth()){ showErr("No account set up yet — go to Settings → Security to create your login."); return; }
    if(verifyAuth(u,p)){
      setRemembered(rem && rem.checked);
      setSessionActive(true);
      hideLogin();
      toast("Welcome back");
    } else {
      showErr("Invalid user ID or password");
      pass.value=""; pass.focus();
    }
  };
  function showErr(m){ err.textContent=m; err.classList.remove("hidden"); }
  btn.onclick=tryLogin;
  [user,pass].forEach(el=>el.addEventListener("keydown",e=>{ if(e.key==="Enter")tryLogin(); }));
  $("#loginForgot").onclick=()=>{
    if(confirm("Forgot password?\n\nFor security, the password can't be recovered. You can RESET access (this will clear your login credentials, but NOT your ledger data).\n\nAfter resetting, you'll need to set a new user ID & password in Settings → Security.\n\nContinue?")){
      try{ localStorage.removeItem(AUTH_KEY); }catch(e){}
      setRemembered(false); setSessionActive(false);
      toast("Login cleared — set a new password in Settings");
      showLogin("Set a new password in Settings → Security");
    }
  };
}

function authGuard(reason){
  // If no auth is set up, allow (nothing to protect yet). If auth exists and not logged in, force login.
  if(!hasAuth()) return true;
  if(isLoggedIn()) return true;
  showLogin(reason||"Sign in to continue");
  return false;
}
function verifyPasswordSheet(action, onSuccess){
  // Lightweight in-sheet password prompt (used for editing/deleting entries)
  if(!hasAuth()){ onSuccess(); return; } // no security set → allow
  const a=getAuth();
  openSheet(
    '<div class="sheet-head"><h3>🔒 Verify password</h3><button class="sheet-close" id="sClose"><svg viewBox="0 0 24 24"><use href="#i-x"/></svg></button></div>'
    +'<div class="sheet-body">'
    +'<div class="verify-note">'+esc(action)+'</div>'
    +'<div class="field"><label>Password</label><input id="vpPass" type="password" autocomplete="current-password" placeholder="Enter your password"></div>'
    +'<div class="big-save primary" id="vpGo">Confirm</div>'
    +'</div>'
  );
  $("#sClose").onclick=closeSheet;
  const pass=$("#vpPass");
  setTimeout(()=>pass.focus(),60);
  const doVerify=()=>{
    if(verifyAuth(a.user, pass.value)){ closeSheet(); onSuccess(); }
    else { toast("Wrong password"); pass.value=""; pass.focus(); }
  };
  $("#vpGo").onclick=doVerify;
  pass.addEventListener("keydown",e=>{ if(e.key==="Enter")doVerify(); });
}

/* ============================================================
   EVENTS
   ============================================================ */
function bind(){
  $("#addBtn").onclick=openDaybookSheet;
  $("#searchBtn").onclick=()=>{ $("#searchRow").classList.toggle("hidden"); if(!$("#searchRow").classList.contains("hidden")){ $("#partySearch").focus(); const c=$("#searchClear"); if(c)c.classList.toggle("hidden", !$("#partySearch").value); } };
  $("#downloadBtn").onclick=openDownloadMenu;
  $("#settingsBtn").onclick=openSettings;
  $("#bellBtn").onclick=openReminders;
  $("#restoreInput").onchange=e=>{ const f=e.target.files[0]; handleRestore(f); e.target.value=""; };
  $("#partySearch").oninput=e=>{ renderHome(); const c=$("#searchClear"); if(c)c.classList.toggle("hidden", !e.target.value); };
  const searchClear=$("#searchClear");
  if(searchClear) searchClear.onclick=()=>{
    const inp=$("#partySearch");
    inp.value="";
    inp.focus();
    searchClear.classList.add("hidden");
    renderHome();
  };
  $("#backBtn").onclick=closeKhata;
  $("#gaveBtn").onclick=()=>openEntry("gave");
  $("#gotBtn").onclick=()=>openEntry("got");
  $("#khataCall").onclick=()=>{ if(currentParty&&currentParty.phone)window.location.href="tel:"+currentParty.phone; };
  $("#khataMenu").onclick=openPartyMenu;
  $("#overlay").onclick=e=>{ if(e.target.id==="overlay")closeSheet(); };
  // collapse search when clicking outside the search box / button
  document.addEventListener("click",e=>{
    const row=$("#searchRow"); if(!row || row.classList.contains("hidden")) return;
    const inp=$("#partySearch"); const btn=$("#searchBtn"); const clearBtn=$("#searchClear");
    if((inp && inp.contains(e.target)) || (btn && btn.contains(e.target)) || (clearBtn && clearBtn.contains(e.target))) return;
    row.classList.add("hidden");
  });
  document.addEventListener("keydown",e=>{
    if($("#lightbox").classList.contains("open")){
      if(e.key==="Escape") closeLightbox();
      else if(e.key==="ArrowLeft" && lbPhotos.length>1){ lbIndex=(lbIndex+lbPhotos.length-1)%lbPhotos.length; updateLightbox(); }
      else if(e.key==="ArrowRight" && lbPhotos.length>1){ lbIndex=(lbIndex+1)%lbPhotos.length; updateLightbox(); }
      return;
    }
    if(e.key==="Escape")closeSheet();
  });
}

function init(){
  let savedTheme="light";
  try{ savedTheme=localStorage.getItem("bahikhata.theme")||"light"; }catch(e){}
  applyTheme(savedTheme);
  loadDB();
  initLogin();
  bind();
  renderHome();
  if(hasAuth() && !isLoggedIn()){ showLogin(); }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();
