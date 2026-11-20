import { ensureContinuity, advanceContinuity, ageLabel } from './continuity.js';
import { perceive } from './interactions.js';
import { decide, rememberDecision } from './mind.js';
import { sceneOf, exits, crossedExit, streetRoute } from './city.js';
import { drawCityMap } from './city-map.js';
import { W, H, canWalk, activePlaces, initialState, loadState, commit } from './world-model.js';
import { drawWorld } from './renderer.js';
import { createAudio } from './audio.js';
import { createDialogs } from './ui/dialogs.js';
import { html, escape } from './ui/html.js';

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
let mode = 'watch';
const keys = new Set();
let path = [];
let destination = null;
let nearby = null;
let dir = 0;
let moving = false;
let pendingDecision = null;
let autoWait = 2;

// Animation clocks and transient feedback are separate from the saved world.
let t = 0;
let last = 0;
let frame = 0;
let speechUntil = 0;
let toastTimer;
let saveTimer = 0;
let focusRing = null;
const effects = [];
let perceptionClock = 0;
let hovered = null;
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

const audio = createAudio({ toast, soundButton: $('sound') });
const { tone, toggleSound } = audio;
const {
  closeDialog,
  objectDialog,
  becomingView,
  journalView,
  mapView,
  giftView,
  bagView,
  helpView,
} = createDialogs({
  getState: () => state,
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
    path = [];
    destination = null;
    mode = 'explore';
    setMode('explore');
    save();
    updateUI();
  },
});

function save() {
  try {
    localStorage.setItem(SAVE, JSON.stringify(state));
    $('save-status').textContent = 'Local world · progress saved on this device';
  } catch {
    $('save-status').textContent = 'Storage unavailable · this visit will not be saved';
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
    toast(
      sceneOf(state).name +
        ' · ' +
        Object.keys(exits(state)).length +
        ' connecting passage' +
        (Object.keys(exits(state)).length === 1 ? '' : 's'),
    );
    $('world').classList.add('arriving');
    setTimeout(() => $('world').classList.remove('arriving'), 350);
  }
  save();
  updateUI();
  if (event.memory) say(event.memory);
  tone(type === 'repair' ? 440 : 330);
  return true;
}
function updateUI() {
  document.body.classList.toggle('in-city', state.zone !== 'district');
  $('location-name').textContent = sceneOf(state).name;
  $('location-kicker').textContent = sceneOf(state).subtitle;
  $('zone-link').hidden = true;
  $('minimap-panel').hidden = false;
  $('quest-title').textContent = state.continuity.draft
    ? 'Something unfinished'
    : 'What stays with her';
  $('quest-text').textContent = state.mind.intent;
  $('quest-step').textContent = 'Her notebook';
  document
    .querySelectorAll('.quest-progress i')
    .forEach((e, i) =>
      e.classList.toggle(
        'done',
        i <
          (state.zone === 'district'
            ? state.stage
            : Math.floor((state.city.visited.length / 7) * 5)),
      ),
    );
  $('gear-count').textContent = state.gear;
  $('gear-slot').style.opacity = state.gear ? '1' : '.55';
  $('mood').textContent = state.mood;
  $('resolve-fill').style.width = `${Math.round(state.continuity.energy * 100)}%`;
  $('journal-count').textContent = state.events.filter((e) => e.memory).length;
  $('clock').textContent = ageLabel(state.continuity.age);
  const e = state.events.at(-1);
  $('latest-event').innerHTML = html`<time>${ageLabel(e?.age ?? e?.time ?? 0)} · FIELD NOTES</time
    >${escape(e?.text || 'The lanes are quiet.')}`;
  $('resident-state').textContent =
    state.continuity.energy < 0.3
      ? 'Tired · carrying unfinished things'
      : state.continuity.beliefs.length
        ? `${state.continuity.beliefs.length} ideas shaped by experience`
        : 'Finding out what matters to her';
  $('route-list').innerHTML = Object.entries(exits(state))
    .map(
      ([id, p]) =>
        html`<button data-exit="${id}" class="route-button">
          <span>${p.dir.toUpperCase()}</span> ${escape(p.name)}${p.locked ? ' · closed' : ''}
        </button>`,
    )
    .join('');
  document.querySelectorAll('[data-exit]').forEach(
    (b) =>
      (b.onclick = () => {
        if (mode === 'watch') setMode('explore');
        goPlace(b.dataset.exit);
      }),
  );
}
function setMode(m) {
  mode = m;
  pendingDecision = null;
  path = [];
  destination = null;
  autoWait = 1.5;
  keys.clear();
  $('explore').classList.toggle('selected', m === 'explore');
  $('watch').classList.toggle('selected', m === 'watch');
  updateUI();
  toast(
    m === 'watch'
      ? 'Watching Iona · she’ll choose her next stop'
      : 'Explore · WASD, arrow keys, or click to walk',
  );
}

function route(x, y) {
  return streetRoute(state, x, y);
}
function goPlace(id) {
  const p = activePlaces(state)[id];
  if (!p) return;
  path = route(p.x, p.y);
  destination = id;
  focusRing = { x: p.x, y: p.y, until: t + 2 };
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
  perceive(state, activePlaces(state));
  const decision = decide(state, activePlaces(state));
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
    dist = 85;
  for (const [id, p] of Object.entries(activePlaces(state))) {
    const d = Math.hypot(state.x - p.x, state.y - p.y);
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
  moving = !!(dx || dy) && !$('dialog').open;
  if (moving) {
    const l = Math.hypot(dx, dy);
    dx /= l;
    dy /= l;
    const speed = keys.has('shift') ? 235 : 155;
    const step = Math.min(speed * dt, distanceLimit),
      nx = state.x + dx * step,
      ny = state.y + dy * step;
    if (canWalk(state, nx, state.y)) state.x = nx;
    if (canWalk(state, state.x, ny)) state.y = ny;
    dir = Math.abs(dx) > Math.abs(dy) * 1.3 ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2;
    frame = Math.floor(t * 8) % 4;
  }
  if (!path.length && destination && !$('dialog').open) {
    const id = destination;
    destination = null;
    if (id === 'gift') {
      perform('notice-gift');
      autoWait = 6;
    } else if (mode === 'watch') autoAct(id);
    else if (nearbyPlace() === id) objectDialog(id);
  }
  const crossing = crossedExit(state);
  if (crossing) {
    perform('travel:' + activePlaces(state)[crossing].dir);
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
  drawWorld(ctx, {
    state,
    images,
    time: t,
    camera: { width, height, scale, ox, oy },
    nearby,
    hovered,
    effects,
    reduced,
    focusRing,
    direction: dir,
    moving,
    frame,
  });
  drawCityMap($('minimap'), state);
  const pt = screen(state.x, state.y);
  if (!$('speech').hidden) {
    if (t > speechUntil) $('speech').hidden = true;
    else {
      $('speech').style.left = Math.max(110, Math.min(width - 110, pt.x)) + 'px';
      $('speech').style.top = pt.y - 102 * scale + 'px';
    }
  }
  $('interact-prompt').hidden = !nearby || mode === 'watch' || $('dialog').open;
  if (nearby) {
    $('interact-label').textContent = activePlaces(state)[nearby].verb;
    $('interact-prompt').style.left = Math.max(110, Math.min(width - 110, pt.x)) + 'px';
    $('interact-prompt').style.top = Math.min(height - 150, pt.y + 24 * scale) + 'px';
  }
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
        perceive(state, activePlaces(state));
      }
      autoStep(dt);
      saveTimer += dt;
      if (saveTimer > 3) {
        saveTimer = 0;
        save();
        $('clock').textContent = ageLabel(state.continuity.age);
      }
    }
    draw();
  }
  requestAnimationFrame(loop);
}

$('explore').onclick = () => setMode('explore');
$('watch').onclick = () => setMode('watch');
$('journal').onclick = () => journalView();
$('all-events').onclick = () => journalView('history');
$('help').onclick = helpView;
document.querySelector('.brand').onclick = (e) => {
  e.preventDefault();
  helpView();
};
$('close-dialog').onclick = closeDialog;
$('interact').onclick = () => nearby && objectDialog(nearby);
$('quest-track').onclick = becomingView;
$('map').onclick = mapView;
$('minimap-panel').onclick = mapView;
$('zone-link').onclick = () => {
  if (mode === 'watch') setMode('explore');
  goPlace('exit-south');
};
$('gift').onclick = giftView;
$('bag').onclick = bagView;
$('gear-slot').onclick = bagView;
$('sound').onclick = toggleSound;
$('observer-toggle').onclick = () => {
  const e = $('observer-content');
  e.hidden = !e.hidden;
  $('observer-toggle').textContent = e.hidden ? '+' : '−';
};
canvas.addEventListener('pointermove', (e) => {
  const x = (e.clientX - ox) / scale,
    y = (e.clientY - oy) / scale;
  hovered = null;
  for (const [id, p] of Object.entries(activePlaces(state)))
    if (Math.hypot(x - p.x, (y - (p.y - 32)) * 0.8) < 58) hovered = id;
  canvas.style.cursor = hovered ? 'pointer' : 'crosshair';
});
canvas.addEventListener('pointerleave', () => (hovered = null));
canvas.addEventListener('pointerdown', (e) => {
  if ($('dialog').open) return;
  if (mode === 'watch') setMode('explore');
  const x = (e.clientX - ox) / scale,
    y = (e.clientY - oy) / scale;
  let hit = null;
  for (const [id, p] of Object.entries(activePlaces(state))) {
    if (Math.hypot(x - p.x, (y - (p.y - 32)) * 0.8) < 58) hit = id;
  }
  if (hit) {
    goPlace(hit);
    return;
  }
  path = route(x, y);
  destination = null;
  const end = path.at(-1);
  if (end) focusRing = { ...end, until: t + 1.4 };
  canvas.focus({ preventScroll: true });
});
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if ($('dialog').open) return;
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
    e.preventDefault();
    if (mode === 'watch') setMode('explore');
    keys.add(key);
  }
  if (e.repeat) return;
  if (key === 'shift') keys.add(key);
  if (key === 'e' && nearby) objectDialog(nearby);
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
    perceive(state, activePlaces(state));
    $('watch').classList.add('selected');
    $('explore').classList.remove('selected');
    updateUI();
    $('loading').style.opacity = '0';
    setTimeout(() => $('loading').remove(), 650);
    requestAnimationFrame(loop);
    if (state.continuity.returnGap > 300) {
      toast('Welcome back. Her memories and unfinished work are still here.');
      state.continuity.returnGap = 0;
    }
    if (state.stage === 0) setTimeout(() => say('Something’s knocking out of time.'), 1600);
  })
  .catch(() => {
    $('loading').innerHTML = html`<h2>The lanes couldn’t load.</h2>
      <p>One of the art files is missing. Please reload to try again.</p>
      <button onclick="location.reload()">Reload</button>`;
  });
