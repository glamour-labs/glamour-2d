// Empty shim for the `canvas` module. Konva's non-browser require path pulls
// this in conditionally; in the browser build (and in jsdom tests) we never
// exercise that path, so an empty module is sufficient to satisfy bundling.
// `export default {}` (not a bare `export {}`) to match packages/player's
// copy (fix #13) — any CJS-interop default-import of `canvas` resolves to
// something rather than undefined.
export default {};
