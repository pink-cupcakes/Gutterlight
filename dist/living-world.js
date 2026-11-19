import {interactables} from './interactions.js';
function halo(c,x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}
function wheel(c,x,y,r,angle){c.save();c.translate(x,y);c.rotate(angle);c.strokeStyle='#3e2b18';c.lineWidth=8;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();c.strokeStyle='#b28a46';c.lineWidth=3;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();for(let i=0;i<6;i++){c.rotate(Math.PI/3);c.beginPath();c.moveTo(0,0);c.lineTo(r,0);c.stroke();}c.fillStyle='#d5b86c';c.beginPath();c.arc(0,0,5,0,Math.PI*2);c.fill();c.restore();}
export function drawLivingWorld(c,s,images,time,reduced){const t=reduced?0:time;
 // Moving mechanisms take their motion directly from committed world state.
 if(s.zone==='district'){
  if(s.continuity?.draft||s.continuity?.works.length){const p=interactables.district.benchwork;c.save();c.translate(p.x-14,p.y-33);c.rotate(-.1);c.fillStyle='#d5c696';c.fillRect(0,0,28,19);c.strokeStyle='#5c6547';c.lineWidth=1;for(let i=0;i<4;i++){c.beginPath();c.moveTo(4,5+i*3);c.lineTo(24,5+i*3);c.stroke();}c.restore();}

  wheel(c,1544,466,24,s.stage>=3?t*.8:Math.sin(t)*.07);
  if(s.stage>=5){const y=180+Math.sin(t*.18)*90;c.strokeStyle='#63553d';c.lineWidth=3;c.beginPath();c.moveTo(1007,65);c.lineTo(1007,y);c.stroke();c.fillStyle='#2c3326';c.fillRect(984,y,46,43);c.strokeStyle='#b2975c';c.lineWidth=2;c.strokeRect(984,y,46,43);for(let x=991;x<1029;x+=9){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+43);c.stroke();}halo(c,1007,y+12,45,'#d8b75635');}
 }
 if(s.zone==='boiler'){
  wheel(c,1100,562,28,s.life.stable?t*1.5:Math.sin(t*9)*.05);
  const count=s.life.stable?2:12;for(let i=0;i<count;i++){const f=(t*.15+i/count)%1;halo(c,1085+f*115+Math.sin(i+t*.5)*18,548-f*150,18+f*62,`rgba(188,204,166,${(1-f)*(s.life.stable?.025:.09)})`);}
  const pressure=s.life.pressure;c.save();c.translate(1090,554);c.fillStyle='#d0c28f';c.beginPath();c.arc(0,0,16,0,Math.PI*2);c.fill();c.strokeStyle=s.life.stable?'#51692f':'#68472c';c.lineWidth=2;c.beginPath();c.moveTo(0,0);const a=(pressure/90)*Math.PI-Math.PI;c.lineTo(Math.cos(a)*13,Math.sin(a)*13);c.stroke();c.restore();
 }
 for(const [id,p]of Object.entries(interactables[s.zone]||{})){
  if(p.kind==='scrap'&&!s.life.looted.includes(s.zone)){const im=images.items;c.drawImage(im,im.width*2/3,0,im.width/3,im.height/2,p.x-19,p.y-32,38,38);if(!reduced){c.fillStyle='#d7c982';c.globalAlpha=.35+.35*Math.sin(t*2+p.x);c.fillRect(p.x+10,p.y-25,2,2);c.globalAlpha=1;}}
  if(p.kind==='workbench'){c.fillStyle='#493c2a';c.fillRect(p.x-31,p.y-24,62,20);c.strokeStyle='#b69a60';c.strokeRect(p.x-31,p.y-24,62,20);wheel(c,p.x+12,p.y-18,9,0);}
  if(p.kind==='lamp'){c.fillStyle='#3b3e2b';c.fillRect(p.x-4,p.y-82,8,81);c.strokeStyle='#b99a52';c.lineWidth=3;c.strokeRect(p.x-14,p.y-85,28,28);c.fillStyle=s.life.lamp?'#ffe0a0':'#293b2d';c.fillRect(p.x-10,p.y-81,20,21);if(s.life.lamp){const shaded=s.continuity?.threads.lamp?.phase>=3;c.save();c.globalCompositeOperation='screen';halo(c,p.x,p.y-(shaded?25:70),shaded?95:155,shaded?'#f0b95b38':'#f0b95b55');halo(c,p.x,p.y-70,shaded?20:35,'#ffe6a5aa');c.restore();if(shaded){c.fillStyle='#68754e';c.strokeStyle='#c4ac6a';c.lineWidth=2;c.beginPath();c.moveTo(p.x-22,p.y-72);c.lineTo(p.x-12,p.y-88);c.lineTo(p.x+9,p.y-88);c.lineTo(p.x+26,p.y-72);c.closePath();c.fill();c.stroke();}}}
  if(p.kind==='beacon'){c.fillStyle='#454d3d';c.fillRect(p.x-5,p.y-90,10,89);c.strokeStyle='#aa8d58';c.lineWidth=3;c.beginPath();c.moveTo(p.x-29,p.y-63);c.lineTo(p.x+29,p.y-63);c.moveTo(p.x,p.y-100);c.lineTo(p.x-24,p.y-83);c.moveTo(p.x,p.y-100);c.lineTo(p.x+24,p.y-83);c.stroke();wheel(c,p.x,p.y-62,18,s.life.beacon?t*.4:0);if(s.life.beacon){c.save();c.globalCompositeOperation='screen';halo(c,p.x,p.y-98,180,'#a4e89744');for(let n=0;n<3;n++){const f=(t*.25+n/3)%1;c.strokeStyle=`rgba(169,236,137,${(1-f)*.55})`;c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y-98,18+f*120,8+f*50,0,0,Math.PI*2);c.stroke();}c.restore();}}
 }
 if(s.zone==='cable'){
  if(s.life.delivered){c.save();c.globalCompositeOperation='screen';halo(c,655,500,90,'#efc25b44');c.restore();}
  if(s.life.beacon){const x=120+((t*.035)%1)*1430,y=422+Math.sin(x/520)*23;c.strokeStyle='#1a2720';c.lineWidth=3;c.beginPath();c.moveTo(80,385);c.lineTo(1570,426);c.stroke();c.strokeStyle='#b29459';c.lineWidth=3;c.beginPath();c.moveTo(x,y-26);c.lineTo(x,y);c.stroke();c.fillStyle='#303b2d';c.fillRect(x-29,y,58,40);c.strokeRect(x-29,y,58,40);c.fillStyle='#b8d490';c.fillRect(x-21,y+7,42,13);wheel(c,x,y-27,6,t*2);}
 }
}
export function drawActionEffects(c,effects,time){for(const e of effects){const age=time-e.time;if(age>2.2)continue;for(let i=0;i<12;i++){const a=i*2.4;c.globalAlpha=Math.max(0,1-age/2.2);c.fillStyle=e.color;c.fillRect(e.x+Math.cos(a)*age*29,e.y-30-Math.sin(a)*age*18-age*22,3,3);}c.globalAlpha=1;}}
