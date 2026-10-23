#!/usr/bin/env node
// Copyright 2026 KarmenLoop. SPDX-License-Identifier: Apache-2.0
import {parseArgs} from 'node:util';
import {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync,chmodSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {parse} from 'smol-toml';
const {values:v}=parseArgs({options:Object.fromEntries(['host','workspace','profile'].map(k=>[k,{type:'string'}]))});
function save(path,text){mkdirSync(dirname(path),{recursive:true});const temporary=path+'.install-'+process.pid;writeFileSync(temporary,text,{mode:0o600,flag:'wx'});renameSync(temporary,path);chmodSync(path,0o600);}
try{
 if(!['codex','cursor'].includes(v.host)||!v.workspace||!v.profile)throw Error('Use --host codex|cursor --workspace PATH --profile PRIVATE_JSON.');
 const workspace=resolve(v.workspace),profile=resolve(v.profile),server='karmen_memory';const config=JSON.parse(readFileSync(profile,'utf8'));if(!config.token||!config.url)throw Error('The private profile needs a service URL and client token.');
 const entry={command:process.execPath,args:[join(import.meta.dirname,'mcp.mjs')],env:{KARMEN_MEMORY_PROFILE:profile,KARMEN_MEMORY_TOKEN:'',KARMEN_MEMORY_TOKEN_FILE:'',KARMEN_MEMORY_URL:config.url,KARMEN_MEMORY_CA:config.ca||''}};
 if(v.host==='cursor'){
  const path=join(workspace,'.cursor/mcp.json'),data=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};data.mcpServers||={};if(data.mcpServers[server])throw Error('The workspace already configures karmen_memory; no file was changed.');data.mcpServers[server]={type:'stdio',...entry};save(path,JSON.stringify(data,null,2)+'\n');
 }else{
  const path=join(workspace,'.codex/config.toml'),old=existsSync(path)?readFileSync(path,'utf8'):'';if(parse(old).mcp_servers?.[server])throw Error('The workspace already configures karmen_memory; no file was changed.');const next=old+'\n[mcp_servers.karmen_memory]\ncommand = '+JSON.stringify(entry.command)+'\nargs = '+JSON.stringify(entry.args)+'\nenv = { '+Object.entries(entry.env).map(([k,value])=>k+' = '+JSON.stringify(value)).join(', ')+' }\nstartup_timeout_sec = 15\n';parse(next);save(path,next);
 }
 console.log(JSON.stringify({ok:true,host:v.host,workspace,server,activation:'Reload, approve this specific server, and verify an actual memory_search call. Configuration alone is not acceptance.'}));
}catch(e){console.error(e.message);process.exitCode=2;}
