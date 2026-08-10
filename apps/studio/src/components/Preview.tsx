import { useEffect, useRef } from 'react';
import type { GlamDoc } from '@glamour-labs/core';
import { renderGlamour, type GlamPlayer } from '@glamour-labs/player';

interface PreviewProps {
  doc: GlamDoc;
  onPlayerReady(player: GlamPlayer | null): void;
}

/** Live `renderGlamour` preview. Re-mounts the player whenever `doc` changes identity. */
export function Preview({ doc, onPlayerReady }: PreviewProps): JSX.Element {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const player = renderGlamour(doc, mount);
    onPlayerReady(player);

    return () => {
      onPlayerReady(null);
      player.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  return (
    <div className="pane preview-pane">
      <h2>Preview</h2>
      <div ref={mountRef} data-testid="preview-mount" className="preview-mount" />
    </div>
  );
}
