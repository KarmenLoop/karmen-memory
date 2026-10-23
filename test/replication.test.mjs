import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createService} from '../server/http.mjs';import {request} from '../server/sync-client.mjs';
const fact=(body='Actual shared context',scope='全设备',project='Acceptance')=>({title:'Shared installation notes',body,scope,project,type:'项目需求',provenance:'Runtime acceptance record'});
async function fixture(t){const dir=mkdtempSync(join(tmpdir(),'memory-replica-'));const service=await createService({dataDir:dir,port:0,lanPort:0,lanHost:'127.0.0.1'}),url=`http://127.0.0.1:${service.port}`;const r=await fetch(url+'/api/session'),cookie=r.headers.get('set-cookie').split(';')[0],csrf=(await r.json()).csrf;
 const call=async(path,input,method=input===undefined?'GET':'POST',status=200)=>{const r=await fetch(url+'/api'+path,{method,headers:{Cookie:cookie,...(input!==undefined?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},body:input===undefined?undefined:JSON.stringify(input)});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;};t.after(async()=>{await service.close();rmSync(dir,{recursive:true,force:true});});return {service,call,dir};}
test('replication uses the current library, preserves offline conflicts and revisions, and rejects revoked peers',async t=>{
 const a=await fixture(t),b=await fixture(t);await a.call('/lan',{enabled:true},'POST',201);
 const original=await a.call('/memories',fact(),'POST',201);await a.call('/memories',fact('Never sync local content','仅本机'),'POST',201);await a.call('/memories',fact('Wrong project','全设备','Other'),'POST',201);
 const ticket=await a.call('/replication/pairing',{project:'Acceptance'}),certificate=readFileSync(join(a.dir,'lan-cert.pem'),'utf8');
 const peer=await b.call('/replication/pair',{url:`https://127.0.0.1:${a.service.lanInfo().port}`,certificate,code:ticket.code,name:'Second store'});
 await b.call('/replication/peers/'+peer.id+'/sync',{});assert.deepEqual(b.service.store.all('facts').map(f=>f.id),[original.id]);assert.equal(b.service.store.history(original.id).length,1);
 await a.call('/memories/'+original.id,{revision:1,body:'Offline edit A'},'PATCH');await b.call('/memories/'+original.id,{revision:1,body:'Offline edit B'},'PATCH');await b.call('/replication/peers/'+peer.id+'/sync',{});
 const conflict=(await a.call('/replication')).conflicts[0];assert(conflict);await a.call('/replication/conflicts/'+conflict.id,{choice:conflict.variants.findIndex(v=>v.body==='Offline edit B')});await b.call('/replication/peers/'+peer.id+'/sync',{});assert.equal(a.service.store.one('facts',original.id).body,'Offline edit B');assert.equal((await b.call('/replication')).conflicts.length,0);
 const current=a.service.store.one('facts',original.id);await a.call('/memories/'+original.id,{revision:current.revision,scope:'仅本机'},'PATCH',409);
 await a.call('/replication/memories/'+original.id,{revision:current.revision},'DELETE');const stale=b.service.store.one('facts',original.id);await b.call('/memories/'+original.id,{revision:stale.revision,body:'Stale after delete'},'PATCH');await b.call('/replication/peers/'+peer.id+'/sync',{});assert.equal(b.service.store.all('facts').length,0);
 const incoming=(await a.call('/replication')).peers.find(p=>p.direction==='incoming');await a.call('/replication/peers/'+incoming.id,{},'DELETE');await b.call('/replication/peers/'+peer.id+'/sync',{},'POST',401);
 await assert.rejects(request(`https://127.0.0.1:${a.service.lanInfo().port}`,'/v1/replica/pair',{method:'POST',body:{code:ticket.code}}));
});
test('restart retains replica identity and cursor; an offline update arrives over real HTTPS',async t=>{
 const a=await fixture(t),b=await fixture(t);await a.call('/lan',{enabled:true},'POST',201);const original=await a.call('/memories',fact(),'POST',201);const ticket=await a.call('/replication/pairing',{project:'Acceptance'});const peer=await b.call('/replication/pair',{url:`https://127.0.0.1:${a.service.lanInfo().port}`,certificate:readFileSync(join(a.dir,'lan-cert.pem'),'utf8'),code:ticket.code,name:'Restarted replica'});await b.call('/replication/peers/'+peer.id+'/sync',{});const identity=b.service.replicas.log.nodeId;
 await b.service.close();b.service.close=async()=>{};await a.call('/memories/'+original.id,{revision:1,body:'Changed while receiver was offline'},'PATCH');
 const restarted=await createService({dataDir:b.dir,port:0,lanPort:0,lanHost:'127.0.0.1'});
 try{assert.equal(restarted.replicas.log.nodeId,identity);await restarted.replicas.sync(peer.id);assert.equal(restarted.store.one('facts',original.id).body,'Changed while receiver was offline');assert.equal(restarted.store.history(original.id).length,2);}finally{await restarted.close();}
});
test('withdrawing a never-published shared record does not leak it into a later replica',async t=>{
 const a=await fixture(t),b=await fixture(t);await a.call('/lan',{enabled:true},'POST',201);const m=await a.call('/memories',fact(),'POST',201);await a.call('/replication');await a.call('/memories/'+m.id,{revision:1,scope:'仅本机'},'PATCH');const ticket=await a.call('/replication/pairing',{project:'Acceptance'});const peer=await b.call('/replication/pair',{url:`https://127.0.0.1:${a.service.lanInfo().port}`,certificate:readFileSync(join(a.dir,'lan-cert.pem'),'utf8'),code:ticket.code,name:'Later replica'});await b.call('/replication/peers/'+peer.id+'/sync',{});assert.equal(b.service.store.all('facts').length,0);assert.equal(a.service.store.one('facts',m.id).scope,'仅本机');
});
test('a paired device cannot overwrite or delete a local fact by reusing its ID',async t=>{
 const a=await fixture(t),b=await fixture(t);await a.call('/lan',{enabled:true},'POST',201);const local=await a.call('/memories',fact('Private local fact','仅本机'),'POST',201);const ticket=await a.call('/replication/pairing',{project:'Acceptance'}),certificate=readFileSync(join(a.dir,'lan-cert.pem'),'utf8'),url=`https://127.0.0.1:${a.service.lanInfo().port}`;const paired=await b.call('/replication/pair',{url,certificate,code:ticket.code,name:'Bound peer'});const peer=b.service.replicas.log.peers().find(p=>p.id===paired.id);
 const injected={...fact('Injected'),id:local.id,scope:'shared',status:'active',source:'Bound peer',revision:1,updated:new Date().toISOString(),vector:{[b.service.replicas.log.nodeId]:1}};
 for(const status of ['active','deleted'])await assert.rejects(request(url,'/v1/replica/sync',{method:'POST',token:peer.token,certificate,body:{records:[{...injected,status}]}}),{status:403,code:'SCOPE_CONFLICT'});
 assert.equal(a.service.store.one('facts',local.id).body,'Private local fact');assert.equal(a.service.store.one('facts',local.id).scope,'仅本机');
});
test('large valid Unicode records cross the real request limit in bounded batches',async t=>{
 const a=await fixture(t),b=await fixture(t);await a.call('/lan',{enabled:true},'POST',201);
 a.service.store.tx(()=>{for(let i=0;i<60;i++)a.service.store.createFact({...fact('字'.repeat(6000)),title:'Large record '+i,provenance:'据'.repeat(6000)});});
 const ticket=await a.call('/replication/pairing',{project:'Acceptance'}),peer=await b.call('/replication/pair',{url:`https://127.0.0.1:${a.service.lanInfo().port}`,certificate:readFileSync(join(a.dir,'lan-cert.pem'),'utf8'),code:ticket.code,name:'Large-record receiver'});await b.call('/replication/peers/'+peer.id+'/sync',{});assert.equal(b.service.store.all('facts').length,60);assert(b.service.store.all('facts').every(f=>f.body.length===6000));
});
test('a persisted push cursor continues a backlog instead of resending the same first batch',async t=>{
 const a=await fixture(t),b=await fixture(t);await a.call('/lan',{enabled:true},'POST',201);
 b.service.store.tx(()=>{for(let i=0;i<260;i++)b.service.store.createFact({...fact('Backlog item '+i),title:'Backlog '+i});});
 const ticket=await a.call('/replication/pairing',{project:'Acceptance'}),peer=await b.call('/replication/pair',{url:`https://127.0.0.1:${a.service.lanInfo().port}`,certificate:readFileSync(join(a.dir,'lan-cert.pem'),'utf8'),code:ticket.code,name:'Backlog sender'});const first=await b.call('/replication/peers/'+peer.id+'/sync',{});assert.equal(first.more,true);const cursor=b.service.replicas.log.peers().find(p=>p.id===peer.id).pushCursor;assert(cursor>0);await b.call('/replication/peers/'+peer.id+'/sync',{});assert.equal(a.service.store.all('facts').length,260);assert(b.service.replicas.log.peers().find(p=>p.id===peer.id).pushCursor>cursor);
});
