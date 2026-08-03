import { useState } from 'react';
import type { GlamDoc } from '@glam/core';

interface UsePanelProps {
  doc: GlamDoc | null;
}

type TabId = 'webComponent' | 'javascript' | 'react';

const TABS: { id: TabId; label: string }[] = [
  { id: 'webComponent', label: 'Web component' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'react', label: 'React' },
];

const WEB_COMPONENT_SNIPPET = `<script src="/glam-player.umd.js"></script>
<glam-canvas src="/my.glam"></glam-canvas>`;

function buildJavaScriptSnippet(doc: GlamDoc): string {
  const docJson = JSON.stringify(doc, null, 2);
  const inputNames = Object.keys(doc.inputs ?? {});
  const firstInput = inputNames[0];
  const setInputLine = firstInput
    ? `player.setInput('${firstInput}', 0.5);`
    : `player.setInput('inputName', 0.5);`;

  return `<script src="/glam-player.umd.js"></script>
<div id="stage"></div>
<script>
  const doc = ${docJson};
  const player = Glam.renderGlamour(doc, document.getElementById('stage'));
  // ${setInputLine}
</script>`;
}

function buildReactSnippet(doc: GlamDoc): string {
  const docJson = JSON.stringify(doc, null, 2);
  const inputNames = Object.keys(doc.inputs ?? {});
  const inputsObj = inputNames.length
    ? `{ ${inputNames.map((name) => `${name}: ${JSON.stringify((doc.inputs as Record<string, unknown>)[name])}`).join(', ')} }`
    : '{}';

  return `// Glamour component — see docs/USING-GLAMOUR.md (Path C) for the wrapper source.
const doc = ${docJson};

<Glamour doc={doc} inputs={${inputsObj}} />`;
}

interface CopyButtonProps {
  code: string;
  label: string;
}

function CopyButton({ code, label }: CopyButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable/denied — nothing more we can do here.
    }
  }

  return (
    <button type="button" onClick={() => void handleCopy()} aria-label={`Copy ${label} snippet`}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export function UsePanel({ doc }: UsePanelProps): JSX.Element {
  const [tab, setTab] = useState<TabId>('webComponent');

  return (
    <div className="pane use-panel">
      <h2>Use it</h2>
      <div className="use-tabs" role="tablist" aria-label="Implementation code">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'use-tab use-tab-active' : 'use-tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!doc && <p className="hint">Fix the JSON to generate code.</p>}

      {doc && tab === 'webComponent' && (
        <div className="use-tabpanel" role="tabpanel">
          <p className="hint">
            Assumes the doc is saved as <code>my.glam</code>; the UMD bundle comes from{' '}
            <code>packages/player/dist/</code>.
          </p>
          <pre className="use-code">
            <code>{WEB_COMPONENT_SNIPPET}</code>
          </pre>
          <CopyButton code={WEB_COMPONENT_SNIPPET} label="web component" />
        </div>
      )}

      {doc && tab === 'javascript' && (
        <div className="use-tabpanel" role="tabpanel">
          <pre className="use-code">
            <code>{buildJavaScriptSnippet(doc)}</code>
          </pre>
          <CopyButton code={buildJavaScriptSnippet(doc)} label="JavaScript" />
        </div>
      )}

      {doc && tab === 'react' && (
        <div className="use-tabpanel" role="tabpanel">
          <pre className="use-code">
            <code>{buildReactSnippet(doc)}</code>
          </pre>
          <CopyButton code={buildReactSnippet(doc)} label="React" />
        </div>
      )}
    </div>
  );
}
