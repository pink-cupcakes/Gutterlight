import test from 'node:test';
import assert from 'node:assert/strict';
// Exercise the actual animation/update loop without browser or rendering dependencies.
test('Iona discovers, combines skills, experiments, restores the signal, and continues living',async()=>{
 const els=new Map(),store=new Map();let tick;const noop=()=>{};
 const context=new Proxy({createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop});
 const element=id=>{if(!els.has(id))els.set(id,{style:{},classList:{toggle:noop,add:noop,remove:noop},hidden:true,open:false,textContent:'',innerHTML:'',onclick:null,addEventListener:noop,setAttribute:noop,focus:noop,remove:noop,append:noop,getContext:()=>context,showModal(){this.open=true},close(){this.open=false},querySelector:()=>element('actions')});return els.get(id)};
 globalThis.document={body:element('body'),hidden:false,getElementById:element,querySelector:()=>element('brand'),querySelectorAll:()=>[],addEventListener:noop,createElement:()=>element('temp')};
 globalThis.window={addEventListener:noop};globalThis.innerWidth=1440;globalThis.innerHeight=900;globalThis.devicePixelRatio=1;globalThis.matchMedia=()=>({matches:true});globalThis.localStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 globalThis.Image=class{width=1246;height=1262;set src(v){queueMicrotask(()=>this.onload())}};globalThis.requestAnimationFrame=f=>{tick=f};
 await import('../dist/game.js');await new Promise(r=>setTimeout(r,5));assert.equal(typeof tick,'function');element('watch').onclick();
 for(let i=1;i<45000;i++)tick(i*50);
 const saved=JSON.parse(store.get('mosslight.foundry.v1'));assert.equal(saved.stage,5,'autonomous loop should finish all five stages');assert.equal(saved.gear,0);assert.equal(saved.visits.pumpReturn,true);assert.equal(saved.city.visited.length,7);assert.equal(saved.city.shortcut,true);assert.equal(saved.city.recovered,true);assert.equal(saved.city.talked.length,4);assert.equal(saved.life.lamp,true);assert.equal(saved.life.stable,true);assert.equal(saved.life.beacon,true);assert.equal(saved.life.delivered,true);assert.ok(saved.life.trials.length>1);assert.ok(saved.life.skills.includes('Resonance'));assert.ok(saved.mind.notes.some(n=>n.kind==='experiment'));assert.ok(saved.continuity.memories.length>0);assert.ok(saved.events.some(e=>e.type.startsWith('life-')));assert.ok(Object.keys(saved.continuity.threads).length>=3);assert.equal(saved.events.filter(e=>e.type==='repair').length,1);
});
