import {
  freshContinuity,
  ensureContinuity,
  observeOutcome,
  continuityAction,
} from './continuity.js';
import {
  interactables,
  freshLife,
  freshMind,
  lifeAction,
  integrateOutcome,
  perceive,
} from './interactions.js';
import {
  freshCity,
  scenes,
  safePosition,
  sceneWalkable,
  exits,
  locals,
  travel,
  cityObjective,
} from './city.js';
export const W = 1672,
  H = 941;
export const places = {
  pump: { x: 1290, y: 580, name: 'Brass pump', verb: 'Inspect pump', icon: '◇' },
  market: {
    x: 1295,
    y: 482,
    name: 'Scrap broker',
    verb: 'Talk to the scrap broker',
    speaker: 2,
    quote:
      'If you need a part, try the scrap tray. Leave anything you can’t use for the next pair of hands.',
  },
  tank: { x: 485, y: 482, name: 'Moss condenser', verb: 'Inspect condenser', icon: '✧' },
  gate: { x: 1060, y: 410, name: 'Freight winch', verb: 'Inspect freight winch', icon: '⌑' },
  stairs: { x: 890, y: 907, name: 'Sump Crossing', verb: 'Continue to Sump Crossing', icon: '⌄' },
  bench: { x: 417, y: 566, name: 'Lantern corner', verb: 'Take a quiet moment', icon: '☾' },
};
export const boundary = [
  [550, 440],
  [1110, 340],
  [1270, 430],
  [1500, 510],
  [1500, 570],
  [1090, 655],
  [1060, 941],
  [710, 941],
  [730, 660],
  [270, 600],
  [340, 540],
  [485, 480],
];
export function walkable(x, y) {
  let c = false;
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const a = boundary[i],
      b = boundary[j];
    if (a[1] > y != b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
export function canWalk(state, x, y) {
  return sceneWalkable(state.zone, x, y);
}
export function activePlaces(state) {
  return {
    ...(state.zone === 'district'
      ? Object.fromEntries(Object.entries(places).filter(([id]) => id !== 'stairs'))
      : locals[state.zone] || {}),
    ...interactables[state.zone],
    ...exits(state),
  };
}
export function initialState() {
  return {
    version: 1,
    zone: 'district',
    city: freshCity(),
    life: freshLife(),
    mind: freshMind(),
    continuity: freshContinuity(),
    x: 820,
    y: 550,
    stage: 0,
    gear: 0,
    elapsed: 0,
    mood: 'Curious',
    gift: null,
    visits: {},
    events: [
      {
        id: 1,
        time: 0,
        type: 'arrival',
        text: 'Iona arrived in the Foundry Lanes. The lamps were already lit.',
        memory: 'Everything here has been mended at least once. I think I’ll fit in.',
      },
    ],
  };
}
export function clock(seconds = 0) {
  const min = 18 * 60 + 42 + Math.floor(seconds / 12);
  return `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
export function loadState(raw) {
  try {
    const state = JSON.parse(raw);
    if (
      state.version !== 1 ||
      !Number.isInteger(state.stage) ||
      state.stage < 0 ||
      state.stage > 5 ||
      !Number.isFinite(state.x) ||
      !Number.isFinite(state.y) ||
      !Array.isArray(state.events) ||
      !Number.isFinite(state.elapsed) ||
      state.elapsed < 0
    )
      return initialState();
    const b = initialState();
    const oldMaze = state.zone === 'maze';
    const result = {
      ...b,
      ...state,
      zone: oldMaze ? 'crossing' : scenes[state.zone] ? state.zone : 'district',
      gear: state.stage === 2 ? 1 : 0,
      city: { ...freshCity(), ...state.city },
      life: { ...freshLife(), ...state.life },
      mind: { ...freshMind(), ...state.mind },
      events: state.events
        .filter(
          (e) =>
            e &&
            typeof e.text === 'string' &&
            typeof e.memory === 'string' &&
            Number.isFinite(e.time),
        )
        .slice(-150),
      visits: state.visits && typeof state.visits === 'object' ? state.visits : {},
    };
    result.city.visited = [
      ...new Set([
        'district',
        ...(Array.isArray(result.city.visited) ? result.city.visited : []),
        result.zone,
      ]),
    ].filter((id) => scenes[id]);
    result.city.talked = Array.isArray(result.city.talked) ? result.city.talked : [];
    if (state.maze?.recovered) result.city.recovered = true;
    delete result.maze;
    if (oldMaze || !canWalk(result, result.x, result.y)) {
      Object.assign(result, safePosition(result.zone));
    }
    if (!result.events.length) result.events = b.events;
    for (const k of ['scrap', 'wire'])
      if (!Number.isInteger(result.life[k]) || result.life[k] < 0) result.life[k] = 0;
    for (const k of ['looted', 'skills', 'trials'])
      if (!Array.isArray(result.life[k])) result.life[k] = freshLife()[k];
    for (const k of ['studied', 'notes']) if (!Array.isArray(result.mind[k])) result.mind[k] = [];
    for (const k of ['known', 'routes'])
      if (!result.mind[k] || typeof result.mind[k] !== 'object') result.mind[k] = {};
    integrateOutcome(result, { type: 'restore' });
    if (!state.continuity) delete result.continuity;
    ensureContinuity(result);
    return result;
  } catch {
    return initialState();
  }
}
function commitBase(state, type) {
  if (type.startsWith('travel:')) return travel(state, type.slice(7));
  let text = '',
    memory = '',
    mood = state.mood;
  const near = (id) =>
    state.zone === 'district' && Math.hypot(state.x - places[id].x, state.y - places[id].y) < 85;
  const localNear = (id) =>
    locals[state.zone]?.[id] &&
    Math.hypot(state.x - locals[state.zone][id].x, state.y - locals[state.zone][id].y) < 90;
  if (type === 'talk' && localNear('npc') && !state.city.talked.includes(state.zone)) {
    state.city.talked.push(state.zone);
    text = `Iona spoke with ${locals[state.zone].npc.name.split(' · ')[0]} in ${scenes[state.zone].name}.`;
    memory = locals[state.zone].npc.quote;
    mood = 'Interested';
  } else if (
    type === 'unlatch' &&
    state.zone === 'boiler' &&
    localNear('latch') &&
    !state.city.shortcut
  ) {
    state.city.shortcut = true;
    text =
      'Iona lifted the service-gate bolt, opening a shortcut between Boiler Court and Cable Walk.';
    memory = 'Now I can take the hanging street straight to the boilers. One less long way around.';
    mood = 'Resourceful';
  } else if (
    type === 'recover' &&
    state.zone === 'blind' &&
    localNear('cache') &&
    !state.city.recovered
  ) {
    state.city.recovered = true;
    text = 'Iona found a resonance coil in the discarded case at Cinder End.';
    memory = 'The street went nowhere, but someone left something worth finding.';
    mood = 'Delighted';
  } else if (type === 'inspect' && state.stage === 0 && near('pump')) {
    state.stage = 1;
    text = 'Iona traced the pump’s uneven rhythm to a cracked drive gear.';
    memory =
      'It still moves a little water. But every third turn, it catches. I know that feeling.';
    mood = 'Intrigued';
  } else if (type === 'take-gear' && state.stage === 1 && near('market')) {
    state.stage = 2;
    state.gear = 1;
    text = 'Iona found a sound brass gear in the market’s communal scrap tray.';
    memory = 'Someone left exactly what I needed. I should leave something useful here, too.';
    mood = 'Hopeful';
  } else if (type === 'repair' && state.stage === 2 && state.gear === 1 && near('pump')) {
    state.stage = 3;
    state.gear = 0;
    text = 'Iona fitted the replacement gear. The pump found a steady rhythm again.';
    memory = 'That’s better. Such a small piece, to make that much difference.';
    mood = 'Relieved';
  } else if (type === 'balance' && state.stage === 3 && near('tank')) {
    state.stage = 4;
    text = 'Iona balanced the condenser valve. Power returned to the old freight winch.';
    memory = 'The pipes all lead somewhere. Perhaps nothing here is really on its own.';
    mood = 'Proud';
  } else if (type === 'workshop' && state.stage === 4 && near('gate')) {
    state.stage = 5;
    text = 'Iona restarted the freight winch. The hanging cage rose through the green haze.';
    memory = 'There are whole streets below these streets. I want to see where the stairs go.';
    mood = 'Adventurous';
  } else if (type === 'revisit' && state.stage >= 3 && near('pump') && !state.visits.pumpReturn) {
    state.visits.pumpReturn = true;
    text = 'Iona returned to the pump she repaired and listened to it for a while.';
    memory =
      'I came back to check. It’s still turning. I didn’t realize how much that mattered to me.';
    mood = 'Reassured';
  } else if (type === 'rest' && near('bench')) {
    if (state.visits.rest && state.elapsed - state.visits.rest < 30) return null;
    state.visits.rest = state.elapsed || 0.01;
    text = 'Iona sat beneath the lantern and watched the evening gather in the lanes.';
    memory =
      state.stage >= 3
        ? 'The pump sounds different from here. Less like a machine. More like company.'
        : 'I keep wondering who lit all these lamps. Maybe tomorrow I’ll find out.';
    mood = 'Reflective';
  } else if (type === 'gift' && !state.gift && state.zone === 'district') {
    state.gift = { x: state.x + 28, y: state.y, noticed: false };
    text = 'A visitor left a small tin of luminous moss in the lanes.';
    memory = '';
  } else if (
    type === 'notice-gift' &&
    state.zone === 'district' &&
    state.gift &&
    !state.gift.noticed &&
    Math.hypot(state.x - state.gift.x, state.y - state.gift.y) < 100
  ) {
    state.gift.noticed = true;
    text = 'Iona noticed the visitor’s moss cutting and decided to look after it.';
    memory = 'Someone wanted this little thing to keep growing. I can help with that.';
    mood = 'Touched';
  } else return null;
  state.mood = mood;
  const e = { id: (state.events.at(-1)?.id || 0) + 1, time: state.elapsed, type, text, memory };
  state.events.push(e);
  if (state.events.length > 150) state.events.shift();
  return e;
}
export function objective(state) {
  if (state.zone !== 'district') return cityObjective(state);
  return [
    {
      title: 'A heart out of rhythm',
      text: 'The old pump is making a sound Iona hasn’t heard before.',
      step: 'Investigate the brass pump',
      target: 'pump',
    },
    {
      title: 'One good tooth',
      text: 'A cracked gear. Somewhere in this district, there must be a spare.',
      step: 'Find the scrap broker',
      target: 'market',
    },
    {
      title: 'Something worth mending',
      text: 'The brass gear fits in her palm. Time to give it a purpose.',
      step: 'Repair the old pump',
      target: 'pump',
    },
    {
      title: 'Follow the green light',
      text: 'The pump is steady. The condenser needs its pressure balanced.',
      step: 'Balance the condenser',
      target: 'tank',
    },
    {
      title: 'The city keeps moving',
      text: 'The repaired circuit has brought the old freight winch back to life.',
      step: 'Start the freight winch',
      target: 'gate',
    },
    {
      title: 'Below the lanes',
      text: 'The southern stairs lead to branching streets and bridges. There is more city beneath your feet.',
      step: 'Continue to Sump Crossing',
      target: 'exit-south',
    },
  ][state.stage];
}

export function commit(state, type, payload = {}) {
  ensureContinuity(state);
  const points = activePlaces(state);
  perceive(state, points);
  const extended = [
    'study',
    'rummage',
    'wind-wire',
    'light-lamp',
    'accept-parcel',
    'deliver-parcel',
    'probe',
    'settle-pressure',
    'restore-beacon',
  ];
  const event = type.startsWith('life-')
    ? continuityAction(state, type, payload, points)
    : extended.includes(type)
      ? lifeAction(state, type, payload, points)
      : commitBase(state, type);
  integrateOutcome(state, event);
  observeOutcome(state, event);
  return event;
}
