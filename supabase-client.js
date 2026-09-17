/* Hisab Khata — Supabase Auth / multi-tenant database / storage helpers. */
window.BAHIKHATA_SUPABASE = window.BAHIKHATA_SUPABASE || {
  url: "https://jjryefzywugocusmsqvq.supabase.co",
  key: "sb_publishable_DE5g_J3pNmd12QSoYIOl3g_tHnsSlJO"
};

let sbClient = null;
let sbChannel = null;
let pushQueue = Promise.resolve();

function getSupabaseConfig(){
  return {
    url:String(window.BAHIKHATA_SUPABASE.url||"").trim(),
    key:String(window.BAHIKHATA_SUPABASE.key||"").trim()
  };
}

// Auth persistence only (business/ledger data is NEVER stored in browser storage).
// "Remember me" uses IndexedDB for the Supabase auth session. Unchecked login
// stays memory-only. This deliberately avoids localStorage/sessionStorage.
const memoryAuthStorage = {
  _data: Object.create(null),
  async getItem(key){ return Object.prototype.hasOwnProperty.call(this._data,key) ? this._data[key] : null; },
  async setItem(key,value){ this._data[key]=String(value); },
  async removeItem(key){ delete this._data[key]; }
};

const IDB_NAME='bahikhata_auth_v1', IDB_STORE='auth';
let idbPromise=null;
function openAuthDB(){
  if(idbPromise) return idbPromise;
  idbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){ reject(new Error('IndexedDB is unavailable')); return; }
    const req=indexedDB.open(IDB_NAME,1);
    req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE); };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error||new Error('Could not open auth storage'));
  });
  return idbPromise;
}
async function idbGet(key){ const db=await openAuthDB(); return new Promise((res,rej)=>{ const tx=db.transaction(IDB_STORE,'readonly'); const r=tx.objectStore(IDB_STORE).get(key); r.onsuccess=()=>res(r.result??null); r.onerror=()=>rej(r.error); }); }
async function idbSet(key,value){ const db=await openAuthDB(); return new Promise((res,rej)=>{ const tx=db.transaction(IDB_STORE,'readwrite'); tx.objectStore(IDB_STORE).put(String(value),key); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
async function idbRemove(key){ const db=await openAuthDB(); return new Promise((res,rej)=>{ const tx=db.transaction(IDB_STORE,'readwrite'); tx.objectStore(IDB_STORE).delete(key); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
const persistentAuthStorage={
  async getItem(key){ return idbGet(key); },
  async setItem(key,value){ return idbSet(key,value); },
  async removeItem(key){ return idbRemove(key); }
};

let rememberMe=false;
function setRememberMe(enabled){ rememberMe=!!enabled; }
async function clearRememberedAuth(){
  try{
    const keys=['sb-jjryefzywugocusmsqvq-auth-token'];
    for(const k of keys) await idbRemove(k);
  }catch(e){ console.warn('Could not clear remembered auth:',e); }
}
function createDynamicAuthStorage(){
  return {
    async getItem(key){
      // On startup, a stored session means the user previously selected Remember me.
      if(rememberMe) return persistentAuthStorage.getItem(key);
      const persisted=await persistentAuthStorage.getItem(key).catch(()=>null);
      return persisted || memoryAuthStorage.getItem(key);
    },
    async setItem(key,value){
      if(rememberMe) return persistentAuthStorage.setItem(key,value);
      await persistentAuthStorage.removeItem(key).catch(()=>{});
      return memoryAuthStorage.setItem(key,value);
    },
    async removeItem(key){
      await persistentAuthStorage.removeItem(key).catch(()=>{});
      return memoryAuthStorage.removeItem(key);
    }
  };
}
function createSBClient(url,key){
  return window.supabase.createClient(url,key,{
    auth:{
      storage:createDynamicAuthStorage(),
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true
    }
  });
}

function supabaseIsConfigured(){
  const c=getSupabaseConfig();
  return !!(c.url && c.key && window.supabase);
}
function getSB(){
  if(sbClient) return sbClient;
  const c=getSupabaseConfig();
  if(!c.url || !c.key || !window.supabase) throw new Error("Sync is not configured");
  sbClient=createSBClient(c.url,c.key);
  return sbClient;
}
function supabaseConfigure(url,key){
  window.BAHIKHATA_SUPABASE={url:String(url||"").trim(),key:String(key||"").trim()};
  sbClient=createSBClient(window.BAHIKHATA_SUPABASE.url,window.BAHIKHATA_SUPABASE.key);
  return sbClient;
}
async function supabaseGetSession(){ return (await getSB().auth.getSession()).data.session; }
async function supabaseGetUser(){ return (await getSB().auth.getUser()).data.user; }
async function supabaseSignIn(email,password){ return getSB().auth.signInWithPassword({email,password}); }
async function supabaseSignOut(){ return getSB().auth.signOut(); }
async function supabaseResetPassword(email){
  return getSB().auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
}
async function supabaseListProfiles(){
  const sb=getSB();
  if(!sb) throw new Error('Sync is not configured');
  if(typeof sb.rpc!=='function') throw new Error('Sync service is not loaded. Please refresh the page.');
  const {data,error}=await sb.rpc('list_workspace_members');
  if(error) throw error;
  return Array.isArray(data)?data:[];
}
async function supabaseGetProfile(){
  const user=await supabaseGetUser();
  if(!user) return null;
  const {data,error}=await getSB().from('profiles').select('id,email,full_name,role,active,created_at').eq('id',user.id).maybeSingle();
  if(error) throw error;
  if(!data) return null;
  const {data:access,error:ae}=await getSB().rpc('get_my_access');
  if(ae) throw ae;
  return {...data,workspace_id:access?.workspace_id||null,permissions:access?.permissions||{}};
}
async function supabaseCreateStaffAccount(email,fullName,password,permissions){
  const session=await supabaseGetSession();
  if(!session?.access_token) throw new Error('Your login session has expired. Please sign in again.');
  const c=getSupabaseConfig();
  const functionUrl=c.url.replace(/\/$/, '')+'/functions/v1/admin-users';
  let res;
  try{
    res=await fetch(functionUrl,{
      method:'POST',
      headers:{'Authorization':'Bearer '+session.access_token,'apikey':c.key,'Content-Type':'application/json'},
      body:JSON.stringify({action:'create',email:String(email||'').trim().toLowerCase(),full_name:String(fullName||'').trim(),password:String(password||''),permissions:permissions||{view_data:true,add_entries:true}})
    });
  }catch(e){
    console.error('admin-users fetch failed',functionUrl,e);
    throw new Error('Could not reach the staff account service. Please hard refresh and try again.');
  }
  let data=null; try{data=await res.json();}catch(_){}
  if(!res.ok) throw new Error(data?.error || ('Staff account service returned HTTP '+res.status+'.'));
  if(data?.error) throw new Error(data.error);
  return data;
}

async function supabaseSetPermissions(id,permissions){ return getSB().rpc('set_staff_permissions',{target_user:id,new_permissions:permissions||{}}); }
async function supabaseDeactivateUser(id){ return getSB().rpc('deactivate_staff',{target_user:id}); }
async function supabasePullState(){ const {data,error}=await getSB().rpc('get_workspace_state'); if(error) throw error; return data||{parties:[],groups:[],audit:[],notifyDays:null}; }
function dataUrlToBlob(dataUrl){
  const match=String(dataUrl).match(/^data:([^;]*);base64,(.*)$/s);
  if(!match) return null;
  const mime=match[1]||"image/jpeg", b64=match[2], bin=atob(b64), bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return new Blob([bytes],{type:mime});
}
async function supabaseUploadDataUrl(dataUrl,fileName){
  if(!String(dataUrl).startsWith('data:')) return dataUrl;
  const blob=dataUrlToBlob(dataUrl); if(!blob) return dataUrl;
  const user=await supabaseGetUser(); if(!user) throw new Error('You must be signed in to upload files');
  const profile=await supabaseGetProfile(); if(!profile?.workspace_id) throw new Error('No workspace is assigned to this account');
  const safe=String(fileName||'bill').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);
  const path=profile.workspace_id+'/'+user.id+'/bills/'+Date.now()+'-'+Math.random().toString(36).slice(2,9)+'-'+safe;
  const {error}=await getSB().storage.from('bill-attachments').upload(path,blob,{contentType:blob.type,upsert:false});
  if(error) throw new Error('Photo upload failed: '+(error.message||'Please try smaller or fewer photos.'));
  const {data,error:signError}=await getSB().storage.from('bill-attachments').createSignedUrl(path,60*60*24*7);
  if(signError) throw signError;
  return {url:data.signedUrl,path};
}
async function supabaseResolveAttachment(path){
  const {data,error}=await getSB().storage.from('bill-attachments').createSignedUrl(path,60*60*24);
  if(error) throw error;
  return data.signedUrl;
}
async function supabaseHydrateAttachments(state){
  const copy=JSON.parse(JSON.stringify(state||{parties:[]}));
  for(const p of (copy.parties||[])) for(const e of (p.history||[])){
    const paths=Array.isArray(e.attachmentPaths)?e.attachmentPaths:[];
    const arr=Array.isArray(e.photos)?e.photos:[];
    for(let i=0;i<paths.length;i++) if(paths[i]){
      try{ arr[i]=await supabaseResolveAttachment(paths[i]); }catch(err){ console.warn('Attachment resolve failed',paths[i],err); }
    }
    e.photos=arr;
  }
  return copy;
}
function withTimeout(promise,ms,message){
  let timer;
  const timeout=new Promise((_,reject)=>{ timer=setTimeout(()=>reject(new Error(message||'Operation timed out')),ms); });
  return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}

async function supabasePrepareAttachments(state){
  const copy=JSON.parse(JSON.stringify(state));
  window.__hisabAttachmentUploadWarning='';
  for(const p of (copy.parties||[])) for(const e of (p.history||[])){
    const arr=Array.isArray(e.photos)?e.photos:[];
    const nextPhotos=[];
    const nextPaths=[];
    for(let i=0;i<arr.length;i++){
      const item=arr[i];
      const existingPath=Array.isArray(e.attachmentPaths)?e.attachmentPaths[i]:'';
      if(!String(item).startsWith('data:')){
        nextPhotos.push(item);
        if(existingPath) nextPaths[nextPhotos.length-1]=existingPath;
        continue;
      }
      const isPdf=String(item).startsWith('data:application/pdf');
      const uploaded=await withTimeout(
        supabaseUploadDataUrl(item,(isPdf?'bill':'photo')+'-'+(e.id||'entry')+'-'+(i+1)+(isPdf?'.pdf':'.jpg')),
        20000,
        'Photo upload timed out. Please check mobile internet and try again.'
      );
      if(!uploaded || typeof uploaded!=='object') throw new Error('Photo upload failed. Please try again.');
      nextPhotos.push(uploaded.url);
      nextPaths[nextPhotos.length-1]=uploaded.path;
    }
    e.photos=nextPhotos;
    e.attachmentPaths=nextPaths;
  }
  return copy;
}
async function supabaseStartRealtime(onChange){
  if(!supabaseIsConfigured()) return;
  if(sbChannel) try{getSB().removeChannel(sbChannel)}catch(e){}
  const workspaceId=(await supabaseGetProfile())?.workspace_id;
  if(!workspaceId) return;
  sbChannel=getSB().channel('hisab-khata-workspace-'+workspaceId)
    .on('postgres_changes',{event:'*',schema:'public',table:'bahikhata_states',filter:'workspace_id=eq.'+workspaceId},async()=>{
      try{ const state=await supabasePullState(); if(state) onChange(state); }catch(e){ console.error('Realtime sync failed',e); }
    }).subscribe();
}
function supabaseOnAuthStateChange(callback){ return getSB().auth.onAuthStateChange(callback); }
