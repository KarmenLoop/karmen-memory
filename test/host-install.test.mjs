import test from 'node:test';import assert from 'node:assert/strict';import{mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{spawnSync}from'node:child_process';import{parse}from'smol-toml';
test('workspace host installation preserves unrelated servers and refuses an unsafe or duplicate merge',()=>{
 const root=mkdtempSync(join(tmpdir(),'memory-host-'));try{
 const profile=join(root,'profile.json');writeFileSync(profile,JSON.stringify({url:'http://127.0.0.1:4318',token:'synthetic-acceptance-token'}),{mode:0o600});mkdirSync(join(root,'.cursor'));mkdirSync(join(root,'.codex'));writeFileSync(join(root,'.cursor/mcp.json'),JSON.stringify({mcpServers:{unrelated:{command:'preserved'}}}));writeFileSync(join(root,'.codex/config.toml'),'[mcp_servers.unrelated]\ncommand="preserved"\n');
 const run=host=>spawnSync(process.execPath,[resolve('bin/install-host.mjs'),'--host',host,'--workspace',root,'--profile',profile],{encoding:'utf8'});
 for(const host of ['codex','cursor']){assert.equal(run(host).status,0);const file=join(root,host==='codex'?'.codex/config.toml':'.cursor/mcp.json'),before=readFileSync(file,'utf8');assert.equal(run(host).status,2);assert.equal(readFileSync(file,'utf8'),before);}
 assert.equal(JSON.parse(readFileSync(join(root,'.cursor/mcp.json'))).mcpServers.unrelated.command,'preserved');assert.equal(parse(readFileSync(join(root,'.codex/config.toml'),'utf8')).mcp_servers.unrelated.command,'preserved');
 const file=join(root,'.codex/config.toml'),inline='mcp_servers={unrelated={command="preserved"}}\n';writeFileSync(file,inline);assert.equal(run('codex').status,2);assert.equal(readFileSync(file,'utf8'),inline);
 }finally{rmSync(root,{recursive:true,force:true});}
});
