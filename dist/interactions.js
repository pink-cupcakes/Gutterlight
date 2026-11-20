import { appendEvent, scenes } from './city.js';
export const interactables = {
  district: {
    scrap: {
      x: 700,
      y: 580,
      name: 'Discarded fittings',
      verb: 'Look through the fittings',
      kind: 'scrap',
    },
    benchwork: {
      x: 970,
      y: 565,
      name: 'Winding bench',
      verb: 'Examine the bench',
      kind: 'workbench',
    },
  },
  crossing: {
    scrap: {
      x: 560,
      y: 550,
      name: 'Broken pipe coupling',
      verb: 'Examine the coupling',
      kind: 'scrap',
    },
  },
  lantern: {
    lamp: { x: 840, y: 705, name: 'Unlit street lamp', verb: 'Examine the lamp', kind: 'lamp' },
    scrap: { x: 1250, y: 555, name: 'Abandoned crate', verb: 'Search the crate', kind: 'scrap' },
  },
  boiler: {
    regulator: {
      x: 1090,
      y: 590,
      name: 'Shuddering regulator',
      verb: 'Listen to the regulator',
      kind: 'regulator',
    },
  },
  cable: {
    beacon: {
      x: 1160,
      y: 520,
      name: 'Silent signal mast',
      verb: 'Examine the mast',
      kind: 'beacon',
    },
  },
  blind: {
    scrap: {
      x: 650,
      y: 620,
      name: 'Bent copper fittings',
      verb: 'Examine the fittings',
      kind: 'scrap',
    },
  },
};
export function freshLife() {
  return {
    scrap: 0,
    wire: 0,
    looted: [],
    lamp: false,
    stable: false,
    beacon: false,
    coilUsed: false,
    parcel: false,
    promised: false,
    delivered: false,
    intake: 2,
    vent: 5,
    pressure: 5,
    trials: [],
    skills: ['Notice'],
    signalAt: null,
  };
}
export function freshMind() {
  return {
    known: {},
    studied: [],
    routes: {},
    notes: [],
    intent: 'There is a sound beneath the usual noise.',
    evidence: '',
    lastDecision: '',
    links: [],
  };
}
export const objectKey = (zone, id) => zone + ':' + id;
export function note(state, text, kind = 'observation') {
  if (state.mind.notes.some((n) => n.text === text)) return;
  state.mind.notes.push({ text, kind, time: state.elapsed });
  if (state.mind.notes.length > 100) state.mind.notes.shift();
}
export function skill(state, name, evidence) {
  if (state.life.skills.includes(name)) return;
  state.life.skills.push(name);
  note(state, evidence, 'skill');
}
export function integrateOutcome(state, e) {
  if (!e) return;
  if (e.type === 'inspect' || state.stage >= 1)
    skill(
      state,
      'Mechanics',
      'A missing tooth interrupts a repeating motion. I can follow a mechanism from one part to the next.',
    );
  if (state.city.talked.includes('crossing'))
    skill(
      state,
      'Listening',
      'Orin distinguishes the sound of a loaded pipe from an empty one. I tried listening for it.',
    );
  if (state.city.recovered && state.life.skills.includes('Listening')) {
    skill(
      state,
      'Resonance',
      'The recovered coil vibrates like the pipes. Listening and recognizing its structure might let me tune it.',
    );
  }
  if (e.type === 'talk' && state.zone === 'violet')
    note(state, 'Ves strips the cloth from old wire and winds the copper back into place.');
}
export function perceive(state, points) {
  state.mind.routes[state.zone] = Object.fromEntries(
    Object.values(points)
      .filter((p) => p.exit)
      .map((p) => [p.dir, p.to]),
  );
  for (const [id, p] of Object.entries(points)) {
    if (p.exit) continue;
    const key = objectKey(state.zone, id);
    if (!state.mind.known[key])
      state.mind.known[key] = {
        zone: state.zone,
        id,
        name: p.name,
        x: p.x,
        y: p.y,
        kind: p.kind || (id === 'npc' ? 'person' : id),
      };
  }
}
export function pressure(intake, vent) {
  return 20 + 10 * intake - 7 * vent;
}
export function studied(state, zone, id) {
  return state.mind.studied.includes(objectKey(zone, id));
}
export function lifeAction(state, type, payload, points) {
  const point = (id) =>
    points[id] && Math.hypot(state.x - points[id].x, state.y - points[id].y) < 90;
  const l = state.life;
  let text = '',
    memory = '';
  if (type === 'study' && point(payload.id)) {
    const id = payload.id,
      key = objectKey(state.zone, id);
    if (state.mind.studied.includes(key)) return null;
    state.mind.studied.push(key);
    const p = points[id];
    const details = {
      pump: 'There is a gap in the gear. The knock comes around with it.',
      market: 'An eight-tooth gear is lying in the shared tray.',
      tank: 'The gauge trembles whenever the pump catches.',
      gate: 'A pressure line runs from the condenser to the freight winch.',
      bench: 'The seat is warm from the lantern above it.',
      scrap: 'The fittings are bent, but the copper inside still has some give.',
      benchwork: 'There are grooves for drawing copper thin, and a spindle for winding it.',
      lamp: 'The glass is sound. Inside the lamp, the conductor has snapped.',
      regulator: 'Two wheels change the hiss differently. A worn green band remains on the gauge.',
      beacon:
        'The empty mast has a coil-shaped cradle and two bare terminals. A pipe reaches it from the boiler court.',
      cache: 'The copper coil rings faintly when touched.',
      latch: 'The bolt can be lifted from this side.',
      npc:
        state.zone === 'lantern'
          ? 'Mara is turning a small wrapped fuse over in her hands.'
          : state.zone === 'cable'
            ? 'Edda keeps checking a dark lamp and an empty fuse holder.'
            : 'They seem to know the sounds and habits of this street.',
    };
    memory = details[id] || 'There are signs of work here, unfinished rather than abandoned.';
    text = `Iona examined ${p.name.toLowerCase()}.`;
    if (state.mind.known[key]) state.mind.known[key].observation = memory;
    note(state, memory);
    if (id === 'scrap')
      skill(
        state,
        'Salvaging',
        'The shape is ruined, but the material still has uses. I can separate them.',
      );
  } else if (
    type === 'rummage' &&
    point('scrap') &&
    studied(state, state.zone, 'scrap') &&
    !l.looted.includes(state.zone)
  ) {
    l.looted.push(state.zone);
    l.scrap += 2;
    text = 'Iona recovered two lengths of workable copper from the discarded fittings.';
    memory = 'Not rubbish. Just the wrong shape for its last job.';
  } else if (
    type === 'wind-wire' &&
    state.zone === 'district' &&
    point('benchwork') &&
    studied(state, 'district', 'benchwork') &&
    l.scrap >= 2 &&
    l.skills.includes('Mechanics') &&
    l.skills.includes('Salvaging')
  ) {
    l.scrap -= 2;
    l.wire += 2;
    skill(
      state,
      'Wiring',
      'Salvaging found the copper. Mechanics showed how to draw and wind it into a conductor.',
    );
    text = 'Iona drew the salvaged copper into two coils of wire at the winding bench.';
    memory = 'Two things I knew separately turned into something I could use.';
  } else if (
    type === 'light-lamp' &&
    state.zone === 'lantern' &&
    point('lamp') &&
    l.wire >= 1 &&
    l.skills.includes('Wiring') &&
    !l.lamp
  ) {
    l.wire--;
    l.lamp = true;
    text = 'Iona bridged the broken conductor. The street lamp flickered, then held its light.';
    memory = 'There. A little less darkness for whoever comes through next.';
  } else if (type === 'accept-parcel' && state.zone === 'lantern' && point('npc') && !l.promised) {
    l.promised = true;
    l.parcel = true;
    text = 'Iona accepted Mara’s wrapped fuse, meant for Edda.';
    memory = 'I said I’d keep an eye out for her. Now it matters that I do.';
  } else if (
    type === 'deliver-parcel' &&
    state.zone === 'cable' &&
    point('npc') &&
    l.parcel &&
    !l.delivered
  ) {
    l.parcel = false;
    l.delivered = true;
    l.scrap += 2;
    text =
      'Iona handed Mara’s fuse to Edda. The cable-side lamp came on; Edda shared some spare copper.';
    memory = 'The thing in my pocket was the thing missing from someone else’s evening.';
  } else if (
    type === 'probe' &&
    state.zone === 'boiler' &&
    point('regulator') &&
    !l.stable &&
    studied(state, 'boiler', 'regulator') &&
    Number.isInteger(payload.intake) &&
    Number.isInteger(payload.vent) &&
    payload.intake >= 0 &&
    payload.intake <= 6 &&
    payload.vent >= 0 &&
    payload.vent <= 6
  ) {
    if (l.trials.some((t) => t.intake === payload.intake && t.vent === payload.vent)) return null;
    l.intake = payload.intake;
    l.vent = payload.vent;
    l.pressure = pressure(l.intake, l.vent);
    l.trials.push({ intake: l.intake, vent: l.vent, pressure: l.pressure });
    text = `Iona tried the regulator at ${l.intake} / ${l.vent}. The gauge settled at ${l.pressure}.`;
    memory =
      l.trials.length === 1 ? 'That changed the sound. I should change one wheel at a time.' : '';
    note(state, `Regulator ${l.intake} / ${l.vent}: gauge ${l.pressure}.`, 'experiment');
  } else if (
    type === 'settle-pressure' &&
    state.zone === 'boiler' &&
    point('regulator') &&
    !l.stable &&
    l.pressure >= 55 &&
    l.pressure <= 60 &&
    l.trials.length > 0 &&
    l.skills.includes('Mechanics') &&
    l.skills.includes('Listening')
  ) {
    l.stable = true;
    text =
      'Iona secured the regulator where its rhythm steadied. The leaking steam thinned and the flywheel began to turn.';
    memory = 'The needle was close. The sound told me when it was right.';
  } else if (
    type === 'restore-beacon' &&
    state.zone === 'cable' &&
    point('beacon') &&
    studied(state, 'cable', 'beacon') &&
    !l.beacon &&
    l.stable &&
    state.city.recovered &&
    !l.coilUsed &&
    l.wire >= 1 &&
    ['Mechanics', 'Wiring', 'Resonance'].every((k) => l.skills.includes(k))
  ) {
    l.wire--;
    l.coilUsed = true;
    l.beacon = true;
    l.signalAt = state.elapsed;
    text =
      'Iona joined the recovered coil to the mast, wired it, and tuned it to the pressure line. A green signal swept across the hanging streets.';
    memory = 'It wasn’t one answer. It was several small things that finally belonged together.';
  } else return null;
  state.mood = type === 'probe' ? 'Testing' : type === 'study' ? 'Curious' : 'Absorbed';
  const e = appendEvent(state, type, text, memory);
  integrateOutcome(state, e);
  return e;
}
export function practicalOptions(state, id) {
  const l = state.life,
    options = [];
  if (!studied(state, state.zone, id))
    return [{ label: 'Look more closely', type: 'study', payload: { id } }];
  if (id === 'scrap' && !l.looted.includes(state.zone))
    options.push({ label: 'Separate the usable copper', type: 'rummage' });
  if (id === 'benchwork') options.push({ label: 'Try drawing a conductor', type: 'wind-wire' });
  if (id === 'lamp' && !l.lamp)
    options.push({ label: 'Bridge the broken conductor', type: 'light-lamp' });
  if (id === 'beacon' && !l.beacon)
    options.push({ label: 'Try the coil in the cradle', type: 'restore-beacon' });
  return options;
}
export function unmet(state, type) {
  const l = state.life;
  if (type === 'wind-wire') {
    if (l.scrap < 2) return 'There is not enough workable copper here.';
    return 'I need to understand both the material and the mechanism.';
  }
  if (type === 'light-lamp') return 'I need a conductor I can work with.';
  if (type === 'restore-beacon') {
    if (!state.city.recovered || l.coilUsed)
      return 'The empty cradle needs something that can resonate.';
    if (!l.stable) return 'The pressure line is still coughing. This will not hold a steady note.';
    if (!l.wire) return 'The terminals are bare. The circuit is still open.';
    return 'I can see the pieces, but I don’t yet know how to tune them together.';
  }
  if (type === 'settle-pressure')
    return l.pressure < 55 || l.pressure > 60
      ? 'The rhythm still catches.'
      : 'I can read the needle, but I need to understand what I am hearing.';
  return 'That does not seem to change anything yet.';
}
