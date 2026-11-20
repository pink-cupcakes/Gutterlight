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
export function ensureContinuity(s, now = Date.now()) {
  if (!s.continuity || s.continuity.version !== 1) {
    s.continuity = freshContinuity(now);
    s.continuity.age = s.elapsed || 0;
    for (const e of s.events.filter((e) => e.memory).slice(-24))
      remember(s, e.memory, e.type, e.text, e.time || 0);
    s.continuity.lastSeenEvent = s.events.at(-1)?.id || 0;
  }
  const c = s.continuity,
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
    if (!Number.isFinite(c[k])) c[k] = b[k];
  c.age = Math.max(0, c.age);
  c.energy = clamp(c.energy);
  c.strain = clamp(c.strain);
  c.traits = { ...b.traits, ...c.traits };
  for (const k of Object.keys(b.traits))
    c.traits[k] = Number.isFinite(c.traits[k]) ? clamp(c.traits[k]) : b.traits[k];
  for (const k of ['memories', 'beliefs', 'samples', 'works', 'visitorNotes', 'reflections'])
    if (!Array.isArray(c[k])) c[k] = [];
  for (const k of ['threads', 'relationships', 'cooldowns'])
    if (!c[k] || typeof c[k] !== 'object' || Array.isArray(c[k])) c[k] = {};
  c.memories = c.memories
    .filter(
      (m) => m && typeof m.text === 'string' && Number.isFinite(m.id) && Number.isFinite(m.at),
    )
    .slice(-80);
  c.nextMemory = Math.max(c.nextMemory, ...c.memories.map((m) => m.id + 1));
  seedThreads(s);
  return c;
}
function remember(s, text, kind, source, at = s.continuity.age) {
  const c = s.continuity;
  if (!text) return null;
  const m = {
    id: c.nextMemory++,
    at,
    text,
    kind,
    source,
    zone: s.zone,
    recalled: 0,
    strength: kind === 'study' ? 1 : 3,
  };
  c.memories.push(m);
  if (c.memories.length > 80) {
    const pinned = new Set(c.beliefs.flatMap((b) => b.evidence || []));
    const removable = c.memories
      .map((m, i) => ({
        i,
        score: m.strength + m.recalled * 0.2 + (pinned.has(m.id) ? 30 : 0) - (c.age - m.at) / DAY,
      }))
      .sort((a, b) => a.score - b.score)[0];
    c.memories.splice(removable.i, 1);
  }
  return m;
}
function openThread(s, id, title, zone, point, delay) {
  const c = s.continuity;
  if (!c.threads[id])
    c.threads[id] = {
      id,
      title,
      zone,
      point,
      phase: 0,
      opened: c.age,
      due: c.age + delay,
      visits: 0,
      evidence: [],
    };
}
function seedThreads(s) {
  if (s.stage >= 3)
    openThread(s, 'pump', 'Can I leave something I care about alone?', 'district', 'pump', 180);
  if (s.life.lamp) openThread(s, 'lamp', 'Who is the light for?', 'lantern', 'npc', 600);
  if (s.life.delivered)
    openThread(
      s,
      'parcel',
      'Was that a delivery, or the beginning of knowing someone?',
      'cable',
      'npc',
      900,
    );
  if (s.life.beacon)
    openThread(s, 'signal', 'That signal came back. Was it an answer?', 'cable', 'beacon', 300);
  if (s.gift?.noticed)
    openThread(s, 'moss', 'Someone trusted me with something alive.', 'district', 'bench', 600);
}
// Wall time matures concerns; it never fabricates walks, conversations, or completed work.
export function advanceContinuity(s, dt = 0, now = Date.now()) {
  const c = s.continuity || ensureContinuity(s, now);
  const gap = Math.max(0, (now - c.lastWall) / 1000);
  const delta = Math.max(Math.max(0, dt), gap);
  c.lastWall = Math.max(c.lastWall, now);
  c.age += delta;
  if (gap > 300) {
    c.returnGap = gap;
    c.energy = Math.min(1, c.energy + Math.min(gap / HOUR, 0.6));
    c.strain = Math.max(0, c.strain - Math.min(gap / DAY, 0.3));
  } else c.energy = clamp(c.energy - Math.max(0, dt) / 10800);
  return delta;
}
export function ageLabel(age) {
  const day = Math.floor(age / DAY) + 1,
    h = Math.floor((age % DAY) / HOUR),
    m = Math.floor((age % HOUR) / 60);
  return `Day ${day} · ${h}h ${String(m).padStart(2, '0')}m`;
}
export function recall(s, kind) {
  const c = s.continuity;
  const matches = c.memories
    .filter((m) => m.kind === kind || m.zone === kind)
    .sort((a, b) => b.strength + b.recalled * 0.1 - (a.strength + a.recalled * 0.1) || b.at - a.at);
  const m = matches[0];
  if (m) m.recalled = Math.min(30, m.recalled + 1);
  return m;
}
export function observeOutcome(s, e) {
  if (!e) return;
  const c = s.continuity || ensureContinuity(s);
  if (e.id <= c.lastSeenEvent) return;
  c.lastSeenEvent = e.id;
  e.age = c.age;
  if (e.memory && !e.type.startsWith('travel:') && e.type !== 'rest')
    remember(s, e.memory, e.type, e.text);
  if (['repair', 'light-lamp', 'deliver-parcel', 'restore-beacon'].includes(e.type))
    c.energy = clamp(c.energy - 0.035);
  if (e.type === 'probe') {
    c.strain = clamp(c.strain + 0.035);
    if (c.memories.filter((m) => m.kind === 'probe').length < 3)
      remember(
        s,
        'An adjustment did not settle the regulator. I have to listen to the result, not my first guess.',
        'experiment',
        e.text,
      );
  }
  if (e.type === 'settle-pressure') c.strain = clamp(c.strain - 0.15);
  if (e.type === 'talk') {
    const r = relationship(s, s.zone);
    r.familiarity++;
    r.last = c.age;
  }
  seedThreads(s);
}
function relationship(s, zone) {
  const c = s.continuity;
  if (!c.relationships[zone])
    c.relationships[zone] = {
      name: residentNames[zone] || 'A neighbour',
      familiarity: 0,
      trust: 0.1,
      last: -HOUR,
      meetings: [],
      shared: [],
    };
  return c.relationships[zone];
}
export function residentVoice(s, zone) {
  const c = s.continuity,
    r = c.relationships[zone];
  if (!r || !r.familiarity) return locals[zone]?.npc?.quote || '';
  if (zone === 'lantern' && c.threads.lamp?.phase >= 2)
    return '“Kept your crooked shade. The table is ours to see by now. Sit down, if you like.”';
  if (zone === 'cable' && s.life.delivered)
    return r.trust > 0.35
      ? '“You can come here without bringing me anything, you know.”'
      : '“The fuse held. I kept the wrapping. Mara always folds it that way.”';
  if (zone === 'crossing' && r.trust > 0.3)
    return '“You keep asking whether it is fixed. Sometimes listen for whether it is comfortable.”';
  if (zone === 'violet' && c.works.length)
    return '“I can hear the part you nearly threw away. Leave that bit in.”';
  return locals[zone]?.npc?.quote || '';
}
function ready(c, key, interval) {
  return c.cooldowns[key] === undefined || c.age - c.cooldowns[key] >= interval;
}
function available(s, zone, id) {
  return !!s.mind.known[zone + ':' + id];
}
export function continuityOptions(s) {
  const c = s.continuity || ensureContinuity(s),
    out = [];
  const add = (zone, id, type, reason, score = 1, payload = {}, evidence = '') => {
    if (available(s, zone, id)) out.push({ zone, id, type, reason, score, payload, evidence });
  };
  for (const th of Object.values(c.threads)) {
    if (c.age < th.due) continue;
    if (th.id === 'pump')
      add(
        'district',
        'pump',
        'life-pump',
        th.phase === 0
          ? 'I keep thinking about that first repair. Does it still sound right?'
          : c.traits.independence > 0.63
            ? 'I want to check it myself. I know I checked it before.'
            : 'I could listen once, then leave the pump to its evening.',
        2 + c.traits.care,
        {},
        'The missing gear was the first thing I mended here.',
      );
    if (th.id === 'lamp') {
      const z = th.phase === 1 ? 'district' : 'lantern',
        id = th.phase === 1 ? 'benchwork' : th.phase === 2 ? 'lamp' : 'npc';
      add(
        z,
        id,
        'life-lamp',
        th.phase === 0
          ? 'Mara lives with that light. I only switched it on.'
          : th.phase === 1
            ? 'A brighter lamp was my answer. I never asked what Mara needed.'
            : th.phase === 2
              ? 'The shade has cooled. It is uneven, but perhaps it will soften the light.'
              : 'I wonder what happens around that lamp when nobody needs a repair.',
        3 + c.traits.care,
        {},
        'The conductor worked. Its consequences are still unfolding.',
      );
    }
    if (th.id === 'parcel')
      add(
        'cable',
        'npc',
        'life-parcel',
        'I remember Edda’s face when the lamp came on. I could go without a parcel this time.',
        2 + c.traits.care,
      );
    if (th.id === 'signal') {
      const zone = th.phase === 1 ? 'blind' : th.phase === 3 ? 'crossing' : 'cable',
        id = th.phase === 1 ? 'cache' : th.phase === 3 ? 'npc' : 'beacon';
      add(
        zone,
        id,
        'life-signal',
        th.phase === 0
          ? 'The new mast keeps answering itself. I do not know why.'
          : th.phase === 1
            ? 'The recovered coil came from the dead street. There may be a connection.'
            : th.phase === 2
              ? 'Enough time has passed to compare the echo again.'
              : th.phase === 3
                ? 'Orin might hear something I keep missing.'
                : 'I still hear a pattern. I want another observation before I call it a message.',
        2 + c.traits.curiosity * 2,
        {},
        'An answer and an echo can sound alike.',
      );
    }
    if (th.id === 'moss')
      add(
        'district',
        'bench',
        'life-moss',
        'The little cutting is still on my mind. Growth will not hurry just because I want it to.',
        2 + c.traits.care,
      );
  }
  if (c.draft && c.age >= c.draft.due) {
    if (c.draft.phase === 'feedback') {
      for (const z of ['violet', 'crossing', 'lantern', 'cable'])
        if (s.city.talked.includes(z))
          add(
            z,
            'npc',
            'life-feedback',
            c.traits.independence > 0.65
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
    !c.draft &&
    c.samples.length >= 2 &&
    ready(c, 'compose', 6 * HOUR) &&
    s.life.skills.includes('Mechanics')
  )
    add(
      'district',
      'benchwork',
      'life-compose',
      'These sounds need not only tell me what is broken. I could make something from them.',
      1 + c.traits.curiosity,
    );
  if (c.works.length) {
    const work = c.works.at(-1);
    for (const z of s.city.talked)
      if (!work.shared.includes(z) && ready(c, 'share', HOUR))
        add(
          z,
          'npc',
          'life-share',
          `I made something from these streets. ${residentNames[z]} might hear a different thing in it.`,
          1.5 + c.traits.care,
          { work: work.id },
        );
  }
  if (s.stage >= 3 && ready(c, 'sample', 600)) {
    const choices = Object.values(s.mind.known).filter(
      (o) =>
        ['pump', 'regulator', 'beacon', 'lamp', 'cache'].includes(o.id) &&
        !c.samples.some((a) => a.zone === o.zone && a.day === Math.floor(c.age / DAY)),
    );
    for (const o of choices)
      add(
        o.zone,
        o.id,
        'life-listen',
        'There is a sound here I never needed for a repair. I want to keep it.',
        1 + c.traits.curiosity,
        { id: o.id },
      );
  }
  if (ready(c, 'company', 1800)) {
    for (const zone of s.city.talked) {
      const r = relationship(s, zone);
      if (c.age - r.last >= 1800)
        add(
          zone,
          'npc',
          'life-company',
          r.trust > 0.35
            ? `I want to spend a little time with ${r.name}. Nothing needs fixing.`
            : `I know what ${r.name} does here. Not much about who they are.`,
          1 + c.traits.care + (c.age - r.last) / DAY,
        );
    }
  }
  if (c.visitorNotes.some((n) => !n.read))
    add(
      'district',
      'bench',
      'life-note',
      'Someone left a thought beside the lantern. I have been carrying enough of my own.',
      4,
    );
  if (
    ready(c, 'reflect', 600) &&
    (c.energy < 0.35 ||
      c.strain > 0.55 ||
      (c.age - c.lastReflection >= 1800 &&
        c.memories.filter((m) => m.id > c.reflectedThrough).length >= 2))
  )
    add(
      'district',
      'bench',
      'life-reflect',
      c.strain > 0.55
        ? 'I am turning the same thought over. I need to stop pushing it for a while.'
        : 'I want to sit with what happened before deciding what it means.',
      c.energy < 0.18 ? 10 : 2,
    );
  return out.sort((a, b) => b.score - a.score);
}
export function continuityDecision(s, urgent = false) {
  const c = s.continuity || ensureContinuity(s);
  if (urgent && c.age - c.lastAction < 180) return null;
  const options = continuityOptions(s);
  return urgent ? options.find((o) => o.score >= 3) || null : options[0] || null;
}
export function ambientDecision(s) {
  const c = s.continuity;
  if (!ready(c, 'wander', 180)) return null;
  const places = Object.values(s.mind.known).filter((o) =>
    ['bench', 'pump', 'npc', 'cache'].includes(o.id),
  );
  if (!places.length) return null;
  const p = places[(Math.floor(c.age / 180) + c.seed) % places.length];
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
function finish(s, type, text, memory) {
  const c = s.continuity;
  c.lastAction = c.age;
  c.energy = clamp(c.energy - 0.012);
  s.mood = c.strain > 0.45 ? 'Unsettled' : c.energy < 0.3 ? 'Tired' : 'Thoughtful';
  const e = appendEvent(s, type, text, memory);
  return e;
}
function consolidate(s) {
  const c = s.continuity;
  if (c.age - c.lastReflection < 1800) return null;
  const recent = c.memories.filter((m) => m.id > c.reflectedThrough);
  if (recent.length < 2) return null;
  const care = c.memories.filter((m) =>
    ['life-parcel', 'life-company', 'life-share', 'life-feedback', 'deliver-parcel'].includes(
      m.kind,
    ),
  );
  const check = c.memories.filter((m) => ['life-pump', 'life-lamp', 'repair'].includes(m.kind));
  const experiments = c.memories.filter((m) =>
    ['life-signal', 'experiment', 'life-compose'].includes(m.kind),
  );
  let text = 'I do not need to turn every evening into an answer.';
  const evidence = [];
  const revise = (key, line, ms, trait, delta) => {
    if (ms.length < 2) return;
    const support = ms.slice(-3).map((m) => m.id),
      old = c.beliefs.find((b) => b.key === key);
    if (old && support.every((id) => old.evidence.includes(id))) return;
    c.traits[trait] = clamp(c.traits[trait] + delta, 0.15, 0.9);
    if (old) {
      old.text = line;
      old.evidence = [...new Set([...old.evidence, ...support])].slice(-8);
      old.revised = c.age;
    } else c.beliefs.push({ key, text: line, evidence: support, since: c.age, revised: c.age });
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
    c.threads.pump?.visits >= 3
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
  c.lastReflection = c.age;
  c.reflectedThrough = c.nextMemory - 1;
  c.reflections.push({ at: c.age, text, evidence: [...new Set(evidence)] });
  c.reflections = c.reflections.slice(-30);
  return text;
}
export function continuityAction(s, type, payload, points) {
  const c = s.continuity || ensureContinuity(s);
  const near = (id) => points[id] && Math.hypot(s.x - points[id].x, s.y - points[id].y) < 90;
  if (type === 'life-linger') {
    if (!near(payload.id) || !ready(c, 'wander', 180)) return null;
    c.cooldowns.wander = c.age;
    c.energy = clamp(c.energy + 0.018);
    c.lastAmbient = c.age;
    return finish(s, type, 'Iona spent a quiet moment in a familiar part of the streets.', '');
  }
  const option = continuityOptions(s).find(
    (o) => o.type === type && o.zone === s.zone && near(o.id),
  );
  if (!option) return null;
  let text = '',
    memory = '';
  const th = c.threads[type.slice(5)];
  if (type === 'life-pump') {
    th.visits++;
    if (th.visits === 1) {
      memory = 'Still turning. I expected to feel finished. Instead I want to come back.';
      th.phase = 1;
      th.due = c.age + HOUR;
    } else if (th.visits === 2) {
      memory =
        'I nearly tightened a sound fitting. There was nothing wrong with it. I wanted to be needed.';
      th.phase = 2;
      c.strain = clamp(c.strain + 0.12);
      th.due = c.age + 4 * HOUR;
    } else {
      memory =
        c.traits.independence > 0.63
          ? 'I listened twice. It did not need me either time. I left my tools in the bag.'
          : 'The rhythm held. I can care about this place without holding every part of it still.';
      th.due = c.age + 6 * HOUR;
      c.strain = clamp(c.strain - 0.08);
    }
    text = 'Iona checked the repaired pump, then left it running without changing the mechanism.';
  } else if (type === 'life-lamp') {
    if (th.phase === 0) {
      memory =
        'Mara thanked me for the light, then moved her chair out of it. I had not noticed the glare.';
      text = 'Mara showed Iona where the repaired lamp shone into her eyes.';
      th.phase = 1;
      th.due = c.age + 120;
      c.strain = clamp(c.strain + 0.12);
    } else if (th.phase === 1) {
      memory =
        'The first fold cracked. I kept the second, crooked one. It needs time before I fit it.';
      text = 'Iona shaped a small lamp shade at the winding bench; the first attempt split.';
      th.phase = 2;
      th.due = c.age + HOUR;
    } else if (th.phase === 2) {
      memory =
        'Less bright on the stairs, kinder at the table. I had to choose what the light was for.';
      text =
        'Iona fitted her uneven shade. The lamp now threw a softer pool of light beside Mara’s table.';
      th.phase = 3;
      th.due = c.age + DAY;
      c.traits.care = clamp(c.traits.care + 0.025);
    } else {
      memory =
        'There was another chair under the lamp. Mara had left it for me. I brought no tools.';
      text = 'Iona sat with Mara under the shade they had found a use for together.';
      th.visits++;
      th.due = c.age + DAY;
      const r = relationship(s, 'lantern');
      r.trust = clamp(r.trust + 0.06);
      r.familiarity++;
      r.last = c.age;
    }
  } else if (type === 'life-parcel') {
    const r = relationship(s, 'cable');
    r.familiarity++;
    r.trust = clamp(r.trust + 0.06);
    r.last = c.age;
    if (th.phase === 0) {
      text = 'Iona asked Edda about the fuse she had delivered.';
      memory =
        'Edda remembered my name. I had prepared a question about the lamp, not about myself.';
      th.phase = 1;
      th.due = c.age + 4 * HOUR;
    } else {
      memory =
        r.trust > 0.4
          ? 'Edda asked me to stay. I did not make up a job to justify it.'
          : 'Edda said I can visit without a delivery. I still checked my bag before I sat down.';
      text = 'Iona stayed with Edda after their conversation about the working lamp.';
      th.visits++;
      th.due = c.age + DAY;
    }
  } else if (type === 'life-signal') {
    if (th.phase === 0) {
      memory = 'Three notes, and three back. Someone answering? Or a pipe with my own voice in it?';
      text = 'Iona heard a delayed echo from the restored signal mast.';
      th.phase = 1;
      th.due = c.age + 120;
    } else if (th.phase === 1) {
      memory =
        'The case at Cinder End has the same three marks. That is a connection, not proof of a listener.';
      text = 'Iona compared the coil case’s markings with the mast’s pulse pattern.';
      th.phase = 2;
      th.due = c.age + 2 * HOUR;
    } else if (th.phase === 2) {
      memory =
        'The delay shortened as the pipes warmed. I wanted it to be an answer. That does not make it one.';
      text =
        'Iona compared the later signal with her earlier observation; the return timing had changed.';
      th.phase = 3;
      th.due = c.age + 900;
      c.strain = clamp(c.strain + 0.15);
    } else if (th.phase === 3) {
      memory =
        'Orin tapped a return pipe. The echo matched. We could make a tune with this, even if nobody is answering.';
      text = 'Orin demonstrated a return-pipe echo while Iona compared her notes.';
      th.phase = 4;
      th.due = c.age + DAY;
      c.traits.independence = clamp(c.traits.independence - 0.025);
      const r = relationship(s, 'crossing');
      r.trust = clamp(r.trust + 0.08);
      r.last = c.age;
      addSample(s, 'crossing', 'return-pipe', 'a reply made by a return pipe');
    } else {
      memory =
        'I know one explanation now. I am keeping the odd notes anyway. They might become something else.';
      text = 'Iona recorded another variation in the mast’s echo.';
      th.visits++;
      th.due = c.age + DAY;
      addSample(s, 'cable', 'beacon', 'an uneven three-note echo');
    }
  } else if (type === 'life-moss') {
    th.visits++;
    const days = (c.age - th.opened) / DAY;
    memory =
      days < 1
        ? 'No new leaf yet. I moved the tin out of the heat. It does not owe me a result.'
        : days < 3
          ? 'A pale edge has opened. I almost missed it because I was looking for a whole new plant.'
          : 'The cutting has taken to the lantern corner. I am learning its pace rather than imposing mine.';
    text = 'Iona checked the moss cutting and adjusted its place beneath the lantern.';
    th.phase = Math.min(3, Math.floor(days));
    th.due = c.age + 6 * HOUR;
  } else if (type === 'life-listen') {
    const sounds = {
      pump: 'the low, uneven warmth of the pump',
      regulator: 'a thin whistle above the flywheel',
      beacon: 'three notes disappearing into the haze',
      lamp: 'the small buzz beneath a warm lamp',
      cache: 'a hollow note from the discarded coil case',
    };
    const sample = addSample(s, s.zone, option.id, sounds[option.id]);
    if (!sample) return null;
    memory = `I kept ${sample.sound}. It is not a fault. I like it.`;
    text = 'Iona tapped out a local rhythm and added it to her collection of sounds.';
    c.cooldowns.sample = c.age;
  } else if (type === 'life-compose') {
    c.cooldowns.compose = c.age;
    if (!c.draft) {
      c.draft = {
        phase: 'feedback',
        due: c.age + 900,
        started: c.age,
        sources: c.samples.slice(-4).map((a) => a.id),
        feedback: null,
      };
      memory =
        'I copied all the rhythms exactly. It sounds like a maintenance report. I want it to sound like being here.';
      text = 'Iona made a first sound sketch at the bench, then left it unfinished.';
      c.strain = clamp(c.strain + 0.12);
    } else {
      const d = c.draft;
      const motif =
        c.traits.care >= c.traits.independence ? 'Room for another voice' : 'The part that catches';
      const work = {
        id: c.works.length ? c.works.at(-1).id + 1 : 1,
        title: motif,
        at: c.age,
        sources: d.sources,
        feedback: d.feedback,
        shared: [],
        revision: (c.works.at(-1)?.revision || 0) + 1,
        notes: d.sources.map((id, i) => {
          const sample = c.samples.find((a) => a.id === id);
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
      c.works.push(work);
      c.works = c.works.slice(-20);
      c.draft = null;
      memory = `I left a pause in “${motif}”. The gap is the part I kept changing. Someone else could put a sound there.`;
      text = `Iona kept a new arrangement, “${motif}”, built from remembered street sounds and a neighbour’s feedback.`;
      c.strain = clamp(c.strain - 0.15);
    }
  } else if (type === 'life-feedback') {
    const r = relationship(s, s.zone);
    r.trust = clamp(r.trust + 0.06);
    r.familiarity++;
    r.last = c.age;
    c.draft.feedback = r.name;
    c.draft.phase = 'revise';
    c.draft.due = c.age + 1800;
    memory = `${r.name} said the pause was the interesting part. I nearly filled it before asking. I need to hear it again later.`;
    text = `Iona let ${r.name} hear her unfinished sound sketch and kept their suggestion.`;
  } else if (type === 'life-share') {
    const w = c.works.at(-1);
    w.shared.push(s.zone);
    c.cooldowns.share = c.age;
    const r = relationship(s, s.zone);
    r.trust = clamp(r.trust + 0.04);
    r.last = c.age;
    r.shared.push(w.id);
    memory = `${r.name} tapped a different ending to “${w.title}”. It is not what I meant. I want to remember it anyway.`;
    text = `Iona shared “${w.title}” with ${r.name}, who added an ending of their own.`;
    addSample(s, s.zone, 'reply', `${r.name}’s unexpected ending`);
  } else if (type === 'life-company') {
    const r = relationship(s, s.zone);
    r.familiarity++;
    r.trust = clamp(r.trust + 0.025);
    r.last = c.age;
    c.cooldowns.company = c.age;
    r.meetings.push(c.age);
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
    memory = lines[s.zone][Math.floor(r.familiarity / 2) % 2];
    text = `Iona spent time with ${r.name}, without taking on a job.`;
    c.strain = clamp(c.strain - 0.04);
  } else if (type === 'life-note') {
    const n = c.visitorNotes.find((n) => !n.read);
    n.read = true;
    n.readAt = c.age;
    c.traits[n.influence] = clamp(
      c.traits[n.influence] + (n.influence === 'independence' ? -0.015 : 0.015),
    );
    memory =
      n.influence === 'care'
        ? 'Someone wondered who I could sit with. I keep thinking I need a reason to visit.'
        : n.influence === 'curiosity'
          ? 'Someone asked what I would make for no practical reason. I have been listening differently since.'
          : 'Someone said I could leave a working thing alone. I agree with the words. Doing it is harder.';
    text = 'Iona read a visitor’s thought and kept it in her notebook.';
  } else if (type === 'life-reflect') {
    const reflection = consolidate(s);
    c.energy = clamp(c.energy + 0.4);
    c.strain = clamp(c.strain - 0.2);
    c.cooldowns.reflect = c.age;
    memory = reflection || 'I can leave a question open and still have had an evening.';
    text = 'Iona rested beneath the lantern and reconsidered the experiences she had kept.';
  } else return null;
  if (th) {
    const m = c.memories.at(-1);
    if (m) th.evidence = [...new Set([...th.evidence, m.id])].slice(-8);
  }
  return finish(s, type, text, memory);
}
function addSample(s, zone, id, sound) {
  const c = s.continuity,
    day = Math.floor(c.age / DAY);
  if (c.samples.some((a) => a.zone === zone && a.day === day && a.object === id)) return null;
  const sample = { id: (c.samples.at(-1)?.id || 0) + 1, zone, object: id, day, at: c.age, sound };
  c.samples.push(sample);
  c.samples = c.samples.slice(-40);
  return sample;
}
export function leaveThought(s, influence) {
  const c = s.continuity;
  if (
    !['care', 'curiosity', 'independence'].includes(influence) ||
    c.visitorNotes.some((n) => !n.read) ||
    !ready(c, 'visitor', 1800)
  )
    return false;
  const text = {
    care: 'Who would you visit if you had nothing to bring?',
    curiosity: 'What would you make if it did not have to be useful?',
    independence: 'Could a thing keep working without you watching it?',
  }[influence];
  c.visitorNotes.push({ text, influence, at: c.age, read: false });
  c.visitorNotes = c.visitorNotes.slice(-20);
  c.cooldowns.visitor = c.age;
  return true;
}
