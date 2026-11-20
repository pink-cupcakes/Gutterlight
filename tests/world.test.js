import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  commit,
  places,
  walkable,
  loadState,
  objective,
} from '../dist/world-model.js';
const visit = (s, id) => Object.assign(s, { x: places[id].x, y: places[id].y });
test('repair story commits valid consequences and consumes its component', () => {
  const s = initialState();
  assert.equal(commit(s, 'repair'), null);
  assert.equal(commit(s, 'take-gear'), null);
  visit(s, 'pump');
  assert.ok(commit(s, 'inspect'));
  assert.equal(s.stage, 1);
  assert.equal(commit(s, 'inspect'), null);
  visit(s, 'market');
  assert.ok(commit(s, 'take-gear'));
  assert.equal(s.gear, 1);
  assert.equal(commit(s, 'repair'), null);
  visit(s, 'pump');
  assert.ok(commit(s, 'repair'));
  assert.equal(s.gear, 0);
  assert.equal(s.stage, 3);
  assert.equal(commit(s, 'repair'), null);
  visit(s, 'tank');
  assert.ok(commit(s, 'balance'));
  visit(s, 'gate');
  assert.ok(commit(s, 'workshop'));
  assert.equal(s.stage, 5);
  assert.equal(s.events.length, 6);
});
test('a second pump visit depends on repair memory and is recorded once', () => {
  const s = initialState();
  visit(s, 'pump');
  assert.equal(commit(s, 'revisit'), null);
  commit(s, 'inspect');
  visit(s, 'market');
  commit(s, 'take-gear');
  visit(s, 'pump');
  commit(s, 'repair');
  const e = commit(s, 'revisit');
  assert.match(e.memory, /came back to check/);
  assert.equal(commit(s, 'revisit'), null);
});
test('visitor gift persists and cannot be duplicated', () => {
  const s = initialState();
  assert.ok(commit(s, 'gift'));
  assert.equal(commit(s, 'gift'), null);
  s.x = 1300;
  assert.equal(commit(s, 'notice-gift'), null);
  s.x = s.gift.x;
  assert.ok(commit(s, 'notice-gift'));
  assert.equal(s.gift.noticed, true);
  assert.equal(commit(s, 'notice-gift'), null);
  const saved = loadState(JSON.stringify(s));
  assert.equal(saved.gift.noticed, true);
  assert.deepEqual(saved.events, s.events);
});
test('all interaction destinations are walkable; buildings and pump body are blocked', () => {
  for (const p of Object.values(places)) assert.ok(walkable(p.x, p.y), p.name);
  assert.ok(walkable(820, 656));
  assert.equal(walkable(895, 250), false);
  assert.equal(walkable(1420, 631), false);
  assert.equal(walkable(10, 900), false);
});
test('invalid saves recover and objectives match progression', () => {
  assert.equal(loadState('bad').stage, 0);
  assert.equal(loadState('{"version":2}').stage, 0);
  const s = initialState();
  s.stage = 7;
  assert.equal(loadState(JSON.stringify(s)).stage, 0);
  s.stage = 2;
  s.gear = 0;
  const loaded = loadState(JSON.stringify(s));
  assert.equal(loaded.gear, 1);
  assert.equal(objective(loaded).target, 'pump');
});
