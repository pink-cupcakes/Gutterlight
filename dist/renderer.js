import { W, H } from './world-model.js';
import { drawLivingWorld, drawActionEffects } from './living-world.js';

// Rendering reads a frame snapshot. It does not mutate the world or query the DOM.
export function drawWorld(
  ctx,
  {
    state,
    images,
    time: t,
    camera,
    points,
    target,
    promptId,
    hovered,
    effects,
    reduced,
    focusRing,
    direction: dir,
    moving,
    frame,
  },
) {
  const { width, height, scale, ox, oy } = camera;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  drawAtmosphere(ctx, state, images, t, reduced);
  drawLivingWorld(ctx, state, images, t, reduced);
  drawActionEffects(ctx, effects, t);
  if (state.zone === 'district' && state.gift) {
    const im = images.items;
    ctx.drawImage(
      im,
      0,
      im.height / 2,
      im.width / 3,
      im.height / 2,
      state.gift.x - 16,
      state.gift.y - 37,
      32,
      42,
    );
    glow(ctx, state.gift.x, state.gift.y - 15, 28, 'rgba(149,224,97,.12)');
  }
  if (focusRing && focusRing.until > t) {
    ctx.strokeStyle = `rgba(216,229,172,${Math.min(1, focusRing.until - t)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(focusRing.x, focusRing.y, 15, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const residents = Object.values(points).filter((place) => place.speaker !== undefined);
  if (state.zone === 'district') residents.push(...foundryPassersby);
  residents.sort((a, b) => a.y - b.y);
  const residentTime = reduced ? 0 : t;
  for (const resident of residents) {
    if (resident.y <= state.y) drawResident(ctx, images.residents, resident, residentTime);
  }
  drawPlayer(ctx, state, images, dir, moving, frame);
  for (const resident of residents) {
    if (resident.y > state.y) drawResident(ctx, images.residents, resident, residentTime);
  }
  if (state.zone === 'district' && state.stage >= 3) {
    ctx.strokeStyle = '#afd6b4aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(1413, 544, 12 + Math.sin(t * 3) * 3, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawInteractionMarkers(ctx, points, target, promptId, hovered, scale);
  ctx.restore();
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const residentFrames = [
  [120, 10, 299, 732],
  [611, 23, 272, 719],
  [142, 772, 282, 753],
  [588, 769, 334, 754],
];
const foundryPassersby = [
  { x: 635, y: 444, speaker: 3 },
  { x: 1038, y: 422, speaker: 0 },
  { x: 423, y: 570, speaker: 1 },
];

function drawResident(ctx, image, place, time) {
  const { x, y, speaker } = place;
  const [sx, sy, sw, sh] = residentFrames[speaker];
  const height = 107;
  const width = (sw / sh) * height;
  const sway = Math.sin(time * 1.5 + speaker) * 1.2;
  ctx.fillStyle = '#0e0a087d';
  ctx.beginPath();
  ctx.ellipse(x, y, 21, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(image, sx, sy, sw, sh, x - width / 2 + sway, y - height, width, height);
}

function drawPlayer(ctx, state, images, dir, moving, frame) {
  // Shared feet anchor and a stable contact shadow keep the painted frames grounded.
  ctx.fillStyle = '#07120b70';
  ctx.beginPath();
  ctx.ellipse(state.x, state.y + 1, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff1b9';
  ctx.lineWidth = 1.7;
  ctx.shadowColor = '#e5be67';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.ellipse(state.x, state.y + 1, 22, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  const frames = [
    [
      [123, 6, 132, 297],
      [418, 7, 125, 296],
      [719, 7, 119, 293],
      [1009, 7, 125, 296],
    ],
    [
      [126, 320, 108, 298],
      [394, 320, 173, 297],
      [705, 319, 109, 296],
      [986, 320, 163, 294],
    ],
    [
      [109, 637, 132, 297],
      [410, 637, 128, 298],
      [701, 638, 122, 297],
      [998, 637, 134, 298],
    ],
    [
      [123, 953, 117, 298],
      [369, 953, 194, 298],
      [727, 951, 98, 300],
      [970, 953, 182, 291],
    ],
  ];
  const [sx, sy, sw, sh] = frames[dir][moving ? frame : 0];
  const dh = 112,
    dw = (sw / sh) * dh;
  ctx.drawImage(images.iona, sx, sy, sw, sh, state.x - dw / 2, state.y - dh, dw, dh);
}

function drawInteractionMarkers(ctx, points, target, promptId, hovered, scale) {
  for (const [id, place] of Object.entries(points)) {
    if (id === promptId) continue;
    const quest = id === target;
    const speaker = place.speaker !== undefined;
    const underPointer = id === hovered;
    if (!quest && !underPointer && !speaker) continue;

    ctx.save();
    ctx.translate(place.x, place.y - (speaker ? 124 : 56));
    const markerScale = Math.max(1, 0.75 / scale);
    ctx.scale(markerScale, markerScale);
    ctx.fillStyle = '#211a14';
    ctx.strokeStyle = quest ? '#f7c85f' : '#e1bd87';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#000a';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    if (quest || place.exit) {
      ctx.moveTo(0, -14);
      ctx.lineTo(14, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-14, 0);
      ctx.closePath();
    } else if (speaker) {
      ctx.moveTo(-4, 10);
      ctx.lineTo(-11, 10);
      ctx.quadraticCurveTo(-16, 10, -16, 5);
      ctx.lineTo(-16, -6);
      ctx.quadraticCurveTo(-16, -11, -11, -11);
      ctx.lineTo(11, -11);
      ctx.quadraticCurveTo(16, -11, 16, -6);
      ctx.lineTo(16, 5);
      ctx.quadraticCurveTo(16, 10, 11, 10);
      ctx.lineTo(5, 10);
      ctx.lineTo(0, 16);
      ctx.closePath();
    } else {
      ctx.roundRect(-11, -11, 22, 22, 4);
    }
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = quest ? '#ffce67' : '#f2d3a1';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(quest ? '!' : speaker ? '…' : place.locked ? '×' : 'E', 0, 1);
    ctx.restore();
  }
}

function drawAtmosphere(ctx, state, images, t, reduced) {
  ctx.drawImage(images[state.zone] || images.district, 0, 0, W, H);
  // Gentle luminous breath, airborne dust, and drifting steam.
  ctx.globalCompositeOperation = 'screen';
  glow(ctx, 340, 280, 210, `rgba(108,190,44,${0.07 + Math.sin(t * 0.7) * 0.02})`);
  if (state.stage >= 4) glow(ctx, 895, 260, 180, 'rgba(147,216,92,.18)');
  glow(ctx, 1350, 355, 150, 'rgba(243,161,58,.06)');
  ctx.globalCompositeOperation = 'source-over';
  if (!reduced) {
    for (let i = 0; i < 30; i++) {
      const px = (i * 173.7 + t * (i % 2 ? 7 : -5) + W * 10) % W,
        py = 310 + ((i * 73.3 - t * 8 + H * 10) % 550);
      ctx.globalAlpha = 0.1 + 0.16 * Math.sin(t + i) ** 2;
      ctx.fillStyle = i % 4 ? '#c7c995' : '#c6ff9c';
      ctx.beginPath();
      ctx.arc(px, py, i % 3 === 0 ? 1.7 : 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const a = (t * 0.15 + i / 6) % 1;
      glow(
        ctx,
        459 + Math.sin(a * 6 + i) * 20,
        277 - a * 110,
        15 + a * 35,
        `rgba(181,199,172,${(1 - a) * 0.07})`,
      );
    }
  }
}
