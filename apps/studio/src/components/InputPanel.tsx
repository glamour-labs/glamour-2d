import { useEffect, useState } from 'react';
import type { GlamDoc } from '@glamour-labs/core';
import type { GlamPlayer } from '@glamour-labs/player';

interface InputPanelProps {
  inputs: GlamDoc['inputs'];
  player: GlamPlayer | null;
}

/**
 * Infers a slider range from an input's initial value. There's no range
 * metadata in the schema, so this is necessarily a guess — but it must be a
 * *deliberate* one, not an accident of arithmetic: the old heuristic
 * (`Math.max(1, value * 2, 1)`) happened to land on 0..1 for a value of 0
 * only because doubling zero is zero, not because 0..1 was chosen on
 * purpose. A value starting at 0 is treated as fractional (matches every
 * `bind.expr` in this codebase, which takes a 0..1 `t` via `lerp`); anything
 * else gets a range scaled off its own magnitude.
 */
function inferRange(value: number): { min: number; max: number; step: number } {
  if (value >= 0 && value <= 1) {
    return { min: 0, max: 1, step: 0.01 };
  }
  const magnitude = Math.max(Math.abs(value), 1);
  return {
    min: Math.min(0, value),
    max: Math.max(value * 2, magnitude * 2),
    step: magnitude >= 10 ? 1 : 0.01,
  };
}

interface InputRowProps {
  name: string;
  initialValue: number | string;
  player: GlamPlayer | null;
}

/** One slider (numbers) or text field (strings), wired to `player.setInput`. */
function InputRow({ name, initialValue, player }: InputRowProps): JSX.Element {
  const [value, setValue] = useState(initialValue);

  // Controlled + resynced (fix #11): a fresh doc load hands down a new
  // `initialValue` for the same input name — without this, an uncontrolled
  // `defaultValue` would keep showing the stale value from first mount.
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  if (typeof value === 'number') {
    const { min, max, step } = inferRange(typeof initialValue === 'number' ? initialValue : 0);
    return (
      <div className="input-row">
        <label htmlFor={`input-${name}`}>{name}</label>
        <input
          id={`input-${name}`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={!player}
          onChange={(e) => {
            const v = Number(e.target.value);
            setValue(v);
            player?.setInput(name, v);
          }}
        />
      </div>
    );
  }

  return (
    <div className="input-row">
      <label htmlFor={`input-${name}`}>{name}</label>
      <input
        id={`input-${name}`}
        type="text"
        value={value}
        disabled={!player}
        onChange={(e) => {
          setValue(e.target.value);
          player?.setInput(name, e.target.value);
        }}
      />
    </div>
  );
}

export function InputPanel({ inputs, player }: InputPanelProps): JSX.Element {
  const entries = Object.entries(inputs ?? {});

  return (
    <div className="pane input-panel">
      <h2>Inputs</h2>
      {entries.length === 0 && <p className="hint">No inputs declared in this doc.</p>}
      {entries.map(([name, value]) => (
        <InputRow key={name} name={name} initialValue={value} player={player} />
      ))}
    </div>
  );
}
