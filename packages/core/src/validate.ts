import { evalExpr } from './expr.js';
import { classifyOnKey } from './onkey.js';
import { parseDoc } from './schema.js';
import type { GlamDoc, GlamNode, NodeType } from './types.js';

export interface ValidateResult {
  ok: boolean;
  errors: string[];
}

// v1.1: `shadowBlur`/`shadowOpacity` are animatable on every node (a breathing
// glow), so they live in COMMON alongside the base transformable props.
const COMMON_PROPS = [
  'x',
  'y',
  'fill',
  'stroke',
  'strokeWidth',
  'opacity',
  'rotation',
  'shadowBlur',
  'shadowOpacity',
];
const PROPS_BY_TYPE: Record<NodeType, string[]> = {
  circle: [...COMMON_PROPS, 'r'],
  rect: [...COMMON_PROPS, 'w', 'h', 'cornerRadius'],
  text: [...COMMON_PROPS, 'text', 'size', 'fontStyle', 'align', 'valign'],
  ellipse: [...COMMON_PROPS, 'rx', 'ry'],
  arc: [...COMMON_PROPS, 'innerRadius', 'outerRadius', 'angle', 'cap'],
  // stroke's `points` are inked/drawn, not bound/set — only the common
  // transform + paint props are animatable on it.
  stroke: [...COMMON_PROPS],
  // An image carries whichever shape props it was given — that shape is also
  // its crop — plus its own source and fit. `src` and `fit` are listed so a
  // host may swap them at runtime, which is the point of the node: one document
  // can show a different picture in every slot.
  image: [...COMMON_PROPS, 'r', 'rx', 'ry', 'w', 'h', 'cornerRadius', 'src', 'fit'],
};

const ALLOWED_POINTER_EVENTS = new Set(['click', 'hover', 'leave']);
const NUMERIC_PROPS = new Set([
  'x',
  'y',
  'r',
  'w',
  'h',
  'rx',
  'ry',
  'innerRadius',
  'outerRadius',
  'angle',
  'cornerRadius',
  'size',
  'opacity',
  'rotation',
  'strokeWidth',
  'shadowBlur',
  'shadowOpacity',
]);
const STRING_PROPS = new Set(['text', 'fill', 'stroke', 'fontStyle', 'align', 'valign']);
const ALLOWED_FONT_STYLES = new Set(['normal', 'bold', 'italic', 'italic bold', 'bold italic']);
const ALLOWED_ALIGN = new Set(['left', 'center', 'right']);
const ALLOWED_VALIGN = new Set(['top', 'middle', 'bottom']);

function isAnimatableProp(node: GlamNode, prop: string): boolean {
  return PROPS_BY_TYPE[node.type].includes(prop);
}

export function validate(docInput: unknown): ValidateResult {
  const parsed = parseDoc(docInput);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }
  const doc: GlamDoc = parsed.doc;
  const errors: string[] = [];

  const nodeIds = new Set<string>();
  const nodeById = new Map<string, GlamNode>();
  for (const node of doc.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`duplicate node id: "${node.id}"`);
    }
    nodeIds.add(node.id);
    nodeById.set(node.id, node);
  }

  const groupIds = new Set<string>();
  for (const group of doc.groups ?? []) {
    if (groupIds.has(group.id)) {
      errors.push(`duplicate group id: "${group.id}"`);
    }
    if (nodeIds.has(group.id)) {
      errors.push(`group id "${group.id}" collides with a node id`);
    }
    groupIds.add(group.id);
  }

  for (const node of doc.nodes) {
    if (node.group !== undefined && !groupIds.has(node.group)) {
      errors.push(`node "${node.id}" has "group" referencing undeclared group "${node.group}"`);
    }

    // v1.1: catch a font-style typo that Konva would silently ignore (leaving
    // the text plain) rather than error on.
    if (node.fontStyle !== undefined && !ALLOWED_FONT_STYLES.has(node.fontStyle)) {
      errors.push(
        `node "${node.id}" has invalid fontStyle "${node.fontStyle}" (allowed: normal, bold, italic, "italic bold")`,
      );
    }

    // NOTE: `align`/`valign` need no guard here — unlike `fontStyle` (a bare
    // string in the schema) they are schema enums, so a typo is already a parse
    // error. They ARE guarded on machine `set` values below, where the schema
    // cannot see the type.

    // A negative radius-family dimension throws in the canvas at paint time —
    // refuse it statically (this also closes the same latent gap for the
    // pre-existing `r`).
    const radiusDims: [string, number | undefined][] = [
      ['r', node.r],
      ['rx', node.rx],
      ['ry', node.ry],
      ['innerRadius', node.innerRadius],
      ['outerRadius', node.outerRadius],
      ['cornerRadius', node.cornerRadius],
    ];
    for (const [name, val] of radiusDims) {
      if (val !== undefined && val < 0) {
        errors.push(`node "${node.id}" has negative "${name}" (${val}); radii must be >= 0`);
      }
    }

    // v1.1: a gradient with out-of-range/unordered stops, non-finite geometry,
    // or a degenerate span paints nothing or wrongly — refuse to ship a dead
    // gradient (same spirit as the loop.ms / wander.rx guards below).
    const g = node.fillGradient;
    if (g) {
      let prevOffset = -Infinity;
      for (const stop of g.stops) {
        if (!(stop.offset >= 0 && stop.offset <= 1)) {
          errors.push(
            `node "${node.id}" fillGradient stop offset ${stop.offset} is out of range (must be 0..1)`,
          );
        } else if (stop.offset < prevOffset) {
          errors.push(`node "${node.id}" fillGradient stops must be in ascending offset order`);
        }
        prevOffset = Math.max(prevOffset, stop.offset);
      }
      const coords = [
        g.from?.x,
        g.from?.y,
        g.to?.x,
        g.to?.y,
        g.center?.x,
        g.center?.y,
        g.startRadius,
        g.endRadius,
      ];
      if (coords.some((c) => c !== undefined && !Number.isFinite(c))) {
        errors.push(`node "${node.id}" fillGradient has a non-finite coordinate/radius`);
      }
      if (g.type === 'linear') {
        if (g.to === undefined) {
          errors.push(`node "${node.id}" linear fillGradient needs a "to" point`);
        } else {
          const from = g.from ?? { x: 0, y: 0 };
          if (from.x === g.to.x && from.y === g.to.y) {
            errors.push(
              `node "${node.id}" linear fillGradient is degenerate (from == to) — it would paint a single flat color`,
            );
          }
        }
      }
      if (g.type === 'radial' && !((g.endRadius ?? 0) > 0)) {
        errors.push(`node "${node.id}" radial fillGradient needs a positive "endRadius"`);
      }
    }
  }

  for (const loop of doc.loops ?? []) {
    const node = nodeById.get(loop.node);
    const isGroup = groupIds.has(loop.node);
    if (!node && !isGroup) {
      errors.push(`loop references missing node/group: "${loop.node}"`);
      continue;
    }
    if (isGroup) {
      // Groups (Konva.Group) only expose x/y — consistent with `wander`, which
      // already accepts a group target. Animating a group's x/y slides all its
      // children together (e.g. a whole crab).
      if (loop.prop !== 'x' && loop.prop !== 'y') {
        errors.push(`loop on group "${loop.node}" can only animate "x" or "y", got "${loop.prop}"`);
      }
    } else if (node && (!isAnimatableProp(node, loop.prop) || !NUMERIC_PROPS.has(loop.prop))) {
      errors.push(`loop targets non-animatable/non-numeric prop "${loop.prop}" on node "${loop.node}"`);
    }
    // A non-positive period never advances (loopValueAt treats it as
    // always-settled) — it silently never animates rather than crashing, so
    // flag it explicitly instead of shipping a dead loop.
    if (!(loop.ms > 0)) {
      errors.push(`loop on "${loop.node}" prop "${loop.prop}" has non-positive "ms" (${loop.ms}); must be > 0`);
    }
  }

  for (const wander of doc.wander ?? []) {
    if (!nodeIds.has(wander.target) && !groupIds.has(wander.target)) {
      errors.push(`wander references missing node/group: "${wander.target}"`);
    }
    // Same rationale as loop.ms: a non-positive stepMs/rx/ry settles at the
    // ellipse center forever instead of crashing — flag it so it's caught
    // before ship rather than silently never animating.
    if (!(wander.stepMs > 0)) {
      errors.push(`wander on "${wander.target}" has non-positive "stepMs" (${wander.stepMs}); must be > 0`);
    }
    if (!(wander.rx > 0)) {
      errors.push(`wander on "${wander.target}" has non-positive "rx" (${wander.rx}); must be > 0`);
    }
    if (!(wander.ry > 0)) {
      errors.push(`wander on "${wander.target}" has non-positive "ry" (${wander.ry}); must be > 0`);
    }
  }

  // A loop and a bind/wander both driving the same node+prop fight silently
  // at runtime (each frame/recompute overwrites the other) — validate can't
  // fix the intent, but it can refuse to ship the conflict.
  const loopKeys = new Set((doc.loops ?? []).map((loop) => `${loop.node}.${loop.prop}`));
  for (const bind of doc.bind ?? []) {
    const key = `${bind.node}.${bind.prop}`;
    if (loopKeys.has(key)) {
      errors.push(`conflict: "${bind.node}.${bind.prop}" is targeted by both a "bind" and a "loop"`);
    }
  }
  for (const wander of doc.wander ?? []) {
    for (const prop of ['x', 'y']) {
      const key = `${wander.target}.${prop}`;
      if (loopKeys.has(key)) {
        errors.push(`conflict: "${key}" is targeted by both a "wander" and a "loop"`);
      }
    }
  }

  const inputNames = new Set(Object.keys(doc.inputs ?? {}));

  // Only numeric inputs are usable inside an expr — evalExpr's scope is
  // Record<string, number>, and a string input isn't arithmetic-comparable.
  const numericInputs: Record<string, number> = {};
  for (const [name, value] of Object.entries(doc.inputs ?? {})) {
    if (typeof value === 'number') numericInputs[name] = value;
  }

  for (const bind of doc.bind ?? []) {
    const node = nodeById.get(bind.node);
    if (!node) {
      errors.push(`bind references missing node: "${bind.node}"`);
      continue;
    }
    if (!isAnimatableProp(node, bind.prop)) {
      errors.push(`bind targets non-animatable prop "${bind.prop}" on node "${bind.node}"`);
    }
    // Parse + evaluate the expr once against the inputs' initial values: every
    // identifier must be a declared numeric input, every function whitelisted
    // (both enforced inside evalExpr), and the result must be finite.
    try {
      const result = evalExpr(bind.expr, numericInputs);
      if (!Number.isFinite(result)) {
        errors.push(
          `bind on node "${bind.node}" prop "${bind.prop}" has expr "${bind.expr}" that does not evaluate to a finite number`,
        );
      }
    } catch (err) {
      errors.push(
        `bind on node "${bind.node}" prop "${bind.prop}" has invalid expr "${bind.expr}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  if (doc.machine) {
    const { machine } = doc;
    const stateNames = new Set(Object.keys(machine.states));
    if (!stateNames.has(machine.initial)) {
      errors.push(`machine.initial "${machine.initial}" is not a defined state`);
    }
    for (const [stateName, state] of Object.entries(machine.states)) {
      for (const [onKey, target] of Object.entries(state.on ?? {})) {
        if (!stateNames.has(target)) {
          errors.push(
            `state "${stateName}" has "on.${onKey}" targeting undefined state "${target}"`,
          );
        }
        const classified = classifyOnKey(onKey);
        if (classified.kind === 'event') {
          // "INPUT" is reserved: the player's machine.ts sends an internal
          // { type: 'INPUT', inputs } event on every setInput() call to drive
          // input-condition transitions — an authored "@INPUT" on-key would
          // silently collide with (and get overwritten by) that machinery.
          if (classified.event === 'INPUT') {
            errors.push(
              `state "${stateName}" has "on.@INPUT", but "INPUT" is reserved for the internal input-condition event`,
            );
          }
        } else if (classified.kind === 'pointer') {
          if (!nodeById.has(classified.node)) {
            errors.push(
              `state "${stateName}" has "on" key referencing missing node "${classified.node}"`,
            );
          }
          if (!ALLOWED_POINTER_EVENTS.has(classified.event)) {
            errors.push(
              `state "${stateName}" has "on" key with unknown event "${classified.event}" (allowed: click, hover, leave)`,
            );
          }
        } else if (classified.kind === 'condition') {
          if (!inputNames.has(classified.input)) {
            errors.push(
              `state "${stateName}" has "on" condition referencing unknown input "${classified.input}"`,
            );
          }
        } else {
          errors.push(`state "${stateName}" has malformed "on" key "${onKey}"`);
        }
      }
      for (const [setKey, setValue] of Object.entries(state.set ?? {})) {
        const dotIdx = setKey.indexOf('.');
        if (dotIdx <= 0) {
          errors.push(`state "${stateName}" has malformed "set" key "${setKey}"`);
          continue;
        }
        const nodeId = setKey.slice(0, dotIdx);
        const prop = setKey.slice(dotIdx + 1);
        const node = nodeById.get(nodeId);
        if (!node) {
          errors.push(`state "${stateName}" has "set" targeting missing node "${nodeId}"`);
          continue;
        }
        if (!isAnimatableProp(node, prop)) {
          errors.push(
            `state "${stateName}" has "set" targeting non-animatable prop "${prop}" on node "${nodeId}"`,
          );
          continue;
        }
        // Value type must match the prop's kind (fix #5) — e.g. a string
        // handed to a numeric prop like "r" would silently tween to NaN.
        if (NUMERIC_PROPS.has(prop) && typeof setValue !== 'number') {
          errors.push(
            `state "${stateName}" has "set" value for "${setKey}" expected a number, got ${typeof setValue}`,
          );
        } else if (STRING_PROPS.has(prop) && typeof setValue !== 'string') {
          errors.push(
            `state "${stateName}" has "set" value for "${setKey}" expected a string, got ${typeof setValue}`,
          );
        } else if (
          prop === 'fontStyle' &&
          typeof setValue === 'string' &&
          !ALLOWED_FONT_STYLES.has(setValue)
        ) {
          // Mirror the node-level fontStyle guard on transition `set` values —
          // an invalid style would silently render plain (v1.1).
          errors.push(
            `state "${stateName}" has "set" value for "${setKey}" with invalid fontStyle "${setValue}" (allowed: normal, bold, italic, "italic bold")`,
          );
        } else if (prop === 'align' && typeof setValue === 'string' && !ALLOWED_ALIGN.has(setValue)) {
          // The node-level case is caught by the schema enum; a `set` value is
          // an untyped string, so it needs the same guard here or a typo
          // silently reverts the label to the pen origin.
          errors.push(
            `state "${stateName}" has "set" value for "${setKey}" with invalid align "${setValue}" (allowed: left, center, right)`,
          );
        } else if (prop === 'valign' && typeof setValue === 'string' && !ALLOWED_VALIGN.has(setValue)) {
          errors.push(
            `state "${stateName}" has "set" value for "${setKey}" with invalid valign "${setValue}" (allowed: top, middle, bottom)`,
          );
        }
      }
    }
  }

  // Rung 2: ink must draw into a real `stroke` node, and a match target must be
  // a well-formed polyline with a positive tolerance — otherwise the player
  // would ink into nothing or score against garbage. A doc uses EITHER a single
  // `into` node OR a `strokes` list (multi-stroke, pen-lift accumulation).
  if (doc.ink) {
    const requireStrokeNode = (id: string, label: string): void => {
      const node = nodeById.get(id);
      if (!node) {
        errors.push(`${label} references missing node: "${id}"`);
      } else if (node.type !== 'stroke') {
        errors.push(`${label} node "${id}" must be a "stroke" node, got "${node.type}"`);
      }
    };
    const checkMatch = (match: { target: number[]; tolerance: number }, label: string): void => {
      if (match.target.length < 4 || match.target.length % 2 !== 0) {
        errors.push(`${label}.target must be a flat [x,y,...] path with >= 2 points (even length >= 4)`);
      }
      if (!(match.tolerance > 0)) {
        errors.push(`${label}.tolerance must be > 0, got ${match.tolerance}`);
      }
    };

    const hasInto = typeof doc.ink.into === 'string';
    const hasStrokes = Array.isArray(doc.ink.strokes) && doc.ink.strokes.length > 0;
    if (hasInto && hasStrokes) {
      errors.push(`ink must set exactly one of "into" (single-stroke) or "strokes" (multi-stroke), not both`);
    } else if (!hasInto && !hasStrokes) {
      errors.push(`ink must set either "into" (single-stroke) or a non-empty "strokes" list`);
    }

    if (hasInto) {
      requireStrokeNode(doc.ink.into as string, 'ink.into');
      if (doc.ink.match) checkMatch(doc.ink.match, 'ink.match');
    }
    if (hasStrokes) {
      (doc.ink.strokes as { into: string; match?: { target: number[]; tolerance: number } }[]).forEach(
        (s, i) => {
          requireStrokeNode(s.into, `ink.strokes[${i}].into`);
          if (s.match) checkMatch(s.match, `ink.strokes[${i}].match`);
        },
      );
    }
  }

  // Guided ink: each stroke needs a well-formed `path` and a real `stroke` node
  // to trim into; optional handle/arrow must reference existing nodes.
  if (doc.guided) {
    const g = doc.guided;
    if (!Array.isArray(g.strokes) || g.strokes.length === 0) {
      errors.push('guided.strokes must be a non-empty list');
    }
    if (g.grab != null && !(g.grab > 0)) {
      errors.push(`guided.grab must be > 0, got ${g.grab}`);
    }
    (g.strokes ?? []).forEach((s, i) => {
      if (!Array.isArray(s.path) || s.path.length < 4 || s.path.length % 2 !== 0) {
        errors.push(`guided.strokes[${i}].path must be a flat [x,y,...] path with >= 2 points (even length >= 4)`);
      }
      const into = nodeById.get(s.into);
      if (!into) errors.push(`guided.strokes[${i}].into references missing node: "${s.into}"`);
      else if (into.type !== 'stroke') errors.push(`guided.strokes[${i}].into node "${s.into}" must be a "stroke" node, got "${into.type}"`);
      if (s.handle != null && !nodeById.has(s.handle)) errors.push(`guided.strokes[${i}].handle references missing node: "${s.handle}"`);
      if (s.arrow != null && !nodeById.has(s.arrow)) errors.push(`guided.strokes[${i}].arrow references missing node: "${s.arrow}"`);
    });
  }

  return { ok: errors.length === 0, errors };
}
