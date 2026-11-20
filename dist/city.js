export const CW = 1672,
  CH = 941;
const locations = {
  district: {
    name: 'The Foundry Lanes',
    subtitle: 'THE LOWER DISTRICT',
    map: [2, 0],
    neighbors: { south: 'crossing' },
  },
  crossing: {
    name: 'Sump Crossing',
    subtitle: 'ABOVE THE GREEN DEPTHS',
    map: [2, 1],
    neighbors: { north: 'district', west: 'lantern', east: 'boiler', south: 'cable' },
    thought: 'Four ways out. The lamps must mean something to the people who know these streets.',
  },
  lantern: {
    name: 'Lantern Row',
    subtitle: 'THE OLD TENEMENTS',
    map: [0, 1],
    neighbors: { east: 'crossing', south: 'violet' },
    thought: 'Warm windows above cold pipes. Someone has made a home in every gap.',
  },
  violet: {
    name: 'Violet Market',
    subtitle: 'BENEATH THE AWNINGS',
    map: [0, 2],
    neighbors: { north: 'lantern', east: 'cable' },
    thought:
      'The street doubles back beneath the washing lines. I can hear the crossing from here.',
  },
  cable: {
    name: 'Cable Walk',
    subtitle: 'THE HANGING STREETS',
    map: [2, 2],
    neighbors: { north: 'crossing', west: 'violet', east: 'boiler' },
    thought: 'A whole street hanging from cables. I’m glad someone checks the bolts.',
  },
  boiler: {
    name: 'Boiler Court',
    subtitle: 'THE PRESSURE WORKS',
    map: [4, 1],
    neighbors: { west: 'crossing', south: 'cable', east: 'blind' },
    thought: 'The boiler’s vibration comes through my boots. There’s a latch on the lower passage.',
  },
  blind: {
    name: 'Cinder End',
    subtitle: 'AT THE END OF THE LANE',
    map: [6, 1],
    neighbors: { west: 'boiler' },
    thought: 'A wall, a quiet doorway, and no way through. Still, people have left things here.',
  },
};
export const scenes = locations;
export const portals = {
  west: { x: 24, y: 640 },
  east: { x: CW - 24, y: 640 },
  south: { x: 890, y: CH - 24 },
  north: { x: 890, y: 405 },
};
export const districtBoundary = [
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
export function freshCity() {
  return { visited: ['district'], shortcut: false, recovered: false, talked: [] };
}
export function sceneOf(s) {
  return scenes[s.zone] || scenes.district;
}
export function exitLocked(s, dir) {
  return (
    !s.city.shortcut &&
    ((s.zone === 'cable' && dir === 'east') || (s.zone === 'boiler' && dir === 'south'))
  );
}
export function exits(s) {
  return Object.fromEntries(
    Object.entries(sceneOf(s).neighbors).map(([dir, to]) => [
      'exit-' + dir,
      {
        ...portalFor(s.zone, dir),
        name: scenes[to].name,
        verb: exitLocked(s, dir) ? 'Inspect bolted shortcut' : 'Continue to ' + scenes[to].name,
        dir,
        to,
        exit: true,
        locked: exitLocked(s, dir),
      },
    ]),
  );
}
function pointIn(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}
export const streetBounds = {
  crossing: [
    [8, 468],
    [680, 492],
    [745, 435],
    [800, 360],
    [895, 360],
    [965, 467],
    [1200, 490],
    [1664, 425],
    [1664, 520],
    [1300, 590],
    [1005, 657],
    [1030, 933],
    [730, 933],
    [750, 667],
    [650, 608],
    [8, 545],
  ],
  lantern: [
    [240, 633],
    [570, 588],
    [900, 553],
    [1210, 535],
    [1470, 498],
    [1664, 430],
    [1664, 519],
    [1470, 566],
    [1020, 623],
    [935, 686],
    [970, 933],
    [742, 933],
    [744, 697],
    [665, 664],
    [240, 707],
  ],
  boiler: [
    [8, 500],
    [440, 535],
    [820, 510],
    [1040, 525],
    [1300, 500],
    [1664, 473],
    [1664, 548],
    [1470, 580],
    [1110, 665],
    [1040, 730],
    [1085, 933],
    [782, 933],
    [760, 733],
    [690, 681],
    [400, 620],
    [8, 550],
  ],
  cable: [
    [8, 495],
    [250, 535],
    [650, 507],
    [795, 477],
    [845, 395],
    [885, 330],
    [960, 330],
    [975, 385],
    [925, 480],
    [1260, 480],
    [1510, 449],
    [1664, 414],
    [1664, 486],
    [1480, 515],
    [1140, 554],
    [650, 588],
    [255, 600],
    [8, 646],
  ],
  blind: [
    [8, 500],
    [170, 563],
    [580, 576],
    [840, 540],
    [1220, 555],
    [1460, 602],
    [1250, 634],
    [850, 670],
    [530, 699],
    [8, 737],
  ],
  violet: [
    [230, 640],
    [790, 535],
    [850, 450],
    [850, 385],
    [970, 385],
    [1000, 500],
    [1330, 512],
    [1664, 479],
    [1664, 550],
    [1370, 595],
    [1050, 655],
    [730, 708],
    [500, 780],
    [235, 725],
  ],
};
const exitPoints = {
  district: { south: [890, 917] },
  crossing: { west: [24, 505], east: [1648, 470], north: [850, 395], south: [890, 917] },
  lantern: { east: [1648, 485], south: [845, 917] },
  boiler: { west: [24, 525], east: [1648, 505], south: [920, 917] },
  cable: { west: [24, 560], east: [1648, 450], north: [905, 395] },
  blind: { west: [24, 615] },
  violet: { north: [905, 405], east: [1648, 515] },
};
export function portalFor(zone, dir) {
  const [x, y] = exitPoints[zone][dir];
  return { x, y };
}
export function sceneWalkable(zone, x, y) {
  if (x < 8 || y < 8 || x > CW - 8 || y > CH - 8) return false;
  return pointIn(zone === 'district' ? districtBoundary : streetBounds[zone] || [], x, y);
}
export function appendEvent(s, type, text, memory = '') {
  const e = { id: (s.events.at(-1)?.id || 0) + 1, time: s.elapsed, type, text, memory };
  s.events.push(e);
  if (s.events.length > 150) s.events.shift();
  return e;
}
export function travel(s, dir) {
  const exit = exits(s)['exit-' + dir];
  if (!exit || exit.locked || Math.hypot(s.x - exit.x, s.y - exit.y) > 105) return null;
  const from = s.zone,
    to = exit.to;
  s.zone = to;
  const incoming = Object.entries(scenes[to].neighbors).find(([, v]) => v === from)?.[0];
  const p = portalFor(to, incoming);
  s.x = p.x;
  s.y = p.y;
  if (incoming === 'west') s.x += 145;
  if (incoming === 'east') s.x -= 145;
  if (incoming === 'south') s.y -= 145;
  if (incoming === 'north') s.y += 145;
  if (!sceneWalkable(to, s.x, s.y)) {
    const nearest = navigation(to).nodes.reduce((a, b) =>
      Math.hypot(a.x - s.x, a.y - s.y) < Math.hypot(b.x - s.x, b.y - s.y) ? a : b,
    );
    s.x = nearest.x;
    s.y = nearest.y;
  }
  const first = !s.city.visited.includes(to);
  if (first) s.city.visited.push(to);
  s.mood = first ? 'Curious' : 'Familiar';
  return appendEvent(
    s,
    'travel',
    `Iona followed the ${dir} passage from ${scenes[from].name} to ${scenes[to].name}.`,
    first ? scenes[to].thought || 'Back among the lamps and the sound of the pump.' : '',
  );
}
export function crossedExit(s) {
  for (const [id, p] of Object.entries(exits(s))) {
    if (p.locked) continue;
    if (
      (p.dir === 'west' && s.x < 35) ||
      (p.dir === 'east' && s.x > CW - 35) ||
      (p.dir === 'south' && s.y > CH - 38) ||
      (p.dir === 'north' && s.y < p.y + 16 && Math.abs(s.x - p.x) < 85)
    ) {
      if (Math.hypot(s.x - p.x, s.y - p.y) < 100) return id;
    }
  }
  return null;
}
export function nextDirection(s, target) {
  if (target === s.zone) return null;
  const queue = [[s.zone, null]],
    seen = new Set([s.zone]);
  while (queue.length) {
    const [zone, first] = queue.shift();
    for (const [dir, to] of Object.entries(scenes[zone].neighbors)) {
      if (
        !s.city.shortcut &&
        ((zone === 'cable' && to === 'boiler') || (zone === 'boiler' && to === 'cable'))
      )
        continue;
      if (seen.has(to)) continue;
      const head = first || dir;
      if (to === target) return head;
      seen.add(to);
      queue.push([to, head]);
    }
  }
  return null;
}
export const locals = {
  crossing: {
    npc: {
      x: 1100,
      y: 545,
      name: 'Orin · pipewatcher',
      verb: 'Talk to Orin',
      npc: 0,
      quote:
        'A pipe under strain has a different note. Close your eyes a moment. You can hear which one is working too hard.',
    },
  },
  lantern: {
    npc: {
      x: 600,
      y: 650,
      name: 'Mara · courier',
      verb: 'Talk to Mara',
      npc: 1,
      quote:
        'I keep meaning to cross over. Then another delivery comes in, and this little parcel stays in my pocket.',
    },
  },
  violet: {
    npc: {
      x: 1040,
      y: 600,
      name: 'Ves · scrap broker',
      verb: 'Talk to Ves',
      npc: 2,
      quote:
        'People throw away things when their shape stops making sense. The copper does not care what it used to be.',
    },
  },
  cable: {
    npc: {
      x: 650,
      y: 550,
      name: 'Edda · cable keeper',
      verb: 'Talk to Edda',
      npc: 3,
      quote:
        'The carriages used to follow a green signal. Haven’t seen one in a while. I still check the empty lamp, out of habit.',
    },
  },
  boiler: {
    latch: {
      x: 930,
      y: 710,
      name: 'Service-gate latch',
      verb: 'Open the shortcut',
      quote: 'A heavy bolt closes the stairs to Cable Walk. It can be lifted from this side.',
    },
  },
  blind: {
    cache: {
      x: 1150,
      y: 600,
      name: 'Discarded coil case',
      verb: 'Look through the salvage',
      quote:
        'The street stops at a bricked-up arch. Under a sheet of canvas, a copper coil is waiting for a second life.',
    },
  },
};
const navGrids = new Map();
const CELL = 20,
  NC = Math.ceil(CW / CELL),
  NR = Math.ceil(CH / CELL);
function navigation(zone) {
  if (navGrids.has(zone)) return navGrids.get(zone);
  const nodes = [];
  for (let r = 0; r < NR; r++)
    for (let c = 0; c < NC; c++) {
      const x = c * CELL + 10,
        y = r * CELL + 10;
      if (sceneWalkable(zone, x, y)) nodes.push({ id: r * NC + c, c, r, x, y });
    }
  const grid = new Map(nodes.map((n) => [n.id, n]));
  const value = { nodes, grid };
  navGrids.set(zone, value);
  return value;
}
export function streetRoute(s, x, y) {
  const { nodes, grid } = navigation(s.zone);
  const closest = (x, y) =>
    nodes.reduce((a, b) =>
      (b.x - x) ** 2 + (b.y - y) ** 2 < (a.x - x) ** 2 + (a.y - y) ** 2 ? b : a,
    );
  const start = closest(s.x, s.y),
    end = closest(x, y);
  const queue = [start],
    from = new Map([[start.id, null]]);
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    if (n.id === end.id) {
      const out = [];
      let p = n;
      while (p) {
        out.unshift({ x: p.x, y: p.y });
        p = from.get(p.id);
      }
      if (sceneWalkable(s.zone, x, y)) out.push({ x, y });
      return out;
    }
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = (n.r + dr) * NC + n.c + dc,
        p = grid.get(k);
      if (p && Math.abs(p.c - n.c) <= 1 && !from.has(k)) {
        from.set(k, n);
        queue.push(p);
      }
    }
  }
  return [];
}
export function cityObjective(s) {
  if (!s.city.recovered)
    return {
      title: 'Streets within streets',
      text: `${s.city.visited.length} of ${Object.keys(scenes).length} neighborhoods explored. Follow the passages, meet the locals, and find what the city has left behind.`,
      step: 'Explore the routes from here',
      target:
        Object.keys(exits(s)).find((id) => !s.city.visited.includes(exits(s)[id].to)) ||
        Object.keys(exits(s))[0],
    };
  return {
    title: 'A city taking shape',
    text: s.city.shortcut
      ? 'A coil recovered, a shortcut opened. These streets are beginning to feel familiar.'
      : 'The coil has a second chance. There may still be a shorter way between these streets.',
    step: 'Keep exploring the undercity',
    target: Object.keys(exits(s))[0],
  };
}

export function safePosition(zone, x = 840, y = 610) {
  if (sceneWalkable(zone, x, y)) return { x, y };
  const nearest = navigation(zone).nodes.reduce((a, b) =>
    Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? a : b,
  );
  return { x: nearest.x, y: nearest.y };
}
