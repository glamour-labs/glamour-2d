interface JsonEditorProps {
  value: string;
  onChange(value: string): void;
  errors: string[];
}

export function JsonEditor({ value, onChange, errors }: JsonEditorProps): JSX.Element {
  const hasErrors = errors.length > 0;
  return (
    <div className="pane json-editor">
      <h2>Document</h2>
      <textarea
        className={hasErrors ? 'json-textarea json-textarea-invalid' : 'json-textarea'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-invalid={hasErrors}
        aria-label="glam document JSON"
      />
      {hasErrors && (
        <div className="validation-errors" role="alert">
          {errors.map((err) => (
            <div key={err} className="validation-error-line">
              {err}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
