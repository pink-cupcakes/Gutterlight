import { renderBecoming, renderJournal } from './notebook.js';
import { residentVoice, continuityOptions, leaveThought } from '../continuity.js';
import { studied, practicalOptions, unmet, note } from '../interactions.js';
import { sceneOf, exits } from '../city.js';
import { drawCityMap } from '../city-map.js';
import { activePlaces, clock } from '../world-model.js';
import { html, escape } from './html.js';
const $ = (id) => document.getElementById(id);

// Dialogs request world actions through the controller; they never replace game state.
export function createDialogs({
  getState,
  getMode,
  toggleSound,
  isSoundOn,
  canvas,
  clearInput,
  perform,
  say,
  toast,
  save,
  setMode,
  goPlace,
  resetWorld,
  playWork,
}) {
  function openDialog(markup, encounter = false) {
    clearInput();
    const dialog = $('dialog');
    const content = $('dialog-content');
    content.innerHTML = markup;
    content.querySelector('h2')?.setAttribute('id', 'dialog-title');
    dialog.classList.toggle('encounter', encounter);
    if (!dialog.open) dialog.showModal();
    else $('close-dialog').focus();
  }

  function closeDialog() {
    $('dialog').close();
    clearInput();
    canvas.focus({ preventScroll: true });
  }

  function actionButton(text, fn, primary = false) {
    const b = document.createElement('button');
    b.className = `action${primary ? ' primary' : ''}`;
    b.textContent = text;
    b.onclick = fn;
    $('dialog-content').querySelector('.dialog-actions').append(b);
    return b;
  }

  function tryAction(type, payload = {}) {
    const state = getState();
    if (perform(type, payload)) {
      closeDialog();
      return true;
    }
    const thought = unmet(state, type);
    note(state, thought, 'attempt');
    say(thought);
    toast('Nothing changes yet.');
    save();
    return false;
  }

  function objectDialog(id) {
    const state = getState();
    const p = activePlaces(state)[id];
    if (!p) return;
    if (p.exit) {
      if (p.locked) {
        say('It gives a little, then catches. The bolt is somewhere on the other side.');
        return;
      }
      perform('travel:' + p.dir);
      return;
    }
    const speaker = p.speaker !== undefined;
    if (speaker) {
      if (!studied(state, state.zone, id)) perform('study', { id });
      if (id === 'npc' && !state.city.talked.includes(state.zone)) perform('talk');
      $('speech').hidden = true;
    }
    const seen = studied(state, state.zone, id);
    const last = state.mind.known[state.zone + ':' + id]?.observation;
    const observation = id === 'npc' ? residentVoice(state, state.zone) : p.quote || last;
    const description =
      seen || speaker
        ? escape(observation || 'The marks of use are easier to see up close.')
        : 'There is more to this than its shape from a distance.';
    openDialog(
      html`<div class="eyebrow">${escape(sceneOf(state).name.toUpperCase())}</div>
        <h2>${escape(p.name)}</h2>
        <p>${description}</p>
        <div class="dialog-actions"></div>`,
      true,
    );
    if (!seen && !speaker) {
      actionButton(
        'Look more closely',
        () => {
          perform('study', { id });
          objectDialog(id);
        },
        true,
      );
      actionButton('Leave it for now', closeDialog);
      return;
    }
    const continuationLabels = {
      'life-reflect': 'Sit with what happened',
      'life-company': 'Stay and talk',
      'life-listen': 'Listen without looking for a fault',
      'life-compose': 'Return to the unfinished sketch',
      'life-feedback': 'Let them hear the unfinished part',
      'life-share': 'Share something she made',
    };
    const continuations = continuityOptions(state).filter(
      (option) => option.zone === state.zone && option.id === id,
    );
    for (const option of continuations) {
      const label = continuationLabels[option.type] || 'Return to what stayed with her';
      actionButton(label, () => tryAction(option.type, option.payload));
    }
    for (const option of practicalOptions(state, id))
      actionButton(option.label, () => tryAction(option.type, option.payload || {}), true);
    if (id === 'pump') {
      if (state.stage === 0)
        actionButton('Follow the knocking sound', () => tryAction('inspect'), true);
      else if (state.stage === 2)
        actionButton('Try the spare gear', () => tryAction('repair'), true);
      else if (state.stage >= 3)
        actionButton('Listen again', () => {
          perform('revisit');
          closeDialog();
          say('It has kept the rhythm.');
        });
      else
        actionButton('Turn the wheel by hand', () => {
          closeDialog();
          say('It catches at the missing tooth.');
        });
    }
    if (id === 'market' && state.stage === 1)
      actionButton('Keep the loose gear', () => tryAction('take-gear'), true);
    if (id === 'tank')
      actionButton(
        'Ease the valve',
        () => {
          if (state.stage === 3) tryAction('balance');
          else {
            closeDialog();
            say('The pressure is coming from somewhere else.');
          }
        },
        true,
      );
    if (id === 'gate')
      actionButton(
        'Test the winch lever',
        () => {
          if (state.stage === 4) tryAction('workshop');
          else {
            closeDialog();
            say(
              state.stage >= 5 ? 'The cage is moving again.' : 'There is no pull in the line yet.',
            );
          }
        },
        true,
      );
    if (id === 'benchwork' && (state.continuity.draft || state.continuity.works.length))
      actionButton('Look through her sound sketches', becomingView);
    if (id === 'bench')
      actionButton('Sit for a moment', () => {
        perform('rest');
        closeDialog();
      });
    if (id === 'npc') {
      if (state.zone === 'lantern' && !state.life.promised)
        actionButton('Ask about the wrapped object', () => {
          openDialog(
            html`<h2>Mara</h2>
              <div class="quote">
                “A fuse. Edda’s been waiting for it. I haven’t made it across yet.”
              </div>
              <div class="dialog-actions"></div>`,
            true,
          );
          actionButton('Offer to take it along', () => tryAction('accept-parcel'), true);
          actionButton('Another time', closeDialog);
        });
      if (state.zone === 'cable' && state.life.parcel)
        actionButton('Show her Mara’s parcel', () => tryAction('deliver-parcel'), true);
      if (state.life.beacon)
        actionButton('Ask about the new signal', () => {
          closeDialog();
          say('“Saw the first carriage move a little while ago. Was that your doing?”');
        });
    }
    if (id === 'latch' && !state.city.shortcut)
      actionButton('Lift the loose bolt', () => tryAction('unlatch'), true);
    if (id === 'cache' && !state.city.recovered)
      actionButton('Keep the ringing coil', () => tryAction('recover'), true);
    if (id === 'regulator')
      actionButton(
        state.life.stable ? 'Listen to the steady note' : 'Try the two wheels',
        () =>
          state.life.stable ? (closeDialog(), say('It holds its note now.')) : regulatorDialog(),
        true,
      );
    actionButton('Step away', closeDialog);
  }

  function regulatorDialog() {
    const state = getState();
    openDialog(
      html`<div class="eyebrow">A SHUDDER IN THE PIPES</div>
        <h2>Two wheels. One rhythm.</h2>
        <div class="pressure-gauge">
          <div class="safe-band"></div>
          <i id="needle"></i><span id="pressure-reading"></span>
        </div>
        <p class="detail">The green paint is worn, but still visible on the dial.</p>
        <label class="dial-row"
          >Intake
          <input
            id="intake"
            type="range"
            min="0"
            max="6"
            step="1"
            value="${state.life.intake}"
          /><output id="intake-value">${state.life.intake}</output></label
        ><label class="dial-row"
          >Vent
          <input
            id="vent"
            type="range"
            min="0"
            max="6"
            step="1"
            value="${state.life.vent}"
          /><output id="vent-value">${state.life.vent}</output></label
        >
        <div class="dialog-actions"></div>`,
      true,
    );
    const paint = () => {
      const value = state.life.pressure;
      $('needle').style.left = Math.max(0, Math.min(100, (value / 90) * 100)) + '%';
      $('pressure-reading').textContent = value;
    };
    paint();
    for (const id of ['intake', 'vent'])
      $(id).oninput = () => ($(id + '-value').textContent = $(id).value);
    actionButton(
      'Try this adjustment',
      () => {
        const ok = perform('probe', {
          intake: Number($('intake').value),
          vent: Number($('vent').value),
        });
        if (!ok) toast('That setting has the same note as before.');
        paint();
      },
      true,
    );
    actionButton('Secure the mechanism', () => tryAction('settle-pressure'));
    actionButton('Step back', closeDialog);
  }

  function discoveriesView() {
    const state = getState();
    openDialog(
      html`<div class="eyebrow">THINGS IONA HAS PUT TOGETHER</div>
        <h2>A growing understanding.</h2>
        <div class="skill-list">
          ${state.life.skills.map((k) => html`<span>${escape(k)}</span>`).join('')}
        </div>
        <p class="detail">What she has noticed, tried, and kept.</p>
        ${[...state.mind.notes]
          .reverse()
          .map(
            (n) =>
              html`<article class="ledger-entry">
                <time>${clock(n.time)} · ${escape(n.kind.toUpperCase())}</time>
                <p>${escape(n.text)}</p>
              </article>`,
          )
          .join('')}`,
    );
  }

  function becomingView() {
    const state = getState();
    openDialog(renderBecoming(state));
    $('back-memories').onclick = () => journalView();
    $('leave-thought').onclick = thoughtView;
    document
      .querySelectorAll('[data-work]')
      .forEach((b) => (b.onclick = () => playWork(Number(b.dataset.work))));
  }

  function journalView(tab = 'memories') {
    const state = getState();
    openDialog(renderJournal(state, tab));
    $('becoming-tab').onclick = becomingView;
    $('discoveries-tab').onclick = discoveriesView;
    $('memories-tab').onclick = () => journalView('memories');
    $('history-tab').onclick = () => journalView('history');
    $('export').onclick = () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gutterlight-world.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
  }

  function mapView() {
    const state = getState();
    openDialog(
      html`<div class="eyebrow">STREETS YOU HAVE WALKED</div>
        <h2>The Lower Undercity</h2>
        <canvas
          id="city-map"
          width="640"
          height="350"
          style="width:100%;border:1px solid #66794c;border-radius:4px"
        ></canvas>
        <p class="detail">
          Bright marker: you. Dim markers: unexplored passages. A broken line marks the bolted
          service gate. ${state.city.visited.length} of 7 neighborhoods discovered.
        </p>
        <div class="dialog-actions">
          ${Object.entries(exits(state))
            .map(
              ([id, p]) =>
                html`<button class="action" data-route="${id}">
                  ${p.dir.toUpperCase()} · ${escape(p.name)}${p.locked ? ' (bolted shortcut)' : ''}
                </button>`,
            )
            .join('')}
        </div>`,
    );
    drawCityMap($('city-map'), state, true);
    document.querySelectorAll('[data-route]').forEach(
      (b) =>
        (b.onclick = () => {
          setMode('explore');
          closeDialog();
          goPlace(b.dataset.route);
        }),
    );
  }

  function thoughtView() {
    const state = getState();
    openDialog(
      html`<div class="eyebrow">A THOUGHT LEFT BY THE LANTERN</div>
        <h2>Something she might carry.</h2>
        <p>
          A question, not an instruction. She will read it when she returns, and may take time to
          make anything of it.
        </p>
        <div class="dialog-actions"></div>`,
    );
    for (const [influence, text] of [
      ['care', 'Who would you visit with nothing to bring?'],
      ['curiosity', 'What would you make just for yourself?'],
      ['independence', 'Could you leave a working thing alone?'],
    ])
      actionButton(text, () => {
        if (leaveThought(state, influence)) {
          save();
          closeDialog();
          toast('A thought left beside the lantern.');
        } else toast('Let the last thought have a little time.');
      });
    actionButton('Leave nothing for now', closeDialog);
  }

  function giftView() {
    const state = getState();
    if (state.zone !== 'district') {
      toast('Leave gifts in the Foundry Lanes, where they can grow.');
      return;
    }
    openDialog(
      html`<div class="eyebrow">A VISITOR’S SMALL KINDNESS</div>
        <h2>Leave something growing.</h2>
        <p>
          ${state.gift ? 'A moss cutting already lives in these lanes. Iona will remember the kindness.' : 'Leave a tin of luminous moss beside Iona. It will stay in this world, and she may decide to look after it.'}
        </p>
        <p class="detail">Visitor gifts are saved on this device in this prototype.</p>
        <div class="dialog-actions"></div>`,
    );
    actionButton('Leave a thought', thoughtView);
    actionButton(
      state.gift ? 'Return to the lanes' : 'Leave a moss cutting',
      () => {
        if (!state.gift) {
          perform('gift');
          toast('A gift left in the lanes');
        }
        closeDialog();
      },
      true,
    );
  }

  function bagView() {
    const state = getState();
    openDialog(
      html`<div class="eyebrow">IONA’S SATCHEL</div>
        <h2>A few useful things.</h2>
        <p>
          ${state.gear ? '⚙ Brass gear · 1<br>A sound eight-tooth gear, waiting for the pump.' : state.stage >= 3 ? 'The spare gear is part of the pump now.' : 'There is room for something worth keeping.'}
        </p>
        <p>
          ${state.city.recovered && !state.life.coilUsed ? 'Resonance coil · rings when touched<br>' : ''}${state.life.scrap}
          workable copper · ${state.life.wire} wire coils<br />${state.life.parcel ? 'Wrapped fuse · meant for Edda<br>' : ''}Brass
          wrist tool · always carried<br />Leather notebook ·
          ${state.events.filter((e) => e.memory).length} memories
        </p>
        <div class="dialog-actions"></div>`,
    );
    actionButton('Read the notebook', () => journalView());
    actionButton('Return to the lanes', closeDialog, true);
  }

  function helpView() {
    openDialog(
      html`<div class="eyebrow">GUTTERLIGHT</div>
        <h2>Settings and controls</h2>
        <p>
          <strong>WASD / arrow keys</strong> to walk. Hold <strong>Shift</strong> to move faster.
          Click or tap the street to walk there. Use <strong>E</strong> or tap the prompt to talk or
          inspect. Follow an open passage to enter the next neighborhood.
        </p>
        <p class="detail">
          J journal · B satchel · M map · G gift · Esc close. Progress is saved in this browser.
        </p>
        <div class="dialog-actions"></div>`,
    );
    actionButton('Return to the lanes', closeDialog, true);
    const watching = getMode() === 'watch';
    actionButton(watching ? 'Take control' : 'Watch Iona', () => {
      setMode(watching ? 'explore' : 'watch');
      closeDialog();
    });
    const soundLabel = () => (isSoundOn() ? 'Mute ambient sound' : 'Enable ambient sound');
    const sound = actionButton(soundLabel(), async () => {
      await toggleSound();
      sound.textContent = soundLabel();
    });
    actionButton('Open satchel', bagView);
    actionButton('Leave a gift', giftView);
    actionButton('Start a fresh world', () => {
      openDialog(
        html`<div class="eyebrow">START AGAIN</div>
          <h2>A new evening?</h2>
          <p>
            This will erase Iona’s memories and your progress on this device. Export the history
            from the journal first if you want to keep it.
          </p>
          <div class="dialog-actions"></div>`,
      );
      actionButton('Keep this world', closeDialog, true);
      actionButton('Erase and begin again', () => {
        resetWorld();
        closeDialog();
      });
    });
  }
  return {
    closeDialog,
    objectDialog,
    becomingView,
    journalView,
    mapView,
    giftView,
    bagView,
    helpView,
  };
}
