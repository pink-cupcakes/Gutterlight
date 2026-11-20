import test from 'node:test';
import assert from 'node:assert/strict';
import { createDialogs } from '../dist/ui/dialogs.js';
import { initialState, commit, places } from '../dist/world-model.js';

function harness(t) {
  const previousDocument = globalThis.document;
  const elements = new Map();
  let actions = [];
  let state = initialState();
  let resets = 0;
  const element = (id) => {
    if (!elements.has(id)) {
      const node = {
        open: false,
        style: {},
        classList: { toggle() {} },
        focus() {},
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
        querySelector() {
          return {
            setAttribute() {},
            append(button) {
              actions.push(button);
            },
          };
        },
      };
      let markup = '';
      Object.defineProperty(node, 'innerHTML', {
        get() {
          return markup;
        },
        set(value) {
          markup = value;
          if (id === 'dialog-content') actions = [];
        },
      });
      elements.set(id, node);
    }
    return elements.get(id);
  };
  globalThis.document = {
    getElementById: element,
    createElement: () => ({}),
    querySelectorAll: () => [],
  };
  t.after(() => {
    globalThis.document = previousDocument;
  });
  const noop = () => {};
  const dialogs = createDialogs({
    getState: () => state,
    getMode: () => 'explore',
    toggleSound: noop,
    isSoundOn: () => false,
    canvas: element('world'),
    clearInput: noop,
    perform: (type, payload) => Boolean(commit(state, type, payload)),
    say: noop,
    toast: noop,
    save: noop,
    setMode: noop,
    goPlace: noop,
    playWork: noop,
    resetWorld() {
      resets++;
      state = initialState();
    },
  });
  const click = (label) => {
    const button = actions.find((button) => button.textContent === label);
    assert.ok(button, `action exists: ${label}`);
    button.onclick();
  };
  return {
    dialogs,
    element,
    click,
    get state() {
      return state;
    },
    get resets() {
      return resets;
    },
  };
}

test('object dialogs commit observations and repairs through the controller', (t) => {
  const ui = harness(t);
  Object.assign(ui.state, places.pump);
  ui.dialogs.objectDialog('pump');
  ui.click('Look more closely');
  assert.ok(ui.state.mind.studied.includes('district:pump'));
  ui.click('Follow the knocking sound');
  assert.equal(ui.state.stage, 1);
  assert.equal(ui.element('dialog').open, false);
});

test('the scrap broker speaks immediately and offers the quest gear when needed', (t) => {
  const ui = harness(t);
  Object.assign(ui.state, places.pump);
  commit(ui.state, 'inspect');
  Object.assign(ui.state, places.market);
  ui.dialogs.objectDialog('market');
  assert.match(ui.element('dialog-content').innerHTML, /try the scrap tray/);
  ui.click('Keep the loose gear');
  assert.equal(ui.state.stage, 2);
  assert.equal(ui.state.gear, 1);
});

test('notebook navigation escapes remembered text and reset views read the new world', (t) => {
  const ui = harness(t);
  ui.state.events[0].memory = '<script>untrusted memory</script>';
  ui.dialogs.journalView();
  assert.match(ui.element('dialog-content').innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(ui.element('dialog-content').innerHTML, /<script>/);
  ui.element('becoming-tab').onclick();
  assert.match(ui.element('dialog-content').innerHTML, /Still becoming/);
  ui.element('back-memories').onclick();
  assert.match(ui.element('dialog-content').innerHTML, /untrusted memory/);
  const oldState = ui.state;
  ui.dialogs.helpView();
  ui.click('Start a fresh world');
  ui.click('Keep this world');
  assert.equal(ui.resets, 0);
  ui.dialogs.helpView();
  ui.click('Start a fresh world');
  ui.click('Erase and begin again');
  assert.equal(ui.resets, 1);
  assert.notEqual(ui.state, oldState);
  ui.dialogs.journalView();
  assert.doesNotMatch(ui.element('dialog-content').innerHTML, /untrusted memory/);
});
