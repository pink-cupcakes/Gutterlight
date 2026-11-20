import { W, H, activePlaces } from './world-model.js';
import { locals } from './city.js';
import { drawLivingWorld, drawActionEffects } from './living-world.js';

// Rendering reads a frame snapshot. It does not mutate the world or query the DOM.
export function drawWorld(
  ctx,
  {
    state,
    images,
    time: t,
    camera,
    nearby,
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
  drawInteractionMarkers(ctx, state, nearby, hovered);
  ctx.globalAlpha = 1;
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
  drawResident(ctx, state, images, t, reduced, state.y, false);
  drawPlayer(ctx, state, images, dir, moving, frame);
  drawResident(ctx, state, images, t, reduced, state.y, true);
  if (state.zone === 'district' && state.stage >= 3) {
    ctx.strokeStyle = '#afd6b4aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(1413, 544, 12 + Math.sin(t * 3) * 3, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawResident(ctx, state, images, t, reduced, playerY, front) {
  const p = locals[state.zone]?.npc;
  if (!p || p.y > playerY !== front) return;
  const im = images.residents;
  const frames = [
    [120, 10, 299, 732],
    [611, 23, 272, 719],
    [142, 772, 282, 753],
    [588, 769, 334, 754],
  ];
  const [x, y, w, h] = frames[p.npc],
    dh = 102,
    dw = (w / h) * dh;
  const sway = reduced ? 0 : Math.sin(t * 0.45 + p.npc) * 7,
    bob = reduced ? 0 : Math.sin(t * 1.5 + p.npc) * 1.3;
  ctx.fillStyle = '#07120b75';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 20, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(im, x, y, w, h, p.x - dw / 2 + sway, p.y - dh + bob, dw, dh);
}

function drawPlayer(ctx, state, images, dir, moving, frame) {
  // Shared feet anchor and a stable contact shadow keep the painted frames grounded.
  ctx.fillStyle = '#07120b70';
  ctx.beginPath();
  ctx.ellipse(state.x, state.y + 1, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c6da97a8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(state.x, state.y + 1, 22, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
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
  const dh = 92,
    dw = (sw / sh) * dh;
  ctx.drawImage(images.iona, sx, sy, sw, sh, state.x - dw / 2, state.y - dh, dw, dh);
}

function drawInteractionMarkers(ctx, state, nearby, hovered) {
  for (const [id, p] of Object.entries(activePlaces(state))) {
    const close = nearby === id || hovered === id,
      active = close;
    const distance = Math.hypot(state.x - p.x, state.y - p.y);
    if (!p.exit && distance > 235 && hovered !== id) continue;
    const y = p.y - 53;
    ctx.globalAlpha = active ? 1 : 0.7;
    ctx.fillStyle = active ? '#1c291bdb' : '#14221cd9';
    ctx.strokeStyle = active ? '#d7cb8b' : '#a8b799';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, y - 12);
    ctx.lineTo(p.x + 12, y);
    ctx.lineTo(p.x, y + 12);
    ctx.lineTo(p.x - 12, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = active ? '#eddb91' : '#cbd6b5';
    ctx.font = '15px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.exit ? (p.locked ? '×' : '◇') : '·', p.x, y + 1);
    if (close || p.exit) {
      ctx.font = '12px "DM Sans",sans-serif';
      ctx.fillStyle = '#f3e7bf';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 5;
      ctx.fillText(
        p.exit ? p.dir.toUpperCase() + ' · ' + p.name : p.name,
        Math.max(150, Math.min(W - 150, p.x)),
        y - 25,
      );
      ctx.shadowBlur = 0;
    }
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
