import { ensureContinuity, advanceContinuity } from './continuity.js';
import { perceive } from './interactions.js';
import { decide, rememberDecision } from './mind.js';
import { sceneOf, crossedExit, streetRoute } from './city.js';
import { drawMinimap } from './city-map.js';
import {
  W,
  H,
  canWalk,
  activePlaces,
  initialState,
  loadState,
  commit,
  objective,
} from './world-model.js';
import { drawWorld } from './renderer.js';
import { createAudio } from './audio.js';
import { createDialogs } from './ui/dialogs.js';
import { html } from './ui/html.js';

const $ = (id) => document.getElementById(id);
const canvas = $('world');
const ctx = canvas.getContext('2d');

// Preserve the original key so worlds created before the rename still load.
const SAVE = 'mosslight.foundry.v1';
let state;
try {
  state = loadState(localStorage.getItem(SAVE));
} catch {
  state = initialState();
}
ensureContinuity(state);
advanceContinuity(state);

// Camera and viewport; screen coordinates are derived from world coordinates.
let width = innerWidth;
let height = innerHeight;
let scale = 1;
let ox = 0;
let oy = 0;

// Movement and the current autonomous action.
let mode = 'explore';
const keys = new Set();
const movementKeys = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
]);
const interactionRange = 85;
let path = [];
let destination = null;
let nearby = null;
let dir = 1;
let moving = false;
let pendingDecision = null;
let autoWait = 2;

// Animation clocks and transient feedback are separate from the saved world.
let t = 0;
let last = 0;
let walkTime = 0;
let speechUntil = 0;
let toastTimer;
let saveTimer = 0;
let storageUnavailable = false;
let focusRing = null;
const effects = [];
let perceptionClock = 0;
let pointer = null;
let quest = objective(state);
let points = activePlaces(state);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const images = {};
const loads = [
  'district',
  'iona',
  'items',
  'crossing',
  'lantern',
  'violet',
  'cable',
  'boiler',
  'blind',
  'residents',
].map(
  (name) =>
    new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => {
        images[name] = im;
        resolve();
      };
      im.onerror = reject;
      im.src = `assets/${name}.png`;
    }),
);

const audio = createAudio({ toast });
const { tone, toggleSound } = audio;
const { closeDialog, objectDialog, journalView, mapView, giftView, bagView, helpView } =
  createDialogs({
    getState: () => state,
    getMode: () => mode,
    toggleSound,
    isSoundOn: audio.isSoundOn,
    canvas,
    clearInput: () => keys.clear(),
    perform,
    say,
    toast,
    save,
    setMode,
    goPlace,
    playWork: (id) => audio.playWork(state.continuity.works.find((work) => work.id === id)),
    resetWorld() {
      state = initialState();
      setMode('explore');
      dir = 1;
      nearby = null;
      focusRing = null;
      $('speech').hidden = true;
      save();
      updateUI();
    },
  });

function save() {
  try {
    localStorage.setItem(SAVE, JSON.stringify(state));
    storageUnavailable = false;
  } catch {
    if (!storageUnavailable) toast('Storage unavailable. Progress cannot be saved on this device.');
    storageUnavailable = true;
  }
}
function toast(text) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 4200);
}
function say(text) {
  $('speech').textContent = text;
  $('speech').hidden = false;
  speechUntil = t + 6;
}
function perform(type, payload = {}) {
  const previousZone = state.zone;
  const event = commit(state, type, payload);
  if (!event) return false;
  if (
    [
      'rummage',
      'wind-wire',
      'light-lamp',
      'restore-beacon',
      'repair',
      'deliver-parcel',
      'settle-pressure',
    ].includes(type)
  ) {
    effects.push({
      x: state.x,
      y: state.y,
      time: t,
      color: type === 'restore-beacon' ? '#a8ef9e' : '#efd49b',
    });
    if (effects.length > 12) effects.shift();
  }
  if (previousZone !== state.zone) {
    path = [];
    destination = null;
    nearby = null;
    focusRing = null;
    keys.clear();
    autoWait = 3;
    $('speech').hidden = true;
    toast(sceneOf(state).name);
    $('world').classList.add('arriving');
    setTimeout(() => $('world').classList.remove('arriving'), 350);
  }
  save();
  updateUI();
  if (event.memory) say(event.memory);
  tone(type === 'repair' ? 440 : 330);
  return true;
}
function updateMeters() {
  $('energy').value = state.continuity.energy;
  $('composure').value = 1 - state.continuity.strain;
}

function updateUI() {
  points = activePlaces(state);
  quest = objective(state);
  $('quest-title').textContent = quest.title;
  $('quest-step').textContent = quest.step;
  $('quest-track').title = quest.text;
  $('district-count').textContent = state.city.visited.length;
  $('return-control').hidden = mode === 'explore';
  canvas.setAttribute(
    'aria-label',
    `${sceneOf(state).name}. WASD or arrow keys to move, E to interact, or click a destination.`,
  );
  updateMeters();
}

function setMode(nextMode) {
  mode = nextMode;
  pendingDecision = null;
  path = [];
  destination = null;
  autoWait = 1.5;
  keys.clear();
  $('return-control').hidden = mode === 'explore';
}

function distanceTo(place) {
  return Math.hypot(state.x - place.x, state.y - place.y);
}

function interactWith(id) {
  if (mode !== 'explore') setMode('explore');
  path = [];
  destination = null;
  keys.clear();
  objectDialog(id);
}

function goPlace(id) {
  const p = points[id];
  if (!p) return;
  if (mode === 'explore' && distanceTo(p) < interactionRange) {
    interactWith(id);
    return;
  }
  path = streetRoute(state, p.x, p.y);
  destination = id;
  focusRing = { x: p.x, y: p.y, until: t + 1.4 };
}
function autoAct(id) {
  const d = pendingDecision;
  pendingDecision = null;
  if (d && d.id === id) {
    perform(d.type, d.payload || {});
    autoWait = d.type.startsWith('life-')
      ? 18
      : d.type === 'probe'
        ? 2.5
        : d.type === 'study'
          ? 2
          : 4;
  }
}
function autoStep(dt) {
  if (mode !== 'watch' || path.length || $('dialog').open) return;
  autoWait -= dt;
  if (autoWait > 0) return;
  perceive(state, points);
  const decision = decide(state, points);
  if (!decision) {
    autoWait = 5;
    return;
  }
  rememberDecision(state, decision);
  updateUI();
  if (decision.type === 'pause') {
    pendingDecision = null;
    autoWait = decision.wait || 30;
    return;
  }
  pendingDecision = decision;
  goPlace(decision.id);
  if (!path.length) {
    autoAct(decision.id);
    destination = null;
  }
}
function nearbyPlace() {
  let result = null,
    dist = interactionRange;
  for (const [id, p] of Object.entries(points)) {
    const d = distanceTo(p);
    if (d < dist) {
      dist = d;
      result = id;
    }
  }
  return result;
}
function move(dt) {
  let dx = 0,
    dy = 0,
    distanceLimit = Infinity;
  const input = mode === 'explore' && !$('dialog').open;
  if (input) {
    dx =
      (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
      (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    dy =
      (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
      (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  }
  if (dx || dy) {
    path = [];
    destination = null;
  } else if (path.length) {
    const p = path[0],
      d = Math.hypot(p.x - state.x, p.y - state.y);
    if (d < 4) {
      state.x = p.x;
      state.y = p.y;
      path.shift();
    } else {
      dx = (p.x - state.x) / d;
      dy = (p.y - state.y) / d;
      distanceLimit = d;
    }
  }
  moving = false;
  if (dx || dy) {
    const oldX = state.x;
    const oldY = state.y;
    const l = Math.hypot(dx, dy);
    dx /= l;
    dy /= l;
    const speed = keys.has('shift') ? 235 : 155;
    const step = Math.min(speed * dt, distanceLimit),
      nx = state.x + dx * step,
      ny = state.y + dy * step;
    if (canWalk(state, nx, ny)) {
      state.x = nx;
      state.y = ny;
    } else {
      if (canWalk(state, nx, state.y)) state.x = nx;
      if (canWalk(state, state.x, ny)) state.y = ny;
    }
    dir = Math.abs(dx) > Math.abs(dy) * 1.3 ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2;
    moving = state.x !== oldX || state.y !== oldY;
    if (moving) walkTime += dt * (keys.has('shift') ? 1.4 : 1);
  }
  const place = points[destination];
  const approached = mode === 'explore' && place && !place.exit && distanceTo(place) < 65;
  if (destination && (!path.length || approached) && !$('dialog').open) {
    const id = destination;
    destination = null;
    if (id === 'gift') {
      perform('notice-gift');
      autoWait = 6;
    } else if (mode === 'watch') autoAct(id);
    else if (points[id] && distanceTo(points[id]) < interactionRange) {
      interactWith(id);
    }
  }
  const crossing = crossedExit(state);
  if (crossing) {
    perform('travel:' + points[crossing].dir);
    return;
  }
  nearby = nearbyPlace();
  if (state.gift && !state.gift.noticed && state.elapsed > 5) perform('notice-gift');
}
function resize() {
  width = innerWidth;
  height = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function transform() {
  scale = Math.max(width / W, height / H);
  const ww = W * scale,
    wh = H * scale;
  ox = Math.min(0, Math.max(width - ww, width * 0.5 - state.x * scale));
  oy = Math.min(0, Math.max(height - wh, height * 0.6 - state.y * scale));
}
function screen(x, y) {
  return { x: x * scale + ox, y: y * scale + oy };
}

function draw() {
  transform();
  const hovered = pointer ? placeAt(pointer.x, pointer.y) : null;
  canvas.style.cursor = hovered ? 'pointer' : '';
  const promptId = mode === 'explore' && !$('dialog').open ? nearby : null;
  drawWorld(ctx, {
    state,
    images,
    time: t,
    camera: { width, height, scale, ox, oy },
    points,
    target: quest.target,
    promptId,
    hovered,
    effects,
    reduced,
    focusRing,
    direction: dir,
    moving: moving && !$('dialog').open,
    frame: Math.floor(walkTime * 9) % 4,
  });
  drawMinimap($('minimap'), state, points, quest.target, dir);
  if (!$('speech').hidden) {
    if (t > speechUntil) $('speech').hidden = true;
    else positionBubble($('speech'), state.x, state.y - 123);
  }
  const place = points[promptId];
  $('interact-prompt').hidden = !place;
  if (place) {
    const label = $('interact-label');
    if (label.textContent !== place.verb) label.textContent = place.verb;
    positionBubble(
      $('interact-prompt'),
      place.x,
      place.y - (place.speaker !== undefined ? 117 : 24),
    );
  }
}

function positionBubble(element, x, y) {
  const point = screen(x, y);
  const half = element.offsetWidth / 2 + 8;
  element.style.left = `${Math.max(half, Math.min(width - half, point.x))}px`;
  element.style.top = `${Math.max(element.offsetHeight + 8, Math.min(height - 12, point.y))}px`;
}
function loop(now) {
  const dt = Math.min((now - last) / 1000 || 0, 0.05);
  last = now;
  if (!document.hidden) {
    t += dt;
    advanceContinuity(state, dt);
    if (!$('dialog').open) {
      state.elapsed += dt;
      move(dt);
      perceptionClock += dt;
      if (perceptionClock > 1) {
        perceptionClock = 0;
        perceive(state, points);
      }
      autoStep(dt);
      saveTimer += dt;
      if (saveTimer > 3) {
        saveTimer = 0;
        save();
        updateMeters();
      }
    }
    draw();
  }
  requestAnimationFrame(loop);
}

$('return-control').onclick = () => {
  setMode('explore');
  canvas.focus({ preventScroll: true });
};
$('journal').onclick = () => journalView();
$('help').onclick = () => helpView();
$('close-dialog').onclick = closeDialog;
$('interact').onclick = () => nearby && interactWith(nearby);
$('quest-track').onclick = () => {
  if (mode === 'watch') setMode('explore');
  goPlace(quest.target);
  if (!$('dialog').open) canvas.focus({ preventScroll: true });
};
$('minimap-panel').onclick = mapView;

function placeAt(clientX, clientY) {
  const x = (clientX - ox) / scale;
  const y = (clientY - oy) / scale;
  let result = null;
  let distance = 45;
  for (const [id, p] of Object.entries(points)) {
    const speaker = p.speaker !== undefined;
    const centerY = p.y - (speaker ? 63 : 24);
    const d = Math.hypot(x - p.x, (y - centerY) * (speaker ? 0.55 : 1));
    if (d < distance) {
      result = id;
      distance = d;
    }
  }
  return result;
}

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'touch') pointer = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerleave', () => (pointer = null));
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || $('dialog').open) return;
  if (mode === 'watch') setMode('explore');
  canvas.focus({ preventScroll: true });
  const hit = placeAt(event.clientX, event.clientY);
  if (hit) {
    goPlace(hit);
    return;
  }
  const x = (event.clientX - ox) / scale;
  const y = (event.clientY - oy) / scale;
  path = streetRoute(state, x, y);
  destination = null;
  const end = path.at(-1);
  focusRing = end ? { ...end, until: t + 1.1 } : null;
});
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if ($('dialog').open || e.ctrlKey || e.metaKey || e.altKey) return;
  if (movementKeys.has(key)) {
    e.preventDefault();
    if (mode === 'watch') setMode('explore');
    path = [];
    destination = null;
    focusRing = null;
    keys.add(key);
    canvas.focus({ preventScroll: true });
  }
  if (e.repeat) return;
  if (key === 'shift') keys.add(key);
  if (key === 'e') {
    const id = nearbyPlace();
    if (id) interactWith(id);
  }
  if (key === 'j') journalView();
  if (key === 'm') mapView();
  if (key === 'b') bagView();
  if (key === 'g') giftView();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => {
  keys.clear();
  save();
});
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => {
  keys.clear();
  last = performance.now();
  if (document.hidden) {
    save();
    audio.suspend();
  } else {
    advanceContinuity(state);
    updateUI();
    if (state.continuity.returnGap > 300) {
      toast('Time has passed. Her unfinished thoughts are still here.');
      state.continuity.returnGap = 0;
    }
    audio.resume();
  }
});
window.addEventListener('resize', resize);
$('dialog').addEventListener('close', () => keys.clear());
Promise.all(loads)
  .then(() => {
    resize();
    perceive(state, points);
    nearby = nearbyPlace();
    updateUI();
    draw();
    $('loading').style.opacity = '0';
    $('loading').style.pointerEvents = 'none';
    setTimeout(() => $('loading').remove(), reduced ? 0 : 230);
    requestAnimationFrame(loop);
    if (state.continuity.returnGap > 300) {
      toast('Welcome back. Her memories and unfinished work are still here.');
      state.continuity.returnGap = 0;
    }
  })
  .catch(() => {
    $('loading').innerHTML = html`<h1>The lanes couldn’t load.</h1>
      <p>One of the art files is missing. Please reload to try again.</p>
      <button onclick="location.reload()">Reload</button>`;
  });
