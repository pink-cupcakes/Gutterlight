import { ageLabel, residentNames } from '../continuity.js';
import { html, escape } from './html.js';

function emptySection(message) {
  return html`<p class="detail">${escape(message)}</p>`;
}

function renderThreads(continuity) {
  const cards = Object.values(continuity.threads).map(
    (thread) => html`
      <article class="thread-card">
        <span>${continuity.age >= thread.due ? 'ON HER MIND' : 'LEFT TO SETTLE'}</span>
        <p>${escape(thread.title)}</p>
        <small>Since ${ageLabel(thread.opened)}</small>
      </article>
    `,
  );
  return (
    cards.join('') ||
    emptySection('The first things she cares about will come from what happens here.')
  );
}

function renderEvidence(ids, memories) {
  return ids
    .map((id) => memories.find((memory) => memory.id === id))
    .filter(Boolean)
    .map((memory) => html` <li>${escape(memory.text)} <small>${ageLabel(memory.at)}</small></li> `)
    .join('');
}

function renderBeliefs(continuity) {
  const cards = continuity.beliefs.map(
    (belief) => html`
      <details class="belief">
        <summary>${escape(belief.text)}</summary>
        <p class="detail">Experiences behind this idea:</p>
        <ul>
          ${renderEvidence(belief.evidence, continuity.memories)}
        </ul>
      </details>
    `,
  );
  return (
    cards.join('') ||
    emptySection('A single success does not make a conviction. She needs more to go on.')
  );
}

function describeRelationship(trust) {
  if (trust > 0.5) return 'Someone she seeks out';
  if (trust > 0.25) return 'A little easier to be herself';
  return 'Still finding a way to talk';
}

function renderRelationships(continuity) {
  const cards = Object.values(continuity.relationships)
    .filter((relationship) => relationship.familiarity)
    .map(
      (relationship) => html`
        <article>
          <b>${escape(relationship.name)}</b>
          <p>${describeRelationship(relationship.trust)}</p>
          <small>${relationship.familiarity} shared encounters</small>
        </article>
      `,
    );
  return cards.join('') || emptySection('She has not stopped to know anyone yet.');
}

function renderDraft(draft) {
  if (!draft) return '';
  const description =
    draft.phase === 'feedback'
      ? 'It works as a sequence of sounds. She is not sure it says anything yet.'
      : 'A neighbour heard something she missed. She is letting it settle before returning.';
  return html`
    <article class="thread-card">
      <span>UNFINISHED · SOUND SKETCH</span>
      <p>${description}</p>
    </article>
  `;
}

function renderWork(work) {
  const collaborators = work.shared.map((zone) => escape(residentNames[zone] || zone));
  const sharedStatus = collaborators.length
    ? `Shared with ${collaborators.join(', ')}`
    : 'Not shared yet';
  const feedbackCredit = work.feedback ? ' · shaped with ' + escape(work.feedback) : '';
  return html`
    <article class="work-card">
      <span class="sound-wave">▁ ▃ ▂ ▆ ▂ ▁ ▄ ▂</span>
      <h4>${escape(work.title)}</h4>
      <p>
        Arrangement ${work.revision} · ${work.sources.length} remembered sounds${feedbackCredit}
      </p>
      <button class="action play-work" data-work="${work.id}">Listen to her arrangement</button>
      <small>${ageLabel(work.at)} · ${sharedStatus}</small>
    </article>
  `;
}

function renderWorks(continuity) {
  const works = [...continuity.works].reverse().map(renderWork).join('');
  const empty = continuity.draft
    ? ''
    : emptySection(
        'There is no assignment here. Something may grow out of what she keeps noticing.',
      );
  return renderDraft(continuity.draft) + (works || empty);
}

function renderReflections(continuity) {
  const entries = [...continuity.reflections]
    .reverse()
    .slice(0, 8)
    .map(
      (reflection) => html`
        <article class="ledger-entry">
          <time>${ageLabel(reflection.at)}</time>
          <p>${escape(reflection.text)}</p>
        </article>
      `,
    );
  return entries.join('') || emptySection('She has not had enough distance from this evening yet.');
}

// Pure markup builders: event wiring and state changes live in dialogs.js.
export function renderBecoming(state) {
  const continuity = state.continuity;
  return html`
    <div class="eyebrow">IONA · ${ageLabel(continuity.age)}</div>
    <h2>Still becoming.</h2>
    <p class="character-core">
      She notices what catches, keeps things others discard, and finds it easier to offer help than
      to ask for company.
    </p>
    <p class="detail">Experiences can complicate who she is. They do not replace her overnight.</p>
    <div class="journal-tabs">
      <button id="back-memories">Her memories</button>
      <button id="leave-thought">Leave a thought</button>
    </div>
    <h3>What she is carrying</h3>
    ${renderThreads(continuity)}
    <h3>Things she is beginning to believe</h3>
    ${renderBeliefs(continuity)}
    <h3>People becoming familiar</h3>
    <div class="relationship-list">${renderRelationships(continuity)}</div>
    <h3>Work that belongs to her</h3>
    ${renderWorks(continuity)}
    <h3>After sitting with it</h3>
    ${renderReflections(continuity)}
    <p class="detail">
      Her life is saved in this browser. Time matures her concerns between visits; she takes action
      while you are here. Memory and preference changes use local rules in this build.
    </p>
  `;
}

export function renderJournal(state, tab) {
  const showingMemories = tab === 'memories';
  const heading = showingMemories ? 'IONA’S NOTEBOOK' : 'THE OBSERVER · COMMITTED EVENTS';
  const title = showingMemories ? 'Things worth keeping.' : 'What happened here.';
  const description =
    tab === 'history'
      ? 'The observer only reads events that have already happened.'
      : 'Experiences, relationships, and unfinished work persist on this device.';
  const events = state.events
    .filter((event) => tab === 'history' || event.memory)
    .slice()
    .reverse();
  const entries = events
    .map(
      (event) => html`
        <article class="ledger-entry">
          <time>${ageLabel(event.age ?? event.time)}</time>
          <p class="${showingMemories ? 'memory' : ''}">
            ${escape(showingMemories ? event.memory : event.text)}
          </p>
        </article>
      `,
    )
    .join('');
  return html`
    <div class="eyebrow">${heading}</div>
    <h2>${title}</h2>
    <div class="journal-tabs">
      <button id="memories-tab" class="${showingMemories ? 'selected' : ''}">Her memories</button>
      <button id="becoming-tab">Becoming</button>
      <button id="discoveries-tab">Connections</button>
      <button id="history-tab" class="${tab === 'history' ? 'selected' : ''}">World history</button>
    </div>
    ${entries}
    <p class="detail">${description}</p>
    <div class="dialog-actions">
      <button class="action" id="export">Export world history</button>
    </div>
  `;
}
