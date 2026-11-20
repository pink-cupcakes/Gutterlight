# Working on Gutterlight

The files in `dist/` are the actual source, served directly as native browser modules. They are not generated or minified bundles. Keep them readable.

## Checks

With Node.js 20 or newer:

```sh
npm ci
npm run format
npm run format:check
npm test
```

Prettier is pinned in the lockfile. `.editorconfig` defines whitespace defaults for editors. Run the format check before committing; do not compress functions or templates onto single lines.

## Where changes belong

- `dist/game.js`: startup, input, movement, and the animation/update loop.
- `dist/renderer.js`: canvas scene drawing from a frame snapshot; no world mutations or DOM queries.
- `dist/living-world.js`: animated machinery and effects tied to committed state.
- `dist/audio.js`: ambient audio, action sounds, and playback of arrangements.
- `dist/ui/dialogs.js`: modal controls and callbacks into the game controller.
- `dist/ui/notebook.js`: pure notebook markup builders, separated by section.
- `dist/ui/html.js`: tagged markup and text escaping. The tag does **not** sanitize values; escape dynamic text explicitly.
- `dist/world-model.js`: saved state, migration, guarded actions, and the commit boundary.
- `dist/interactions.js`: skill combinations, materials, and observations.
- `dist/mind.js`: planning over remembered objects and routes.
- `dist/continuity.js`: concerns, memories, relationships, and named follow-up handlers.
- `dist/city.js`: neighborhood connections, collision, and navigation.

Keep eligibility checks separate from action consequences. Add behavior tests for changed rules or persistence, and retain old-save compatibility. Prefer named intermediate values over nested ternaries inside markup. Leave rendering and audio decisions outside the world model.

For review, separate mechanical formatting from behavior or structural changes when practical.
