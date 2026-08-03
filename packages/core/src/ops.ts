import { classifyOnKey } from './onkey.js';
import type { GlamBind, GlamDoc, GlamNode, GlamState } from './types.js';

export type Op =
  | { op: 'addNode'; node: GlamNode }
  | { op: 'removeNode'; id: string }
  | { op: 'setProps'; id: string; props: Partial<GlamNode> }
  | { op: 'setInput'; name: string; value: number | string }
  | { op: 'defineState'; name: string; state: GlamState }
  | { op: 'setInitial'; name: string }
  | { op: 'addBinding'; bind: GlamBind };

/** True if a pointer-form `on` key ("<node>.<event>") targets `nodeId`. */
function onKeyReferencesNode(key: string, nodeId: string): boolean {
  const classified = classifyOnKey(key);
  return classified.kind === 'pointer' && classified.node === nodeId;
}

/** True if a `set` key ("<node>.<prop>") targets `nodeId`. */
function setKeyReferencesNode(key: string, nodeId: string): boolean {
  const dotIdx = key.indexOf('.');
  if (dotIdx <= 0) return false;
  return key.slice(0, dotIdx) === nodeId;
}

function applyOne(doc: GlamDoc, op: Op): GlamDoc {
  switch (op.op) {
    case 'addNode': {
      if (doc.nodes.some((n) => n.id === op.node.id)) {
        throw new Error(`addNode: a node with id "${op.node.id}" already exists`);
      }
      // Clone so a caller mutating the op object after the call can't alias
      // into the returned doc (fix #7).
      return { ...doc, nodes: [...doc.nodes, structuredClone(op.node)] };
    }
    case 'removeNode': {
      if (!doc.nodes.some((n) => n.id === op.id)) {
        throw new Error(`removeNode: no node with id "${op.id}"`);
      }
      const next: GlamDoc = { ...doc, nodes: doc.nodes.filter((n) => n.id !== op.id) };
      // Drop dangling references to the removed node so the reducer never
      // returns an invalid doc (fix #6): bind entries targeting it, and any
      // machine `on`/`set` keys targeting it.
      if (doc.bind) {
        next.bind = doc.bind.filter((b) => b.node !== op.id);
      }
      if (doc.machine) {
        const states: Record<string, GlamState> = {};
        for (const [stateName, state] of Object.entries(doc.machine.states)) {
          const nextState: GlamState = { ...state };
          if (state.on) {
            nextState.on = Object.fromEntries(
              Object.entries(state.on).filter(([key]) => !onKeyReferencesNode(key, op.id)),
            );
          }
          if (state.set) {
            nextState.set = Object.fromEntries(
              Object.entries(state.set).filter(([key]) => !setKeyReferencesNode(key, op.id)),
            );
          }
          states[stateName] = nextState;
        }
        next.machine = { ...doc.machine, states };
      }
      return next;
    }
    case 'setProps': {
      const idx = doc.nodes.findIndex((n) => n.id === op.id);
      if (idx === -1) {
        throw new Error(`setProps: no node with id "${op.id}"`);
      }
      const nodes = doc.nodes.slice();
      nodes[idx] = { ...(nodes[idx] as GlamNode), ...structuredClone(op.props) };
      return { ...doc, nodes };
    }
    case 'setInput': {
      return { ...doc, inputs: { ...(doc.inputs ?? {}), [op.name]: op.value } };
    }
    case 'defineState': {
      const machine = doc.machine ?? { initial: op.name, states: {} };
      return {
        ...doc,
        machine: {
          ...machine,
          states: { ...machine.states, [op.name]: structuredClone(op.state) },
        },
      };
    }
    case 'setInitial': {
      if (!doc.machine || !(op.name in doc.machine.states)) {
        throw new Error(`setInitial: no defined state "${op.name}"`);
      }
      return { ...doc, machine: { ...doc.machine, initial: op.name } };
    }
    case 'addBinding': {
      return { ...doc, bind: [...(doc.bind ?? []), structuredClone(op.bind)] };
    }
    default: {
      const exhaustive: never = op;
      throw new Error(`applyOps: unknown op ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Pure structured-edit reducer: never mutates `doc`, always returns a fresh
 * document. Throws if an op references a missing node/state.
 */
export function applyOps(doc: GlamDoc, ops: Op[]): GlamDoc {
  let current = structuredClone(doc);
  for (const op of ops) {
    current = applyOne(current, op);
  }
  return current;
}
