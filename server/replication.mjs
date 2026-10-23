// Copyright 2026 KarmenLoop. SPDX-License-Identifier: Apache-2.0
import {join} from 'node:path';
import {Store,fail,digest,canonical} from './replica-store.mjs';
import {request,lanTarget,certificateInfo,synchronize} from './sync-client.mjs';

const owner={name:'Local owner',role:'admin',projects:['*']};
const selected=f=>Object.fromEntries(['title','body','type','project','status','favorite','provenance'].map(k=>[k,f[k]]));
export function replication(primary,directory){
 const log=new Store(join(directory,'replication'),primary.db),busy=new Map();let closing=false;
 // Core records, synchronization metadata, and imported revisions share one SQLite transaction.
 log.tx=fn=>primary.tx(fn);
 const fingerprint=f=>digest(selected(f));
 function capture(){return primary.tx(()=>{
  for(const f of primary.all('facts')){
   let current=log.get(f.id);const old=log.setting('primary:'+f.id);
   if(current&&!log.setting('published:'+f.id)&&(f.scope!=='全设备'||f.project!==current.project)){
    primary.db.prepare('DELETE FROM replica_memories WHERE id=?').run(f.id);primary.db.prepare("DELETE FROM replica_changes WHERE json_extract(payload,'$.id')=?").run(f.id);primary.db.prepare('DELETE FROM replica_conflicts WHERE memory_id=?').run(f.id);log.setting('primary:'+f.id,null);current=null;
   }
   if(f.scope!=='全设备')continue;
   if(old===fingerprint(f))continue;
   const record={...selected(f),id:f.id,source:f.source,scope:'shared',updated:f.updated,revision:(current?.revision||0)+1,vector:{...current?.vector,[log.nodeId]:(current?.vector?.[log.nodeId]||0)+1}};
   log.put(record,'Primary store');log.setting('primary:'+f.id,fingerprint(f));
  }
 });}
 function apply(){
  for(const m of log.all()){
   const found=primary.db.prepare('SELECT data FROM facts WHERE id=?').get(m.id),current=found?JSON.parse(found.data):null;
   if(m.status==='deleted'){
    if(current){primary.db.prepare('DELETE FROM revisions WHERE fact_id=?').run(m.id);primary.db.prepare('DELETE FROM facts WHERE id=?').run(m.id);}
    log.setting('primary:'+m.id,null);continue;
   }
   const fields={...selected(m),scope:'全设备'};
   if(!current)primary.createFact(fields,{name:m.source},{id:m.id});
   else if(fingerprint(current)!==digest(selected(m)))primary.update(m.id,{...fields,revision:current.revision},{name:m.source});
   log.setting('primary:'+m.id,digest(selected(m)));
  }
 }
 const merge=log.merge.bind(log);log.merge=(incoming,actor)=>primary.tx(()=>{
  fail(typeof incoming?.id==='string','INVALID_RECORD','A record ID is required.');
  const found=primary.db.prepare('SELECT data FROM facts WHERE id=?').get(incoming.id),current=found?JSON.parse(found.data):null;
  fail(!current||(current.scope==='全设备'&&current.project===incoming.project),'SCOPE_CONFLICT','A replica cannot overwrite a local record or another project.',403);
  const result=merge(incoming,actor);apply();return result;
 });
 const resolve=log.resolve.bind(log);log.resolve=(...args)=>primary.tx(()=>{const result=resolve(...args);apply();return result;});
 primary.replicationGuard=(old,value)=>{
  if(!log.setting('published:'+old.id))return;
  if((value.scope??old.scope)!==old.scope||(value.project??old.project)!==old.project)fail(false,'SHARED_SCOPE_FIXED','Delete the replicated record and create a new record to change its project or scope.',409);
  if(log.conflicts().some(c=>c.memoryId===old.id))fail(false,'CONFLICT_PENDING','Resolve the saved synchronization conflict before editing this record.',409);
 };
 function state(){capture();return {nodeId:log.nodeId,peers:log.peers().map(({token,certificate,...p})=>({...p,fingerprint:certificate?certificateInfo(certificate).fingerprint:null})),conflicts:log.conflicts(),shared:primary.all('facts').filter(f=>f.scope==='全设备')};}
 async function sync(id){
  fail(!closing&&!busy.has(id),'SYNC_BUSY','The service is stopping or this peer is already synchronizing.',409);capture();const peer=log.peers().find(p=>p.id===id);fail(peer,'NOT_FOUND','Peer not found.',404);
  for(const m of log.all())if(log.allowed({role:'sync',projects:peer.projects},m.project))log.setting('published:'+m.id,true);
  const controller=new AbortController();const operation=synchronize(log,peer,controller.signal);busy.set(id,{controller,operation});
  try{return await operation;}finally{busy.delete(id);}
 }
 async function local(path,method,input){
  if(path==='/api/replication'&&method==='GET')return state();
  if(path==='/api/replication/pairing'&&method==='POST')return log.pairing([input.project]);
  if(path==='/api/replication/pair'&&method==='POST'){
   const url=lanTarget(input.url);certificateInfo(input.certificate);
   const remote=await request(url,'/v1/replica/pair',{method:'POST',certificate:input.certificate,body:{code:input.code,name:input.name,nodeId:log.nodeId}});
   fail(typeof remote.token==='string'&&remote.nodeId!==log.nodeId&&Array.isArray(remote.projects),'INVALID_PAIR_RESPONSE','Invalid pairing response.');
   const peer={id:remote.nodeId,name:input.remoteName||url,direction:'outgoing',url,certificate:input.certificate,token:remote.token,projects:remote.projects,cursor:0,autoSync:true,paused:false};log.savePeer(peer);return {id:peer.id,projects:peer.projects};
  }
  const peerId=/^\/api\/replication\/peers\/([a-zA-Z0-9-]+)(\/sync)?$/.exec(path);
  if(peerId&&method==='POST'&&peerId[2])return sync(peerId[1]);
  if(peerId&&method==='DELETE'){
   const active=busy.get(peerId[1]);if(active){active.controller.abort();await Promise.allSettled([active.operation]);}
   const peer=log.peers().find(p=>p.id===peerId[1]);fail(peer,'NOT_FOUND','Peer not found.',404);if(peer.credentialId)log.revoke(peer.credentialId);peer.paused=true;delete peer.token;log.savePeer(peer);return {ok:true,remoteRevocation:peer.direction==='incoming'};
  }
  const conflict=/^\/api\/replication\/conflicts\/([a-zA-Z0-9-]+)$/.exec(path);if(conflict&&method==='POST')return log.resolve(conflict[1],input.choice,owner);
  const memory=/^\/api\/replication\/memories\/([a-zA-Z0-9-]+)$/.exec(path);
  if(memory&&method==='DELETE')return primary.tx(()=>{
   const m=primary.one('facts',memory[1]);fail(m.revision===input.revision,'REVISION_CONFLICT','Reload this record before deleting it.',409);capture();const wire=log.get(m.id);log.remove(m.id,wire.revision,owner);apply();return {ok:true};
  });
  fail(false,'NOT_FOUND','Synchronization endpoint not found.',404);
 }
 async function remote(path,method,input,headers,https){
  fail(https,'HTTPS_REQUIRED','Replication requires the LAN HTTPS listener.',403);
  if(path==='/v1/replica/pair'&&method==='POST')return log.pair(input.code,input.name,input.nodeId);
  const actor=log.authenticate(headers.authorization?.startsWith('Bearer ')?headers.authorization.slice(7):null);fail(actor?.role==='sync','UNAUTHORIZED','A paired replication credential is required.',401);
  capture();for(const m of log.all())if(m.scope==='shared'&&log.allowed(actor,m.project))log.setting('published:'+m.id,true);
  const activity=()=>{for(const p of log.peers())if(p.credentialId===actor.id){p.lastSyncAt=new Date().toISOString();log.savePeer(p);}};
  if(path==='/v1/replica/sync'&&method==='GET'){const page=log.feed(actor,Number(input.after||0));activity();return page;}
  if(path==='/v1/replica/sync'&&method==='POST'){
   fail(Array.isArray(input.records)&&input.records.length<=100,'INVALID_BATCH','Send at most 100 records.');return primary.tx(()=>{const result={outcomes:input.records.map(m=>log.merge(m,actor))};activity();return result;});
  }
  fail(false,'NOT_FOUND','Replication endpoint not found.',404);
 }
 const interval=setInterval(()=>{for(const p of log.peers())if(p.direction==='outgoing'&&p.autoSync&&!p.paused&&!busy.has(p.id)&&(p.nextAttemptAt||0)<Date.now())sync(p.id).catch(()=>{});},5000);interval.unref();
 return {state,capture,local,remote,log,sync,async close(){closing=true;clearInterval(interval);const active=[...busy.values()];active.forEach(x=>x.controller.abort());await Promise.allSettled(active.map(x=>x.operation));}};
}
