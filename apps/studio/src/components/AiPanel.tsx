import { useState } from 'react';
import { listPrimitives, palette, type GlamDoc, type Op } from '@glamour-labs/core';

interface AiPanelProps {
  doc: GlamDoc;
  onApplyOps(ops: Op[]): void;
}

// No backend endpoint is wired in v1: without a configured key/endpoint the
// prompt box cannot do anything real, so we never pretend it can. The
// palette path below is what actually works offline.
const AI_ENDPOINT = import.meta.env.VITE_GLAM_AI_ENDPOINT as string | undefined;

const PRIMITIVE_NAMES = ['hoverGrow', 'fadeIn', 'progressBar', 'clickToggle'] as const;
type PrimitiveName = (typeof PRIMITIVE_NAMES)[number];

function buildOps(name: PrimitiveName, nodeId: string, inputName: string): Op[] {
  switch (name) {
    case 'hoverGrow':
      return palette.hoverGrow(nodeId);
    case 'fadeIn':
      return palette.fadeIn(nodeId);
    case 'progressBar':
      return palette.progressBar(nodeId, inputName);
    case 'clickToggle':
      return palette.clickToggle(nodeId, { fill: '#4c7dff' }, { fill: '#ff9f43' });
    default:
      return [];
  }
}

export function AiPanel({ doc, onApplyOps }: AiPanelProps): JSX.Element {
  const primitives = listPrimitives();
  const nodeIds = doc.nodes.map((n) => n.id);
  const inputNames = Object.keys(doc.inputs ?? {});

  const [prompt, setPrompt] = useState('');
  const [primitive, setPrimitive] = useState<PrimitiveName>('hoverGrow');
  const [nodeId, setNodeId] = useState<string>(nodeIds[0] ?? '');
  const [inputName, setInputName] = useState<string>(inputNames[0] ?? '');
  const [applyError, setApplyError] = useState<string | null>(null);

  const mode: 'connected' | 'offline' = AI_ENDPOINT ? 'connected' : 'offline';

  function handleApply(): void {
    if (!nodeId) {
      setApplyError('Select a target node first.');
      return;
    }
    try {
      onApplyOps(buildOps(primitive, nodeId, inputName));
      setApplyError(null);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handlePromptSubmit(): Promise<void> {
    if (mode !== 'connected' || !AI_ENDPOINT) return;
    // Backend wiring path (only reachable when VITE_GLAM_AI_ENDPOINT is set).
    await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, doc }),
    });
  }

  return (
    <div className="pane ai-panel">
      <h2>AI</h2>
      <div className={mode === 'connected' ? 'ai-mode ai-mode-connected' : 'ai-mode ai-mode-offline'}>
        {mode === 'connected'
          ? 'Connected mode — prompt posts to configured backend.'
          : 'Offline mode — no AI backend configured. Prompt box is inactive; use the palette below.'}
      </div>

      <textarea
        className="ai-prompt"
        placeholder={
          mode === 'connected'
            ? 'Describe the animation you want…'
            : 'Prompt box requires ANTHROPIC_API_KEY / backend (not configured) — use the palette below instead.'
        }
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={mode !== 'connected'}
      />
      <button type="button" disabled={mode !== 'connected' || !prompt} onClick={() => void handlePromptSubmit()}>
        Send prompt
      </button>

      <hr />

      <h3>Palette</h3>
      <div className="palette-form">
        <label htmlFor="primitive-select">Primitive</label>
        <select
          id="primitive-select"
          value={primitive}
          onChange={(e) => setPrimitive(e.target.value as PrimitiveName)}
        >
          {PRIMITIVE_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <label htmlFor="node-select">Target node</label>
        <select id="node-select" value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
          {nodeIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>

        {primitive === 'progressBar' && (
          <>
            <label htmlFor="input-select">Input</label>
            <select id="input-select" value={inputName} onChange={(e) => setInputName(e.target.value)}>
              {inputNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </>
        )}

        <button type="button" onClick={handleApply} disabled={!nodeId}>
          Apply primitive
        </button>
      </div>

      <ul className="primitive-list">
        {primitives.map((p) => (
          <li key={p.name}>
            <strong>{p.name}</strong> — {p.description}
          </li>
        ))}
      </ul>

      {applyError && (
        <div className="apply-error" role="alert">
          {applyError}
        </div>
      )}
    </div>
  );
}
