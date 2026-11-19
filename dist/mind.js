import {ensureContinuity,continuityDecision,ambientDecision} from './continuity.js';
import {objectKey,note} from './interactions.js';
// The planner receives remembered objects and discovered routes, not the full city graph.
export function knownDirection(s,target){if(target===s.zone)return null;const queue=[[s.zone,null]],seen=new Set([s.zone]);for(const [zone,first]of queue)for(const [dir,to]of Object.entries(s.mind.routes[zone]||{})){if(!s.city.shortcut&&((zone==='cable'&&to==='boiler')||(zone==='boiler'&&to==='cable')))continue;if(seen.has(to))continue;const d=first||dir;if(to===target)return d;seen.add(to);queue.push([to,d]);}return null;}
function snapshot(s){return {stage:s.stage,gear:s.gear,scrap:s.life.scrap,wire:s.life.wire,mechanics:s.life.skills.includes('Mechanics'),salvaging:s.life.skills.includes('Salvaging'),wiring:s.life.skills.includes('Wiring'),listening:s.life.skills.includes('Listening'),resonance:s.life.skills.includes('Resonance'),recovered:s.city.recovered,lamp:s.life.lamp,stable:s.life.stable,beacon:s.life.beacon,parcel:s.life.parcel,promised:s.life.promised,delivered:s.life.delivered,shortcut:s.city.shortcut,looted:[...s.life.looted].sort(),talked:[...s.city.talked].sort()};}
function availableActions(s){const out=[];const has=(zone,id)=>s.mind.studied.includes(objectKey(zone,id));const add=(zone,id,type,ok,effect,reason)=>{if(has(zone,id))out.push({zone,id,type,ok,effect,reason});};
 add('district','pump','inspect',a=>a.stage===0,a=>{a.stage=1;a.mechanics=true},'The knock follows the damaged tooth. I want to trace it.');
 add('district','market','take-gear',a=>a.stage===1,a=>{a.stage=2;a.gear=1},'That loose gear resembles the damaged one.');
 add('district','pump','repair',a=>a.stage===2&&a.gear===1,a=>{a.stage=3;a.gear=0},'The sizes match. It may be worth trying the replacement.');
 add('district','tank','balance',a=>a.stage===3,a=>{a.stage=4},'The pump changed the pressure. The valve is connected to it.');
 add('district','gate','workshop',a=>a.stage===4,a=>{a.stage=5},'The restored pressure reaches this winch, too.');
 for(const o of Object.values(s.mind.known)){if(o.id==='scrap')add(o.zone,o.id,'rummage',a=>!a.looted.includes(o.zone),a=>{a.looted.push(o.zone);a.looted.sort();a.scrap+=2},'The shape is ruined, but the copper is still useful.');if(o.id==='npc')add(o.zone,o.id,'talk',a=>!a.talked.includes(o.zone),a=>{a.talked.push(o.zone);a.talked.sort();if(o.zone==='crossing'){a.listening=true;if(a.recovered)a.resonance=true}},'They notice things about this street that I have missed.');}
 add('district','benchwork','wind-wire',a=>a.scrap>=2&&a.salvaging&&a.mechanics,a=>{a.scrap-=2;a.wire+=2;a.wiring=true},'Salvaging gave me copper. This spindle could make it into a conductor.');
 add('lantern','lamp','light-lamp',a=>!a.lamp&&a.wire>0&&a.wiring,a=>{a.wire--;a.lamp=true},'A conductor could bridge the break inside that lamp.');
 add('boiler','regulator','tune',a=>!a.stable&&a.mechanics&&a.listening,a=>{a.stable=true},'The two wheels change the same rhythm. I can test one change at a time.');
 add('blind','cache','recover',a=>!a.recovered,a=>{a.recovered=true;if(a.listening)a.resonance=true},'The discarded coil still rings. I want to keep it.');
 add('cable','beacon','restore-beacon',a=>!a.beacon&&a.recovered&&a.stable&&a.wire>0&&a.wiring&&a.resonance&&a.mechanics,a=>{a.wire--;a.beacon=true},'The coil can resonate, wire can close the circuit, and the pipe now has a steady rhythm.');
 add('lantern','npc','accept-parcel',a=>!a.promised,a=>{a.promised=true;a.parcel=true},'Mara is carrying something meant for somebody else. I could take it along.');
 add('cable','npc','deliver-parcel',a=>a.parcel&&!a.delivered,a=>{a.parcel=false;a.delivered=true;a.scrap+=2},'Edda is the person Mara mentioned. I still have the fuse.');
 add('boiler','latch','unlatch',a=>!a.shortcut,a=>{a.shortcut=true},'The bolt is on this side. Moving it would change the way these streets connect.');
 return out;
}
export function findPlan(s,goal,limit=2500){const actions=availableActions(s);const first=snapshot(s),q=[{state:first,plan:[]}],seen=new Set([JSON.stringify(first)]);for(let i=0;i<q.length&&i<limit;i++){const {state,plan}=q[i];if(goal(state)&&plan.length)return plan;if(plan.length>=7)continue;for(const a of actions){if(!a.ok(state))continue;const next={...state,looted:[...state.looted],talked:[...state.talked]};a.effect(next);const key=JSON.stringify(next);if(seen.has(key))continue;seen.add(key);q.push({state:next,plan:[...plan,a]});}}return null;}
export function pressureExperiment(s){const l=s.life;if(l.pressure>=55&&l.pressure<=60&&l.trials.length)return {type:'settle-pressure'};const tried=new Set(l.trials.map(t=>t.intake+':'+t.vent));const trials=l.trials;
 // Learn the direction of a wheel's effect from adjacent observed readings.
 let intakeSlope=null,ventSlope=null;for(const a of trials)for(const b of trials){if(a.vent===b.vent&&a.intake!==b.intake)intakeSlope=(a.pressure-b.pressure)/(a.intake-b.intake);if(a.intake===b.intake&&a.vent!==b.vent)ventSlope=(a.pressure-b.pressure)/(a.vent-b.vent);}
 let candidates=[];for(const [di,dv]of [[1,0],[-1,0],[0,-1],[0,1]]){const intake=l.intake+di,vent=l.vent+dv;if(intake<0||intake>6||vent<0||vent>6||tried.has(intake+':'+vent))continue;const slope=di?intakeSlope:ventSlope;const estimate=slope===null?null:l.pressure+slope*(di||dv);candidates.push({intake,vent,score:estimate===null?40:Math.abs(57.5-estimate)});}if(!candidates.length){for(let intake=0;intake<=6;intake++)for(let vent=0;vent<=6;vent++)if(!tried.has(intake+':'+vent))candidates.push({intake,vent,score:Math.abs(intake-l.intake)+Math.abs(vent-l.vent)});}candidates.sort((a,b)=>a.score-b.score);return candidates.length?{type:'probe',payload:{intake:candidates[0].intake,vent:candidates[0].vent}}:null;}
function routeLife(s,d){if(!d)return null;if(d.zone===s.zone)return d;const dir=knownDirection(s,d.zone);return dir?{...d,id:'exit-'+dir,type:'travel:'+dir,payload:{}}:null;}
export function decide(s,points){ensureContinuity(s);const ongoing=routeLife(s,continuityDecision(s,true));if(ongoing)return ongoing;const knows=(z,id)=>s.mind.studied.includes(objectKey(z,id));const goals=[];
 if(s.life.parcel&&knows('cable','npc'))goals.push(a=>a.delivered);
 if(knows('district','pump')&&s.stage<5)goals.push(a=>a.stage>s.stage);
 if(knows('lantern','lamp')&&!s.life.lamp)goals.push(a=>a.lamp);
 if(knows('boiler','regulator')&&!s.life.stable)goals.push(a=>a.stable);
 if(knows('cable','beacon')&&!s.life.beacon)goals.push(a=>a.beacon);
 if(knows('blind','cache')&&!s.city.recovered)goals.push(a=>a.recovered);
 if(knows('boiler','latch')&&!s.city.shortcut)goals.push(a=>a.shortcut);
 if(knows('lantern','npc')&&!s.life.promised)goals.push(a=>a.promised);
 for(const goal of goals){const plan=findPlan(s,goal);if(plan){const a=plan[0];if(a.zone!==s.zone){const dir=knownDirection(s,a.zone);if(!dir)continue;return {id:'exit-'+dir,type:'travel:'+dir,reason:a.reason,evidence:`Remembered: ${s.mind.known[objectKey(a.zone,a.id)]?.name||a.id}.`};}if(a.type==='tune'){const experiment=pressureExperiment(s);if(experiment)return {...experiment,id:a.id,reason:a.reason,evidence:'The gauge and the sound respond to each adjustment.'};}return {id:a.id,type:a.type,reason:a.reason,evidence:plan.length>1?'Several things I already know may fit together.':'I have seen enough to try this.'};}}
 // Curiosity supplies new evidence when remembered affordances cannot solve a need.
 const unstudied=Object.entries(points).filter(([id,p])=>!p.exit&&id!=='bench'&&!knows(s.zone,id));unstudied.sort(([,a],[,b])=>Math.hypot(s.x-a.x,s.y-a.y)-Math.hypot(s.x-b.x,s.y-b.y));if(unstudied.length)return {id:unstudied[0][0],type:'study',payload:{id:unstudied[0][0]},reason:'There is something here I have not looked at closely.',evidence:unstudied[0][1].name};
 if(points.npc&&!s.city.talked.includes(s.zone))return {id:'npc',type:'talk',reason:'I could listen before assuming I understand this place.',evidence:'A resident knows this street.'};
 // Only routes actually observed in a visited neighborhood may be used to find a frontier.
 for(const [zone,routes]of Object.entries(s.mind.routes))for(const [dir,to]of Object.entries(routes)){if(s.city.visited.includes(to))continue;const step=zone===s.zone?dir:knownDirection(s,zone);if(step&&(!points['exit-'+step]?.locked))return {id:'exit-'+step,type:'travel:'+step,reason:'That passage leads somewhere I have not been.',evidence:'An open route, beyond the familiar streets.'};}
 if(s.stage>=3&&!s.visits.pumpReturn&&knows('district','pump')){const dir=knownDirection(s,'district');return dir?{id:'exit-'+dir,type:'travel:'+dir,reason:'I want to hear whether the pump still holds its rhythm.'}:{id:'pump',type:'revisit',reason:'It sounds different now that I know it.'};}
 const continuing=routeLife(s,continuityDecision(s))||routeLife(s,ambientDecision(s));if(continuing)return continuing;
 return {id:null,type:'pause',reason:s.continuity.draft?'I have left something unfinished on purpose. I want to hear it again with a little distance.':'Nothing urgent. The people and questions are still here.',wait:30};}
export function rememberDecision(s,d){s.mind.intent=d.reason;s.mind.evidence=d.evidence||'';const key=d.type+':'+s.zone+':'+d.id;if(key!==s.mind.lastDecision){s.mind.lastDecision=key;note(s,d.reason,'intention');}}
