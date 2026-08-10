import { useCallback, useMemo, useState } from 'react';
import { validate, type GlamDoc, type Op, applyOps } from '@glamour-labs/core';
import type { GlamPlayer } from '@glamour-labs/player';
import { JsonEditor } from './components/JsonEditor.js';
import { Preview } from './components/Preview.js';
import { InputPanel } from './components/InputPanel.js';
import { StatePanel } from './components/StatePanel.js';
import { AiPanel } from './components/AiPanel.js';
import { UsePanel } from './components/UsePanel.js';
import { STARTER_DOC_JSON } from './starterDoc.js';

function tryParse(text: string): { doc: GlamDoc | null; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { doc: null, errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`] };
  }
  const result = validate(parsed);
  if (!result.ok) {
    return { doc: null, errors: result.errors };
  }
  return { doc: parsed as GlamDoc, errors: [] };
}

export function App(): JSX.Element {
  const initial = useMemo(() => tryParse(STARTER_DOC_JSON), []);

  const [jsonText, setJsonText] = useState(STARTER_DOC_JSON);
  const [doc, setDoc] = useState<GlamDoc | null>(initial.doc);
  const [errors, setErrors] = useState<string[]>(initial.errors);
  const [player, setPlayer] = useState<GlamPlayer | null>(null);

  const handleJsonChange = useCallback((text: string) => {
    setJsonText(text);
    const result = tryParse(text);
    setErrors(result.errors);
    if (result.doc) {
      setDoc(result.doc);
    }
    // On invalid input the last-known-good `doc` is kept so the preview
    // doesn't unmount on every keystroke of a mid-edit invalid doc.
  }, []);

  const handleApplyOps = useCallback(
    (ops: Op[]) => {
      if (!doc) return;
      const nextDoc = applyOps(doc, ops);
      const result = validate(nextDoc);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setDoc(nextDoc);
      setErrors([]);
      setJsonText(JSON.stringify(nextDoc, null, 2));
    },
    [doc],
  );

  return (
    <div className="studio-app">
      <header className="studio-header">
        <h1>Glamour Studio</h1>
      </header>
      <main className="studio-main">
        <div className="left-column">
          <JsonEditor value={jsonText} onChange={handleJsonChange} errors={errors} />
          <UsePanel doc={doc} />
        </div>
        <div className="right-column">
          {doc && <Preview doc={doc} onPlayerReady={setPlayer} />}
          {doc && <InputPanel inputs={doc.inputs} player={player} />}
          <StatePanel player={player} />
          {doc && <AiPanel doc={doc} onApplyOps={handleApplyOps} />}
        </div>
      </main>
    </div>
  );
}
