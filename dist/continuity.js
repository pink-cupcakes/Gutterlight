import { appendEvent, locals } from './city.js';
const HOUR = 3600,
  DAY = 24 * HOUR;
export const residentNames = { crossing: 'Orin', lantern: 'Mara', violet: 'Ves', cable: 'Edda' };
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export function freshContinuity(now = Date.now()) {
  return {
    version: 1,
    age: 0,
    lastWall: now,
    energy: 0.88,
    strain: 0,
    traits: { curiosity: 0.62, care: 0.58, independence: 0.7 },
    memories: [],
    nextMemory: 1,
    beliefs: [],
    relationships: {},
    threads: {},
    cooldowns: {},
    samples: [],
    works: [],
    draft: null,
    visitorNotes: [],
    reflections: [],
    lastReflection: 0,
    reflectedThrough: 0,
    lastAction: -300,
    lastAmbient: -300,
    seed: Math.floor(Math.random() * 1e8),
    lastSeenEvent: 0,
    returnGap: 0,
  };
}
export function ensureContinuity(state, now = Date.now()) {
  if (!state.continuity || state.continuity.version !== 1) {
    state.continuity = freshContinuity(now);
    state.continuity.age = state.elapsed || 0;
    for (const e of state.events.filter((e) => e.memory).slice(-24))
      remember(state, e.memory, e.type, e.text, e.time || 0);
    state.continuity.lastSeenEvent = state.events.at(-1)?.id || 0;
  }
  const continuity = state.continuity,
    b = freshContinuity(now);
  for (const k of [
    'age',
    'lastWall',
    'energy',
    'strain',
    'nextMemory',
    'lastReflection',
    'reflectedThrough',
    'lastAction',
    'lastAmbient',
    'seed',
    'lastSeenEvent',
  ])
    if (!Number.isFinite(continuity[k])) continuity[k] = b[k];
  continuity.age = Math.max(0, continuity.age);
  continuity.energy = clamp(continuity.energy);
  continuity.strain = clamp(continuity.strain);
  continuity.traits = { ...b.traits, ...continuity.traits };
  for (const k of Object.keys(b.traits))
    continuity.traits[k] = Number.isFinite(continuity.traits[k])
      ? clamp(continuity.traits[k])
      : b.traits[k];
  for (const k of ['memories', 'beliefs', 'samples', 'works', 'visitorNotes', 'reflections'])
    if (!Array.isArray(continuity[k])) continuity[k] = [];
  for (const k of ['threads', 'relationships', 'cooldowns'])
    if (!continuity[k] || typeof continuity[k] !== 'object' || Array.isArray(continuity[k]))
      continuity[k] = {};
  continuity.memories = continuity.memories
    .filter(
      (m) => m && typeof m.text === 'string' && Number.isFinite(m.id) && Number.isFinite(m.at),
    )
    .slice(-80);
  continuity.nextMemory = Math.max(
    continuity.nextMemory,
    ...continuity.memories.map((m) => m.id + 1),
  );
  seedThreads(state);
  return continuity;
}
function remember(state, text, kind, source, at = state.continuity.age) {
  const continuity = state.continuity;
  if (!text) return null;
  const m = {
    id: continuity.nextMemory++,
    at,
    text,
    kind,
    source,
    zone: state.zone,
    recalled: 0,
    strength: kind === 'study' ? 1 : 3,
  };
  continuity.memories.push(m);
  if (continuity.memories.length > 80) {
    const pinned = new Set(continuity.beliefs.flatMap((b) => b.evidence || []));
    const removable = continuity.memories
      .map((m, i) => ({
        i,
        score:
          m.strength +
          m.recalled * 0.2 +
          (pinned.has(m.id) ? 30 : 0) -
          (continuity.age - m.at) / DAY,
      }))
      .sort((a, b) => a.score - b.score)[0];
    continuity.memories.splice(removable.i, 1);
  }
  return m;
}
function openThread(state, id, title, zone, point, delay) {
  const continuity = state.continuity;
  if (!continuity.threads[id])
    continuity.threads[id] = {
      id,
      title,
      zone,
      point,
      phase: 0,
      opened: continuity.age,
      due: continuity.age + delay,
      visits: 0,
      evidence: [],
    };
}
function seedThreads(state) {
  if (state.stage >= 3)
    openThread(state, 'pump', 'Can I leave something I care about alone?', 'district', 'pump', 180);
  if (state.life.lamp) openThread(state, 'lamp', 'Who is the light for?', 'lantern', 'npc', 600);
  if (state.life.delivered)
    openThread(
      state,
      'parcel',
      'Was that a delivery, or the beginning of knowing someone?',
      'cable',
      'npc',
      900,
    );
  if (state.life.beacon)
    openThread(state, 'signal', 'That signal came back. Was it an answer?', 'cable', 'beacon', 300);
  if (state.gift?.noticed)
    openThread(state, 'moss', 'Someone trusted me with something alive.', 'district', 'bench', 600);
}
// Wall time matures concerns; it never fabricates walks, conversations, or completed work.
export function advanceContinuity(state, dt = 0, now = Date.now()) {
  const continuity = state.continuity || ensureContinuity(state, now);
  const gap = Math.max(0, (now - continuity.lastWall) / 1000);
  const delta = Math.max(Math.max(0, dt), gap);
  continuity.lastWall = Math.max(continuity.lastWall, now);
  continuity.age += delta;
  if (gap > 300) {
    continuity.returnGap = gap;
    continuity.energy = Math.min(1, continuity.energy + Math.min(gap / HOUR, 0.6));
    continuity.strain = Math.max(0, continuity.strain - Math.min(gap / DAY, 0.3));
  } else continuity.energy = clamp(continuity.energy - Math.max(0, dt) / 10800);
  return delta;
}
export function ageLabel(age) {
  const day = Math.floor(age / DAY) + 1,
    h = Math.floor((age % DAY) / HOUR),
    m = Math.floor((age % HOUR) / 60);
  return `Day ${day} · ${h}h ${String(m).padStart(2, '0')}m`;
}
export function recall(state, kind) {
  const continuity = state.continuity;
  const matches = continuity.memories
    .filter((m) => m.kind === kind || m.zone === kind)
    .sort((a, b) => b.strength + b.recalled * 0.1 - (a.strength + a.recalled * 0.1) || b.at - a.at);
  const m = matches[0];
  if (m) m.recalled = Math.min(30, m.recalled + 1);
  return m;
}
export function observeOutcome(state, e) {
  if (!e) return;
  const continuity = state.continuity || ensureContinuity(state);
  if (e.id <= continuity.lastSeenEvent) return;
  continuity.lastSeenEvent = e.id;
  e.age = continuity.age;
  if (e.memory && !e.type.startsWith('travel:') && e.type !== 'rest')
    remember(state, e.memory, e.type, e.text);
  if (['repair', 'light-lamp', 'deliver-parcel', 'restore-beacon'].includes(e.type))
    continuity.energy = clamp(continuity.energy - 0.035);
  if (e.type === 'probe') {
    continuity.strain = clamp(continuity.strain + 0.035);
    if (continuity.memories.filter((m) => m.kind === 'probe').length < 3)
      remember(
        state,
        'An adjustment did not settle the regulator. I have to listen to the result, not my first guess.',
        'experiment',
        e.text,
      );
  }
  if (e.type === 'settle-pressure') continuity.strain = clamp(continuity.strain - 0.15);
  if (e.type === 'talk') {
    const r = relationship(state, state.zone);
    r.familiarity++;
    r.last = continuity.age;
  }
  seedThreads(state);
}
function relationship(state, zone) {
  const continuity = state.continuity;
  if (!continuity.relationships[zone])
    continuity.relationships[zone] = {
      name: residentNames[zone] || 'A neighbour',
      familiarity: 0,
      trust: 0.1,
      last: -HOUR,
      meetings: [],
      shared: [],
    };
  return continuity.relationships[zone];
}
export function residentVoice(state, zone) {
  const continuity = state.continuity,
    r = continuity.relationships[zone];
  if (!r || !r.familiarity) return locals[zone]?.npc?.quote || '';
  if (zone === 'lantern' && continuity.threads.lamp?.phase >= 2)
    return '“Kept your crooked shade. The table is ours to see by now. Sit down, if you like.”';
  if (zone === 'cable' && state.life.delivered)
    return r.trust > 0.35
      ? '“You can come here without bringing me anything, you know.”'
      : '“The fuse held. I kept the wrapping. Mara always folds it that way.”';
  if (zone === 'crossing' && r.trust > 0.3)
    return '“You keep asking whether it is fixed. Sometimes listen for whether it is comfortable.”';
  if (zone === 'violet' && continuity.works.length)
    return '“I can hear the part you nearly threw away. Leave that bit in.”';
  return locals[zone]?.npc?.quote || '';
}
function ready(continuity, key, interval) {
  return (
    continuity.cooldowns[key] === undefined ||
    continuity.age - continuity.cooldowns[key] >= interval
  );
}
function available(state, zone, id) {
  return !!state.mind.known[zone + ':' + id];
}
export function continuityOptions(state) {
  const continuity = state.continuity || ensureContinuity(state),
    out = [];
  const add = (zone, id, type, reason, score = 1, payload = {}, evidence = '') => {
    if (available(state, zone, id)) out.push({ zone, id, type, reason, score, payload, evidence });
  };
  for (const thread of Object.values(continuity.threads)) {
    if (continuity.age < thread.due) continue;
    if (thread.id === 'pump')
      add(
        'district',
        'pump',
        'life-pump',
        thread.phase === 0
          ? 'I keep thinking about that first repair. Does it still sound right?'
          : continuity.traits.independence > 0.63
            ? 'I want to check it myself. I know I checked it before.'
            : 'I could listen once, then leave the pump to its evening.',
        2 + continuity.traits.care,
        {},
        'The missing gear was the first thing I mended here.',
      );
    if (thread.id === 'lamp') {
      const z = thread.phase === 1 ? 'district' : 'lantern',
        id = thread.phase === 1 ? 'benchwork' : thread.phase === 2 ? 'lamp' : 'npc';
      add(
        z,
        id,
        'life-lamp',
        thread.phase === 0
          ? 'Mara lives with that light. I only switched it on.'
          : thread.phase === 1
            ? 'A brighter lamp was my answer. I never asked what Mara needed.'
            : thread.phase === 2
              ? 'The shade has cooled. It is uneven, but perhaps it will soften the light.'
              : 'I wonder what happens around that lamp when nobody needs a repair.',
        3 + continuity.traits.care,
        {},
        'The conductor worked. Its consequences are still unfolding.',
      );
    }
    if (thread.id === 'parcel')
      add(
        'cable',
        'npc',
        'life-parcel',
        'I remember Edda’s face when the lamp came on. I could go without a parcel this time.',
        2 + continuity.traits.care,
      );
    if (thread.id === 'signal') {
      const zone = thread.phase === 1 ? 'blind' : thread.phase === 3 ? 'crossing' : 'cable',
        id = thread.phase === 1 ? 'cache' : thread.phase === 3 ? 'npc' : 'beacon';
      add(
        zone,
        id,
        'life-signal',
        thread.phase === 0
          ? 'The new mast keeps answering itself. I do not know why.'
          : thread.phase === 1
            ? 'The recovered coil came from the dead street. There may be a connection.'
            : thread.phase === 2
              ? 'Enough time has passed to compare the echo again.'
              : thread.phase === 3
                ? 'Orin might hear something I keep missing.'
                : 'I still hear a pattern. I want another observation before I call it a message.',
        2 + continuity.traits.curiosity * 2,
        {},
        'An answer and an echo can sound alike.',
      );
    }
    if (thread.id === 'moss')
      add(
        'district',
        'bench',
        'life-moss',
        'The little cutting is still on my mind. Growth will not hurry just because I want it to.',
        2 + continuity.traits.care,
      );
  }
  if (continuity.draft && continuity.age >= continuity.draft.due) {
    if (continuity.draft.phase === 'feedback') {
      for (const z of ['violet', 'crossing', 'lantern', 'cable'])
        if (state.city.talked.includes(z))
          add(
            z,
            'npc',
            'life-feedback',
            continuity.traits.independence > 0.65
              ? 'I don’t much want an opinion. Which is probably why I need one.'
              : 'I want someone else to hear the part I cannot settle.',
            3,
            { zone: z },
            'My first version sounded too much like a machine test.',
          );
    } else
      add(
        'district',
        'benchwork',
        'life-compose',
        'I have left the sketch alone long enough to hear what is missing.',
        3,
      );
  }
  if (
    !continuity.draft &&
    continuity.samples.length >= 2 &&
    ready(continuity, 'compose', 6 * HOUR) &&
    state.life.skills.includes('Mechanics')
  )
    add(
      'district',
      'benchwork',
      'life-compose',
      'These sounds need not only tell me what is broken. I could make something from them.',
      1 + continuity.traits.curiosity,
    );
  if (continuity.works.length) {
    const work = continuity.works.at(-1);
    for (const z of state.city.talked)
      if (!work.shared.includes(z) && ready(continuity, 'share', HOUR))
        add(
          z,
          'npc',
          'life-share',
          `I made something from these streets. ${residentNames[z]} might hear a different thing in it.`,
          1.5 + continuity.traits.care,
          { work: work.id },
        );
  }
  if (state.stage >= 3 && ready(continuity, 'sample', 600)) {
    const choices = Object.values(state.mind.known).filter(
      (o) =>
        ['pump', 'regulator', 'beacon', 'lamp', 'cache'].includes(o.id) &&
        !continuity.samples.some(
          (a) => a.zone === o.zone && a.day === Math.floor(continuity.age / DAY),
        ),
    );
    for (const o of choices)
      add(
        o.zone,
        o.id,
        'life-listen',
        'There is a sound here I never needed for a repair. I want to keep it.',
        1 + continuity.traits.curiosity,
        { id: o.id },
      );
  }
  if (ready(continuity, 'company', 1800)) {
    for (const zone of state.city.talked) {
      const r = relationship(state, zone);
      if (continuity.age - r.last >= 1800)
        add(
          zone,
          'npc',
          'life-company',
          r.trust > 0.35
            ? `I want to spend a little time with ${r.name}. Nothing needs fixing.`
            : `I know what ${r.name} does here. Not much about who they are.`,
          1 + continuity.traits.care + (continuity.age - r.last) / DAY,
        );
    }
  }
  if (continuity.visitorNotes.some((n) => !n.read))
    add(
      'district',
      'bench',
      'life-note',
      'Someone left a thought beside the lantern. I have been carrying enough of my own.',
      4,
    );
  if (
    ready(continuity, 'reflect', 600) &&
    (continuity.energy < 0.35 ||
      continuity.strain > 0.55 ||
      (continuity.age - continuity.lastReflection >= 1800 &&
        continuity.memories.filter((m) => m.id > continuity.reflectedThrough).length >= 2))
  )
    add(
      'district',
      'bench',
      'life-reflect',
      continuity.strain > 0.55
        ? 'I am turning the same thought over. I need to stop pushing it for a while.'
        : 'I want to sit with what happened before deciding what it means.',
      continuity.energy < 0.18 ? 10 : 2,
    );
  return out.sort((a, b) => b.score - a.score);
}
export function continuityDecision(state, urgent = false) {
  const continuity = state.continuity || ensureContinuity(state);
  if (urgent && continuity.age - continuity.lastAction < 180) return null;
  const options = continuityOptions(state);
  return urgent ? options.find((o) => o.score >= 3) || null : options[0] || null;
}
export function ambientDecision(state) {
  const continuity = state.continuity;
  if (!ready(continuity, 'wander', 180)) return null;
  const places = Object.values(state.mind.known).filter((o) =>
    ['bench', 'pump', 'npc', 'cache'].includes(o.id),
  );
  if (!places.length) return null;
  const p = places[(Math.floor(continuity.age / 180) + continuity.seed) % places.length];
  return {
    zone: p.zone,
    id: p.id,
    type: 'life-linger',
    reason:
      p.id === 'npc'
        ? 'I can stay a little without asking for anything.'
        : 'I want to walk somewhere familiar and see what I notice.',
    payload: { id: p.id },
    evidence: 'A familiar place, between other things.',
  };
}
function finish(state, type, text, memory) {
  const continuity = state.continuity;
  continuity.lastAction = continuity.age;
  continuity.energy = clamp(continuity.energy - 0.012);
  state.mood =
    continuity.strain > 0.45 ? 'Unsettled' : continuity.energy < 0.3 ? 'Tired' : 'Thoughtful';
  const e = appendEvent(state, type, text, memory);
  return e;
}
function consolidate(state) {
  const continuity = state.continuity;
  if (continuity.age - continuity.lastReflection < 1800) return null;
  const recent = continuity.memories.filter((m) => m.id > continuity.reflectedThrough);
  if (recent.length < 2) return null;
  const care = continuity.memories.filter((m) =>
    ['life-parcel', 'life-company', 'life-share', 'life-feedback', 'deliver-parcel'].includes(
      m.kind,
    ),
  );
  const check = continuity.memories.filter((m) =>
    ['life-pump', 'life-lamp', 'repair'].includes(m.kind),
  );
  const experiments = continuity.memories.filter((m) =>
    ['life-signal', 'experiment', 'life-compose'].includes(m.kind),
  );
  let text = 'I do not need to turn every evening into an answer.';
  const evidence = [];
  const revise = (key, line, ms, trait, delta) => {
    if (ms.length < 2) return;
    const support = ms.slice(-3).map((m) => m.id),
      old = continuity.beliefs.find((b) => b.key === key);
    if (old && support.every((id) => old.evidence.includes(id))) return;
    continuity.traits[trait] = clamp(continuity.traits[trait] + delta, 0.15, 0.9);
    if (old) {
      old.text = line;
      old.evidence = [...new Set([...old.evidence, ...support])].slice(-8);
      old.revised = continuity.age;
    } else
      continuity.beliefs.push({
        key,
        text: line,
        evidence: support,
        since: continuity.age,
        revised: continuity.age,
      });
    text = line;
    evidence.push(...support);
  };
  revise(
    'care',
    'Being useful is one way to know someone. It is not the only way.',
    care,
    'care',
    0.035,
  );
  revise(
    'control',
    continuity.threads.pump?.visits >= 3
      ? 'Returning matters. So does learning when to leave a working thing alone.'
      : 'I keep checking what I have mended. I am not sure whether that is care or worry.',
    check,
    'independence',
    -0.025,
  );
  revise(
    'uncertainty',
    'An explanation can feel right before the evidence agrees with it.',
    experiments,
    'curiosity',
    0.025,
  );
  continuity.lastReflection = continuity.age;
  continuity.reflectedThrough = continuity.nextMemory - 1;
  continuity.reflections.push({ at: continuity.age, text, evidence: [...new Set(evidence)] });
  continuity.reflections = continuity.reflections.slice(-30);
  return text;
}
export function continuityAction(state, type, payload, points) {
  const continuity = state.continuity || ensureContinuity(state);
  const near = (id) =>
    points[id] && Math.hypot(state.x - points[id].x, state.y - points[id].y) < 90;
  if (type === 'life-linger') {
    if (!near(payload.id) || !ready(continuity, 'wander', 180)) return null;
    continuity.cooldowns.wander = continuity.age;
    continuity.energy = clamp(continuity.energy + 0.018);
    continuity.lastAmbient = continuity.age;
    return finish(state, type, 'Iona spent a quiet moment in a familiar part of the streets.', '');
  }
  const option = continuityOptions(state).find(
    (o) => o.type === type && o.zone === state.zone && near(o.id),
  );
  if (!option) return null;
  const thread = continuity.threads[type.slice(5)];
  const handler = CONTINUITY_HANDLERS[type];
  if (!handler) return null;
  const outcome = handler(state, option);
  if (!outcome) return null;
  const { text, memory } = outcome;
  if (thread) {
    const m = continuity.memories.at(-1);
    if (m) thread.evidence = [...new Set([...thread.evidence, m.id])].slice(-8);
  }
  return finish(state, type, text, memory);
}
function addSample(state, zone, id, sound) {
  const continuity = state.continuity,
    day = Math.floor(continuity.age / DAY);
  if (continuity.samples.some((a) => a.zone === zone && a.day === day && a.object === id))
    return null;
  const sample = {
    id: (continuity.samples.at(-1)?.id || 0) + 1,
    zone,
    object: id,
    day,
    at: continuity.age,
    sound,
  };
  continuity.samples.push(sample);
  continuity.samples = continuity.samples.slice(-40);
  return sample;
}
export function leaveThought(state, influence) {
  const continuity = state.continuity;
  if (
    !['care', 'curiosity', 'independence'].includes(influence) ||
    continuity.visitorNotes.some((n) => !n.read) ||
    !ready(continuity, 'visitor', 1800)
  )
    return false;
  const text = {
    care: 'Who would you visit if you had nothing to bring?',
    curiosity: 'What would you make if it did not have to be useful?',
    independence: 'Could a thing keep working without you watching it?',
  }[influence];
  continuity.visitorNotes.push({ text, influence, at: continuity.age, read: false });
  continuity.visitorNotes = continuity.visitorNotes.slice(-20);
  continuity.cooldowns.visitor = continuity.age;
  return true;
}

// Each handler changes one concern; eligibility and proximity stay in continuityAction.
function revisitPump(state) {
  const continuity = state.continuity;
  const thread = continuity.threads['pump'];
  let text = '',
    memory = '';

  thread.visits++;
  if (thread.visits === 1) {
    memory = 'Still turning. I expected to feel finished. Instead I want to come back.';
    thread.phase = 1;
    thread.due = continuity.age + HOUR;
  } else if (thread.visits === 2) {
    memory =
      'I nearly tightened a sound fitting. There was nothing wrong with it. I wanted to be needed.';
    thread.phase = 2;
    continuity.strain = clamp(continuity.strain + 0.12);
    thread.due = continuity.age + 4 * HOUR;
  } else {
    memory =
      continuity.traits.independence > 0.63
        ? 'I listened twice. It did not need me either time. I left my tools in the bag.'
        : 'The rhythm held. I can care about this place without holding every part of it still.';
    thread.due = continuity.age + 6 * HOUR;
    continuity.strain = clamp(continuity.strain - 0.08);
  }
  text = 'Iona checked the repaired pump, then left it running without changing the mechanism.';

  return { text, memory };
}

function followUpLamp(state) {
  const continuity = state.continuity;
  const thread = continuity.threads['lamp'];
  let text = '',
    memory = '';

  if (thread.phase === 0) {
    memory =
      'Mara thanked me for the light, then moved her chair out of it. I had not noticed the glare.';
    text = 'Mara showed Iona where the repaired lamp shone into her eyes.';
    thread.phase = 1;
    thread.due = continuity.age + 120;
    continuity.strain = clamp(continuity.strain + 0.12);
  } else if (thread.phase === 1) {
    memory =
      'The first fold cracked. I kept the second, crooked one. It needs time before I fit it.';
    text = 'Iona shaped a small lamp shade at the winding bench; the first attempt split.';
    thread.phase = 2;
    thread.due = continuity.age + HOUR;
  } else if (thread.phase === 2) {
    memory =
      'Less bright on the stairs, kinder at the table. I had to choose what the light was for.';
    text =
      'Iona fitted her uneven shade. The lamp now threw a softer pool of light beside Mara’s table.';
    thread.phase = 3;
    thread.due = continuity.age + DAY;
    continuity.traits.care = clamp(continuity.traits.care + 0.025);
  } else {
    memory = 'There was another chair under the lamp. Mara had left it for me. I brought no tools.';
    text = 'Iona sat with Mara under the shade they had found a use for together.';
    thread.visits++;
    thread.due = continuity.age + DAY;
    const r = relationship(state, 'lantern');
    r.trust = clamp(r.trust + 0.06);
    r.familiarity++;
    r.last = continuity.age;
  }

  return { text, memory };
}

function visitEdda(state) {
  const continuity = state.continuity;
  const thread = continuity.threads['parcel'];
  let text = '',
    memory = '';

  const r = relationship(state, 'cable');
  r.familiarity++;
  r.trust = clamp(r.trust + 0.06);
  r.last = continuity.age;
  if (thread.phase === 0) {
    text = 'Iona asked Edda about the fuse she had delivered.';
    memory = 'Edda remembered my name. I had prepared a question about the lamp, not about myself.';
    thread.phase = 1;
    thread.due = continuity.age + 4 * HOUR;
  } else {
    memory =
      r.trust > 0.4
        ? 'Edda asked me to stay. I did not make up a job to justify it.'
        : 'Edda said I can visit without a delivery. I still checked my bag before I sat down.';
    text = 'Iona stayed with Edda after their conversation about the working lamp.';
    thread.visits++;
    thread.due = continuity.age + DAY;
  }

  return { text, memory };
}

function investigateSignal(state) {
  const continuity = state.continuity;
  const thread = continuity.threads['signal'];
  let text = '',
    memory = '';

  if (thread.phase === 0) {
    memory = 'Three notes, and three back. Someone answering? Or a pipe with my own voice in it?';
    text = 'Iona heard a delayed echo from the restored signal mast.';
    thread.phase = 1;
    thread.due = continuity.age + 120;
  } else if (thread.phase === 1) {
    memory =
      'The case at Cinder End has the same three marks. That is a connection, not proof of a listener.';
    text = 'Iona compared the coil case’s markings with the mast’s pulse pattern.';
    thread.phase = 2;
    thread.due = continuity.age + 2 * HOUR;
  } else if (thread.phase === 2) {
    memory =
      'The delay shortened as the pipes warmed. I wanted it to be an answer. That does not make it one.';
    text =
      'Iona compared the later signal with her earlier observation; the return timing had changed.';
    thread.phase = 3;
    thread.due = continuity.age + 900;
    continuity.strain = clamp(continuity.strain + 0.15);
  } else if (thread.phase === 3) {
    memory =
      'Orin tapped a return pipe. The echo matched. We could make a tune with this, even if nobody is answering.';
    text = 'Orin demonstrated a return-pipe echo while Iona compared her notes.';
    thread.phase = 4;
    thread.due = continuity.age + DAY;
    continuity.traits.independence = clamp(continuity.traits.independence - 0.025);
    const r = relationship(state, 'crossing');
    r.trust = clamp(r.trust + 0.08);
    r.last = continuity.age;
    addSample(state, 'crossing', 'return-pipe', 'a reply made by a return pipe');
  } else {
    memory =
      'I know one explanation now. I am keeping the odd notes anyway. They might become something else.';
    text = 'Iona recorded another variation in the mast’s echo.';
    thread.visits++;
    thread.due = continuity.age + DAY;
    addSample(state, 'cable', 'beacon', 'an uneven three-note echo');
  }

  return { text, memory };
}

function tendMoss(state) {
  const continuity = state.continuity;
  const thread = continuity.threads['moss'];
  let text = '',
    memory = '';

  thread.visits++;
  const days = (continuity.age - thread.opened) / DAY;
  memory =
    days < 1
      ? 'No new leaf yet. I moved the tin out of the heat. It does not owe me a result.'
      : days < 3
        ? 'A pale edge has opened. I almost missed it because I was looking for a whole new plant.'
        : 'The cutting has taken to the lantern corner. I am learning its pace rather than imposing mine.';
  text = 'Iona checked the moss cutting and adjusted its place beneath the lantern.';
  thread.phase = Math.min(3, Math.floor(days));
  thread.due = continuity.age + 6 * HOUR;

  return { text, memory };
}

function collectStreetSound(state, option) {
  const continuity = state.continuity;
  let text = '',
    memory = '';

  const sounds = {
    pump: 'the low, uneven warmth of the pump',
    regulator: 'a thin whistle above the flywheel',
    beacon: 'three notes disappearing into the haze',
    lamp: 'the small buzz beneath a warm lamp',
    cache: 'a hollow note from the discarded coil case',
  };
  const sample = addSample(state, state.zone, option.id, sounds[option.id]);
  if (!sample) return null;
  memory = `I kept ${sample.sound}. It is not a fault. I like it.`;
  text = 'Iona tapped out a local rhythm and added it to her collection of sounds.';
  continuity.cooldowns.sample = continuity.age;

  return { text, memory };
}

function developSoundSketch(state) {
  const continuity = state.continuity;
  let text = '',
    memory = '';

  continuity.cooldowns.compose = continuity.age;
  if (!continuity.draft) {
    continuity.draft = {
      phase: 'feedback',
      due: continuity.age + 900,
      started: continuity.age,
      sources: continuity.samples.slice(-4).map((a) => a.id),
      feedback: null,
    };
    memory =
      'I copied all the rhythms exactly. It sounds like a maintenance report. I want it to sound like being here.';
    text = 'Iona made a first sound sketch at the bench, then left it unfinished.';
    continuity.strain = clamp(continuity.strain + 0.12);
  } else {
    const d = continuity.draft;
    const motif =
      continuity.traits.care >= continuity.traits.independence
        ? 'Room for another voice'
        : 'The part that catches';
    const work = {
      id: continuity.works.length ? continuity.works.at(-1).id + 1 : 1,
      title: motif,
      at: continuity.age,
      sources: d.sources,
      feedback: d.feedback,
      shared: [],
      revision: (continuity.works.at(-1)?.revision || 0) + 1,
      notes: d.sources.map((id, i) => {
        const sample = continuity.samples.find((a) => a.id === id);
        const pitches = {
          district: 146.83,
          boiler: 220,
          cable: 196,
          lantern: 261.63,
          blind: 174.61,
          crossing: 164.81,
        };
        return {
          frequency: pitches[sample?.zone] || 196,
          beat: i * 2 + (i > 0 ? 1 : 0),
          duration: i === 0 ? 0.8 : 1.2,
        };
      }),
    };
    continuity.works.push(work);
    continuity.works = continuity.works.slice(-20);
    continuity.draft = null;
    memory = `I left a pause in “${motif}”. The gap is the part I kept changing. Someone else could put a sound there.`;
    text = `Iona kept a new arrangement, “${motif}”, built from remembered street sounds and a neighbour’s feedback.`;
    continuity.strain = clamp(continuity.strain - 0.15);
  }

  return { text, memory };
}

function askForFeedback(state) {
  const continuity = state.continuity;
  let text = '',
    memory = '';

  const r = relationship(state, state.zone);
  r.trust = clamp(r.trust + 0.06);
  r.familiarity++;
  r.last = continuity.age;
  continuity.draft.feedback = r.name;
  continuity.draft.phase = 'revise';
  continuity.draft.due = continuity.age + 1800;
  memory = `${r.name} said the pause was the interesting part. I nearly filled it before asking. I need to hear it again later.`;
  text = `Iona let ${r.name} hear her unfinished sound sketch and kept their suggestion.`;

  return { text, memory };
}

function shareArrangement(state) {
  const continuity = state.continuity;
  let text = '',
    memory = '';

  const w = continuity.works.at(-1);
  w.shared.push(state.zone);
  continuity.cooldowns.share = continuity.age;
  const r = relationship(state, state.zone);
  r.trust = clamp(r.trust + 0.04);
  r.last = continuity.age;
  r.shared.push(w.id);
  memory = `${r.name} tapped a different ending to “${w.title}”. It is not what I meant. I want to remember it anyway.`;
  text = `Iona shared “${w.title}” with ${r.name}, who added an ending of their own.`;
  addSample(state, state.zone, 'reply', `${r.name}’s unexpected ending`);

  return { text, memory };
}

function spendTimeWithResident(state) {
  const continuity = state.continuity;
  let text = '',
    memory = '';

  const r = relationship(state, state.zone);
  r.familiarity++;
  r.trust = clamp(r.trust + 0.025);
  r.last = continuity.age;
  continuity.cooldowns.company = continuity.age;
  r.meetings.push(continuity.age);
  r.meetings = r.meetings.slice(-12);
  const lines = {
    crossing: [
      'Orin counted silences between pipe knocks. I had only been counting knocks.',
      'Orin waited while I found the note. He did not need to be the first to hear it.',
    ],
    lantern: [
      'Mara straightens the empty chair before closing. She says someone usually comes.',
      'Mara left the chair crooked today. We talked instead of putting it right.',
    ],
    violet: [
      'Ves keeps failed pieces. Not as warnings. As material. I would have hidden mine.',
      'Ves asked about the version I discarded. I described the wrong part first.',
    ],
    cable: [
      'Edda knows the carriages by their rattles. She noticed I had started doing it too.',
      'Edda asked what I do when nothing is broken. I did not have an answer ready.',
    ],
  };
  memory = lines[state.zone][Math.floor(r.familiarity / 2) % 2];
  text = `Iona spent time with ${r.name}, without taking on a job.`;
  continuity.strain = clamp(continuity.strain - 0.04);

  return { text, memory };
}

function readVisitorThought(state) {
  const continuity = state.continuity;
  let text = '',
    memory = '';

  const n = continuity.visitorNotes.find((n) => !n.read);
  n.read = true;
  n.readAt = continuity.age;
  continuity.traits[n.influence] = clamp(
    continuity.traits[n.influence] + (n.influence === 'independence' ? -0.015 : 0.015),
  );
  memory =
    n.influence === 'care'
      ? 'Someone wondered who I could sit with. I keep thinking I need a reason to visit.'
      : n.influence === 'curiosity'
        ? 'Someone asked what I would make for no practical reason. I have been listening differently since.'
        : 'Someone said I could leave a working thing alone. I agree with the words. Doing it is harder.';
  text = 'Iona read a visitor’s thought and kept it in her notebook.';

  return { text, memory };
}

function restAndReflect(state) {
  const continuity = state.continuity;
  let text = '',
    memory = '';

  const reflection = consolidate(state);
  continuity.energy = clamp(continuity.energy + 0.4);
  continuity.strain = clamp(continuity.strain - 0.2);
  continuity.cooldowns.reflect = continuity.age;
  memory = reflection || 'I can leave a question open and still have had an evening.';
  text = 'Iona rested beneath the lantern and reconsidered the experiences she had kept.';

  return { text, memory };
}

const CONTINUITY_HANDLERS = {
  'life-pump': revisitPump,
  'life-lamp': followUpLamp,
  'life-parcel': visitEdda,
  'life-signal': investigateSignal,
  'life-moss': tendMoss,
  'life-listen': collectStreetSound,
  'life-compose': developSoundSketch,
  'life-feedback': askForFeedback,
  'life-share': shareArrangement,
  'life-company': spendTimeWithResident,
  'life-note': readVisitorThought,
  'life-reflect': restAndReflect,
};
