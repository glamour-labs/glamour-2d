import { useEffect, useState } from 'react';
import type { GlamPlayer } from '@glamour-labs/player';

interface StatePanelProps {
  player: GlamPlayer | null;
}

/**
 * Read-only readout of `player.getState()`. `GlamPlayer` has no state-change
 * subscription, so we poll on a short interval — cheap for a single
 * statechart and avoids growing the player's public API for this.
 */
export function StatePanel({ player }: StatePanelProps): JSX.Element {
  const [state, setState] = useState<string>(() => player?.getState() ?? '');

  useEffect(() => {
    if (!player) {
      setState('');
      return undefined;
    }
    setState(player.getState());
    const id = window.setInterval(() => setState(player.getState()), 150);
    return () => window.clearInterval(id);
  }, [player]);

  return (
    <div className="pane state-panel">
      <h2>Machine state</h2>
      <div className="state-readout" data-testid="state-readout">
        {state || '(no machine)'}
      </div>
    </div>
  );
}
