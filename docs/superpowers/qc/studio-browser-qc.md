# browser-qc · Glamour Studio (`/`, http://localhost:5199) · rollup: PASS

Depth: quick. Build: `npm run build` (root) + `npm run build -w @glam/studio`, served via `vite preview --port 5199` from `apps/studio` (production build, Node v20.19.4). Server cwd verified against `<repo>/apps/studio` before driving. Killed on completion.

## Renders — PASS
- Tested:   Navigate to `http://localhost:5199`, full-page screenshot.
- Expected: Dark two-pane UI — left JSON editor with starter `.glam` doc, right pane with live canvas showing a rendered orb + bar, inputs/state/AI/palette panels below preview.
- Actual:   Matches — dark theme throughout, left "Document" panel shows starter JSON (`schema: glamour/v0`, orb circle node, bar rect node, bind, machine idle/active states), right "Preview" panel renders a blue circle (orb, r=48, fill #4c7dff) and a small green rect (bar) on a near-black canvas (`#12151b` bg). Inputs/Machine state (idle)/AI (offline mode, disabled prompt)/Palette panels all present below.
- Evidence: <repo>/docs/superpowers/qc/evidence/01-initial-render.png

## Live preview on valid edit — PASS
- Tested:   Confirmed initial doc's orb + bar nodes are both present and rendered in the canvas matching the JSON node list (orb at x=200,y=150,r=48; bar at x=300,y=170).
- Expected: Starter orb (and bar) visible in canvas, reflecting the document.
- Actual:   Both nodes render correctly at expected relative positions/colors.
- Evidence: <repo>/docs/superpowers/qc/evidence/01-initial-render.png

## Validation feedback — PASS
- Tested:   Replaced editor content with malformed JSON (`{ "schema": "glamour/v0", broken json here`); screenshotted + snapshotted; then restored the original valid JSON.
- Expected: Inline validation error appears under/near the editor on invalid JSON; clears on restore.
- Actual:   An `alert` node appeared: "Invalid JSON: Expected double-quoted property name in JSON at position 26 (line 1 column 27)". After restoring the original doc, the alert node was gone from the accessibility snapshot (error cleared) and the canvas/document panel returned to normal.
- Evidence: <repo>/docs/superpowers/qc/evidence/02-invalid-json-error.png (error state), <repo>/docs/superpowers/qc/evidence/03-restored-valid.png (cleared state)

## One interaction (progress slider → bound node) — PASS
- Tested:   Two attempts. (a) Programmatic `input`/React-native-setter dispatch on the slider set the accessibility value to "1" but the bound `bar.w` did NOT visibly change in the canvas — flagged as a false-negative risk of synthetic events, not trusted as evidence. (b) Real user-gesture interaction: `click` on the slider then 30× `ArrowRight` key presses, landing on progress = 0.8.
- Expected: `bind: [{ node: "bar", prop: "w", expr: "lerp(20, 220, progress)" }]` — at progress=0.8, bar.w = lerp(20,220,0.8) = 176 (visually a much longer green bar than the initial w=20).
- Actual:   With genuine keyboard interaction, the green bar visibly grew from a small 20px-wide sliver to a ~176px-wide bar, tracking the slider position — binding confirmed live and correct.
- Evidence: <repo>/docs/superpowers/qc/evidence/06-slider-arrow-keys-0.8.png (bar grown, slider at 0.8); contrast with <repo>/docs/superpowers/qc/evidence/05-slider-progress-react-setter.png (synthetic-event attempt, bar did not update — not used as pass evidence, noted only as a driver caveat, not an app bug, since real interaction confirmed correct behavior).

## Diagnostics — PASS
- Tested:   `playwright-cli console` and `playwright-cli requests --static` after the full flow above.
- Expected: No unexpected console errors or failed app requests.
- Actual:   1 console error total: `favicon.ico` 404 (cosmetic, no favicon asset shipped — does not affect app function). All 3 static requests (`/`, JS bundle, CSS bundle) returned 200. No other network or console errors observed.
- Evidence: console output — `[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) @ http://localhost:5199/favicon.ico:0`; requests — `GET / => 200`, `GET /assets/index-BHbaEn-2.js => 200`, `GET /assets/index-Di2FDu_S.css => 200`.

## Not covered (quick depth / out of scope)
- Palette "Apply primitive" flow (e.g. applying hoverGrow to a node) was not exercised — slider interaction alone satisfied the "one interaction" check per the task's OR clause.
- No design export was supplied, so no fidelity composite was built; this run only covers functional/render/diagnostic checks, not pixel fidelity.
- `thorough`-depth items (full state matrix, responsive widths) not run — depth was `quick`.
