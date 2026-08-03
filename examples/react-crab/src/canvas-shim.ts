// Empty shim for the `canvas` module — Konva's non-browser require path pulls
// it in conditionally; the browser build never exercises that path. Mirrors the
// studio + player copies.
export default {};
