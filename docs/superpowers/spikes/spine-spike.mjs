import Konva from 'konva';
import { createMachine, createActor, assign } from 'xstate';

const results = [];
const ok  = (id, m) => { results.push(['OK', id, m]); console.log('\x1b[32m✓\x1b[0m', id, '—', m); };
const bad = (id, m) => { results.push(['BAD', id, m]); console.log('\x1b[31m✗\x1b[0m', id, '—', m); };

// ---------- OUR OWN scene format ----------
const sceneDoc = {
  schema: 'v0',
  canvas: { width: 640, height: 300, background: '#12151b' },
  nodes: [
    { id: 'orb',   type: 'circle', x: 200, y: 150, radius: 48, fill: '#4c7dff', listens: true },
    { id: 'title', type: 'text',   x: 300, y: 130, text: 'hello', fill: '#e6e6e6', fontSize: 18 },
    { id: 'ghost', type: 'rect',   x: 300, y: 170, width: 20, height: 10, fill: '#5ad67d' },
  ],
};

// ---------- CLAIM 1+2: our-JSON -> scene-graph -> our-JSON (round-trip) ----------
try {
  const stage = new Konva.Stage({ width: sceneDoc.canvas.width, height: sceneDoc.canvas.height });
  const layer = new Konva.Layer(); stage.add(layer);
  const byId = {};
  for (const n of sceneDoc.nodes) {
    let k;
    if (n.type === 'circle') k = new Konva.Circle({ x:n.x, y:n.y, radius:n.radius, fill:n.fill });
    else if (n.type === 'rect') k = new Konva.Rect({ x:n.x, y:n.y, width:n.width, height:n.height, fill:n.fill });
    else if (n.type === 'text') k = new Konva.Text({ x:n.x, y:n.y, text:n.text, fill:n.fill, fontSize:n.fontSize });
    k._docId = n.id; k.listening(!!n.listens); byId[n.id] = k; layer.add(k);
  }
  layer.draw();
  ok('CLAIM-1 render', `${sceneDoc.nodes.length} nodes built from our JSON into a Konva scene-graph`);

  const serialize = () => layer.getChildren().map(k => {
    const cls = k.getClassName();
    const b = { id:k._docId, type:cls.toLowerCase(), x:Math.round(k.x()), y:Math.round(k.y()), fill:k.fill() };
    if (cls==='Circle') b.radius = k.radius();
    if (cls==='Rect') { b.width=k.width(); b.height=k.height(); }
    if (cls==='Text') { b.text=k.text(); b.fontSize=k.fontSize(); }
    return b;
  });
  const rt = serialize();
  const idsMatch = JSON.stringify(rt.map(n=>n.id)) === JSON.stringify(sceneDoc.nodes.map(n=>n.id));
  const orbOk = rt.find(n=>n.id==='orb').radius === 48;
  (idsMatch && orbOk) ? ok('CLAIM-2 round-trip', 'ids + radius survive nodes→our-JSON') : bad('CLAIM-2 round-trip', 'mismatch');

  // ---------- CLAIM 3: real pixel hit-test (the mechanism behind pointer events) ----------
  // getIntersection uses Konva's hit-detection canvas — the exact thing click/hover rely on.
  const hitOnOrb  = layer.getIntersection({ x: 200, y: 150 }); // center of orb
  const hitOffOrb = layer.getIntersection({ x: 20,  y: 20  }); // empty corner
  const hitInside = hitOnOrb && hitOnOrb._docId === 'orb';
  const missOutside = hitOffOrb === null || hitOffOrb === undefined;
  (hitInside && missOutside)
    ? ok('CLAIM-3 hit-test', `pixel (200,150) → node "${hitOnOrb._docId}"; empty corner → no hit`)
    : bad('CLAIM-3 hit-test', `inside=${hitOnOrb && hitOnOrb._docId} outside=${hitOffOrb}`);

  // prove the scene actually rasterizes (render produced pixels)
  const url = stage.toDataURL();
  (typeof url === 'string' && url.startsWith('data:image/png') && url.length > 2000)
    ? ok('CLAIM-render pixels', `stage rasterized to PNG (${url.length} b64 chars)`)
    : bad('CLAIM-render pixels', 'no raster');

  // ---------- CLAIM 5: external input drives a bound property ----------
  const setInput = (name, val) => {
    if (name === 'progress') { byId.ghost.width(20 + (val/100)*200); }
  };
  setInput('progress', 100);
  (byId.ghost.width() === 220)
    ? ok('CLAIM-5 input-binding', 'setInput(progress,100) → ghost width 20→220')
    : bad('CLAIM-5 input-binding', 'width='+byId.ghost.width());
} catch (e) { bad('render/hit-test', e.message); }

// ---------- CLAIM 4: statechart authored AS DATA, driving property targets ----------
try {
  // This machine config is plain data — exactly what an LLM would emit.
  const machineConfig = {
    id: 'orb', initial: 'idle',
    context: { radius: 48, fill: '#4c7dff' },
    states: {
      idle:   { entry: assign({ radius: 48, fill: '#4c7dff' }), on: { TOGGLE: 'active', HOVER: 'hover' } },
      hover:  { entry: assign({ radius: 56, fill: '#8ab4ff' }), on: { TOGGLE: 'active', LEAVE: 'idle' } },
      active: { entry: assign({ radius: 72, fill: '#ff9f43' }), on: { TOGGLE: 'idle' } },
    },
  };
  const actor = createActor(createMachine(machineConfig));
  const trail = [];
  actor.subscribe(s => trail.push([s.value, s.context.radius, s.context.fill]));
  actor.start();
  actor.send({ type: 'HOVER' });   // pointer enter -> input -> transition
  actor.send({ type: 'TOGGLE' });  // click while hovering -> active
  actor.send({ type: 'TOGGLE' });  // click again -> idle
  const path = trail.map(t => t[0]).join(' → ');
  const expected = 'idle → hover → active → idle';
  const propsDriven = trail[2][1] === 72 && trail[2][2] === '#ff9f43'; // active drove radius+fill targets
  (path === expected && propsDriven)
    ? ok('CLAIM-4 statechart', `data-only machine: ${path}; active state drove radius→72, fill→#ff9f43`)
    : bad('CLAIM-4 statechart', `path="${path}" propsDriven=${propsDriven}`);
} catch (e) { bad('statechart', e.message); }

const passed = results.filter(r => r[0]==='OK').length;
const failed = results.filter(r => r[0]==='BAD').length;
console.log(`\n=== SPIKE RESULT: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
