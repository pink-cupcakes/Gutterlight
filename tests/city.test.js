import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scenes,
  sceneWalkable,
  exits,
  portalFor,
  crossedExit,
  streetRoute,
  travel,
  nextDirection,
  locals,
  safePosition,
} from '../dist/city.js';
import { initialState, loadState, commit, activePlaces } from '../dist/world-model.js';
const arrive = (s, zone) => Object.assign(s, { zone, ...safePosition(zone) });
const atExit = (s, dir) => Object.assign(s, portalFor(s.zone, dir));
test('seven neighborhoods form a connected street graph with a loop and dead end', () => {
  assert.equal(Object.keys(scenes).length, 7);
  const seen = new Set(['district']),
    q = ['district'];
  for (const id of q)
    for (const to of Object.values(scenes[id].neighbors)) {
      assert.ok(Object.values(scenes[to].neighbors).includes(id), 'links are reciprocal');
      if (!seen.has(to)) {
        seen.add(to);
        q.push(to);
      }
    }
  assert.equal(seen.size, 7);
  assert.deepEqual(scenes.blind.neighbors, { west: 'boiler' });
  const s = initialState();
  for (const [from, to] of [
    ['crossing', 'lantern'],
    ['lantern', 'violet'],
    ['violet', 'cable'],
    ['cable', 'crossing'],
  ]) {
    s.zone = from;
    assert.ok(Object.values(scenes[from].neighbors).includes(to));
    assert.ok(nextDirection(s, to));
  }
});
test('all painted street destinations have collision-safe paths', () => {
  const s = initialState();
  s.city.shortcut = true;
  for (const zone of Object.keys(scenes)) {
    arrive(s, zone);
    for (const [id, p] of Object.entries(activePlaces(s))) {
      assert.ok(sceneWalkable(zone, p.x, p.y), `${zone}/${id} destination walkable`);
      const path = streetRoute(s, p.x, p.y);
      assert.ok(path.length, `${zone}/${id} route exists`);
      let prev = { x: s.x, y: s.y };
      for (const next of path) {
        const steps = Math.max(1, Math.ceil(Math.hypot(next.x - prev.x, next.y - prev.y) / 3));
        for (let i = 0; i <= steps; i++) {
          assert.ok(
            sceneWalkable(
              zone,
              prev.x + ((next.x - prev.x) * i) / steps,
              prev.y + ((next.y - prev.y) * i) / steps,
            ),
            `${zone}/${id} segment safe`,
          );
        }
        prev = next;
      }
    }
  }
});
test('edge crossings enter the next scene and spawn clear of reverse exit', () => {
  const s = initialState();
  s.city.shortcut = true;
  for (const zone of Object.keys(scenes))
    for (const dir of Object.keys(scenes[zone].neighbors)) {
      s.zone = zone;
      atExit(s, dir);
      assert.equal(crossedExit(s), 'exit-' + dir);
      assert.ok(travel(s, dir));
      assert.equal(s.zone, scenes[zone].neighbors[dir]);
      assert.ok(sceneWalkable(s.zone, s.x, s.y));
      assert.equal(crossedExit(s), null, 'no immediate bounce back');
      const back = Object.entries(scenes[s.zone].neighbors).find(([, v]) => v === zone)[0];
      atExit(s, back);
      assert.ok(travel(s, back));
      assert.equal(s.zone, zone);
    }
});
test('service shortcut must be unbolted from Boiler Court and remains open', () => {
  const s = initialState();
  arrive(s, 'cable');
  atExit(s, 'east');
  assert.equal(commit(s, 'travel:east'), null);
  assert.equal(commit(s, 'unlatch'), null);
  assert.equal(nextDirection(s, 'boiler'), 'north');
  arrive(s, 'boiler');
  atExit(s, 'south');
  assert.equal(commit(s, 'travel:south'), null);
  Object.assign(s, locals.boiler.latch);
  assert.ok(commit(s, 'unlatch'));
  assert.equal(commit(s, 'unlatch'), null);
  atExit(s, 'south');
  assert.ok(commit(s, 'travel:south'));
  assert.equal(s.zone, 'cable');
  assert.equal(nextDirection(s, 'boiler'), 'east');
  assert.equal(loadState(JSON.stringify(s)).city.shortcut, true);
});
test('dead-end salvage and resident memories use proximity and are recorded once', () => {
  const s = initialState();
  assert.equal(commit(s, 'recover'), null);
  arrive(s, 'blind');
  Object.assign(s, locals.blind.cache);
  assert.ok(commit(s, 'recover'));
  assert.equal(commit(s, 'recover'), null);
  arrive(s, 'lantern');
  assert.equal(commit(s, 'talk'), null);
  Object.assign(s, locals.lantern.npc);
  assert.ok(commit(s, 'talk'));
  assert.equal(commit(s, 'talk'), null);
  assert.ok(s.city.talked.includes('lantern'));
});
test('earlier maze saves preserve progress and reward, and relocate safely into streets', () => {
  const s = initialState();
  delete s.city;
  s.zone = 'maze';
  s.x = 1488;
  s.y = 1920;
  s.maze = { recovered: true, valves: ['valve1'], seen: {} };
  s.stage = 5;
  const restored = loadState(JSON.stringify(s));
  assert.equal(restored.zone, 'crossing');
  assert.equal(restored.stage, 5);
  assert.equal(restored.city.recovered, true);
  assert.ok(sceneWalkable(restored.zone, restored.x, restored.y));
  assert.deepEqual(restored.events, s.events);
});
