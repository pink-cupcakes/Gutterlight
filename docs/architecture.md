# Gutterlight — The Lower Undercity

A painted 2D browser adventure based on the Gutterlight project. Seven connected neighborhoods form an explorable street network: alleys branch, bridges loop back, a service gate opens a shortcut, and a dead-end lane contains salvage. Moving through an open screen exit changes the scene directly.

## Play

- WASD / arrows: walk. Shift: faster movement.
- Click/tap the paving: walk there. Select a connecting street to walk to its exit.
- E: interact. J: memories. B: inventory. M: discovered city map. G: gift.
- Watch Iona (the default): observation-driven symbolic planning using remembered affordances, learned skills and the same guarded world actions.
- Start from the Foundry Lanes and follow the southern stairs to Sump Crossing. Exploration is available before finishing the opening repair story.

The neighborhood graph contains these reciprocal connections:

- Foundry Lanes ↔ Sump Crossing
- Sump Crossing ↔ Lantern Row, Boiler Court, Cable Walk
- Lantern Row ↔ Violet Market ↔ Cable Walk
- Boiler Court ↔ Cinder End (a dead end)
- Boiler Court ↔ Cable Walk (a shortcut unlocked by lifting the bolt from Boiler Court)

Four residents share local observations, clues and a small delivery request. A discarded resonance coil can be found in Cinder End. The opening repair story remains: inspect the pump, retrieve a gear, repair the pump, balance the condenser, restart the freight winch.

## Implementation

Serve `dist/` through HTTP; there is no build step or runtime dependency. `npm test` runs the tests. The standalone repository can be served by any static host.

- `city.js`: neighborhood graph, scene-specific exit coordinates and walkable polygons traced against the paintings, navigation, reciprocal travel, safe arrival positions, shortcut guards and exploration goals.
- `world-model.js`: state, guarded actions, inventory, memories and committed history. Earlier maze saves migrate into Sump Crossing; story progression and recovered rewards are retained.
- `game.js`: startup, input, point-to-point movement, persistence, and the autonomous update loop. Movement clamps each step to its next waypoint to avoid overshooting a narrow street boundary.
- `renderer.js`: canvas drawing, feet-anchored sprite animation, and resident depth ordering from a frame snapshot.
- `audio.js`: ambient sound, action tones, and arrangement playback.
- `ui/dialogs.js`: modal interaction controls; `ui/notebook.js`: pure notebook section renderers; `ui/html.js`: formatted markup and text escaping.
- `city-map.js`: read-only map of visited neighborhoods and adjoining passages. The bolted connection is drawn as a dashed line until opened.

The streets themselves supply the maze structure. The former generated rectangular labyrinth, tile renderer and three-valve puzzle were removed.

## Art

Original GPT-generated painted environments: Foundry Lanes, Sump Crossing, Lantern Row, Violet Market, Cable Walk, Boiler Court and Cinder End. Each uses the same elevated camera and industrial undercity palette. Iona has a sixteen-frame directional walk sheet. A separate transparent sheet contains four original residents. Inventory objects have their own six-item sheet. All runtime artwork is bundled in `dist/assets/`.

## Scope and validation

This is a browser-local playable prototype, with authored autonomous decisions and reflections. It has no connected live LLM, shared persistent server, multiplayer or offline world execution. Concern age advances with real time between visits. Only visible-page execution performs actions; no offscreen conversations or accomplishments are fabricated. The observer only reports committed local events. Local saves and export retain the event history, discoveries, gifts, shortcut and inventory.

Automated checks cover story progression, item consumption, memories, gifts, save recovery and migration, connected reciprocal scene graph, collision-safe navigation to every destination, all scene transitions and safe return positions, one-sided shortcut unlocking, salvage rules, and the actual autonomous loop completing the story and exploring all seven neighborhoods and continuing beyond its initial repairs.

JavaScript syntax and asset references checked. Browser visual QA remains unverified: the managed preview relay times out (browser execution could not be reached).

## Living systems and discovery

The interface tracks one objective in the HUD, the local minimap, and the scene. Approach a resident or prop for an interaction prompt, or click it to walk over and interact. The notebook’s Connections view records observations, experiments, acquired skills and concise working intentions.

`interactions.js` owns new persistent affordances and resource checks: salvage piles, a winding bench, a broken street lamp, a two-wheel pressure regulator, Mara’s parcel for Edda, and a silent signal mast. Notice, Mechanics, Salvaging, Wiring, Listening and Resonance can be combined. Materials and the recovered coil are consumed exactly once where required. Older saves receive defaults without losing progress.

`mind.js` performs bounded forward search over actions associated with studied objects. It receives only the objects observed in the current neighborhood and remembered routes from previously visited neighborhoods. If no remembered action chain can satisfy an observed need, Iona examines something unfamiliar or explores a known frontier. She can revise a plan as new evidence or materials become available. Regulator trials change one control at a time and infer the direction of its effect from recorded readings before securing the mechanism.

`living-world.js` renders moving wheels, a freight cage, responsive steam, a pressure needle, lamp glow, a pulsing signal, and a hanging carriage that starts only after the signal is restored. Residents shift gently while idle. Successful work produces brief particles. Reduced-motion preferences suppress continuous movement.

This remains a local symbolic agent with authored perception and action descriptions, not a connected language model. The notebook exposes recorded observations and intentions. It does not present fabricated model internals. Browser visual QA remains blocked by the managed environment; automated tests exercise the actual update loop through independent discovery, crafting, experimentation, delivery, lamp restoration and signal restoration, plus invalid-action and persistence guards.

## Character continuity

`continuity.js` adds a persistent, browser-local character layer. Repairs seed ongoing concerns rather than completion screens. Follow-ups mature over minutes, real hours, and days: the pump can become an anxious checking habit, Mara can reveal the glare caused by the repaired light, Edda can become someone to visit without a parcel, and the signal echo can challenge an appealing interpretation. These are authored narrative possibilities, not LLM-generated content.

The planner weighs those concerns using slowly changing care, curiosity, and independence preferences. Only known places and remembered routes are eligible. Short-term practical work and long-term concerns share the same guarded action/commit boundary. Rest is no longer an endlessly repeated ending; quiet periods alternate with familiar places, relationships, listening, and later follow-ups.

Salient episodic memories retain their source events. Reflection uses multiple actual memories to form or revise beliefs, preserves supporting memory IDs, and changes traits by small bounded increments. Relationships retain familiarity, trust, meetings and shared works. A fixed core stays intact. Saves from older versions migrate without replaying rewards. Memory is bounded, with supporting evidence preferred for retention.

Iona can collect street rhythms, make an imperfect sound sketch, seek feedback, wait before revising, and share a preserved arrangement. Artifacts retain their source sounds, the neighbour who influenced the revision, and playable note data. New samples and later days support further arrangements. A lamp shade changes the rendered light after fitting; drafts and saved work appear at the bench. The notebook's Becoming view exposes concerns, evidence behind beliefs, relationships, unfinished work, arrangements, and dated reflection. Visitor questions are bounded in-world suggestions, read only when Iona visits the lantern corner; they gently affect preferences rather than forcing an action.

Time semantics: `age` is monotonic and uses wall time or active frame time, whichever is greater for an update. Clock rollback cannot make age negative or replay consequences. Returning after absence can restore energy and mature a concern, but does not advance narrative phases or emit events. Reloading the same wall-time checkpoint is idempotent. There is no scheduler, backend memory, cross-device sync, or live language model in this build.

Design research: Pino's public [architecture](https://pinos.world/facts), [memory API](https://pinos.world/api/v1/memories), and [developer interface](https://pinos.world/developers) informed the distinction between persistent concerns, remembered events, slow identity change and world-validated actions. Gutterlight's fictional events and prose are original. Pino's model-driven character is not implemented or claimed here.
