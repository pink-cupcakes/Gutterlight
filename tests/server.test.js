import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createGameServer} from '../scripts/serve.js';
test('standalone server serves the game and assets but not repository files',async t=>{
 const server=createGameServer();server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));const url=`http://127.0.0.1:${server.address().port}`;
 const home=await fetch(url);assert.equal(home.status,200);assert.match(await home.text(),/Mosslight/);
 const js=await fetch(url+'/game.js');assert.match(js.headers.get('content-type'),/javascript/);
 const art=await fetch(url+'/assets/iona.png',{method:'HEAD'});assert.equal(art.status,200);assert.equal(art.headers.get('content-type'),'image/png');assert.equal(await art.text(),'');
 for(const path of ['/package.json','/.git/config','/%2e%2e%2fpackage.json','/missing'])assert.equal((await fetch(url+path)).status,404);
 assert.equal((await fetch(url,{method:'POST'})).status,405);
});
