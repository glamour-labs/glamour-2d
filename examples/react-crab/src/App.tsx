import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Glamour, type GlamourHandle, type GlamDoc, type GlamEmitEvent, type GlamPointerEvent } from '@glam/react';
import crabJson from './crab.json';
import manifest from './crab-letters.json';

// The crab canvas is a Glamour doc (generated) that only SHOWS lettered crabs,
// moves them, and emits which crab was tapped. Every rule below — the target
// letter, correct/wrong, the sparkle, win/lose — lives HERE in React. The host
// drives per-crab feedback through the player's `set` (recolor) primitive.
const crabDoc = crabJson as unknown as GlamDoc;

const ORANGE = '#f2913f', CLAW = '#e07d2e', GREEN = '#35c46a', RED = '#e23b2f';
const MAX_WRONG = 3;

type Phase = 'idle' | 'playing' | 'won' | 'lost';
interface Spark { id: number; x: number; y: number }

export function App(): JSX.Element {
  const glam = useRef<GlamourHandle>(null);
  const lastDown = useRef({ x: 200, y: 150 });
  const answered = useRef<Set<string>>(new Set());
  const sparkId = useRef(0);

  const [phase, setPhase] = useState<Phase>('idle');
  const [found, setFound] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // bodyId -> { letter, clawL, clawR, correct }
  const byBody = useMemo(() => {
    const m = new Map<string, { letter: string; clawL: string; clawR: string; correct: boolean }>();
    for (const c of manifest.crabs) {
      m.set(c.body, { letter: c.letter, clawL: c.clawL, clawR: c.clawR, correct: c.letter === manifest.target });
    }
    return m;
  }, []);

  const recolor = (crab: { clawL: string; clawR: string }, body: string, color: string) => {
    glam.current?.set(body, 'fill', color);
    glam.current?.set(crab.clawL, 'fill', color);
    glam.current?.set(crab.clawR, 'fill', color);
  };

  const spawnSpark = (x: number, y: number) => {
    const id = sparkId.current++;
    setSparks((s) => [...s, { id, x, y }]);
    setTimeout(() => setSparks((s) => s.filter((sp) => sp.id !== id)), 700);
  };

  const handlePointer = useCallback((e: GlamPointerEvent) => {
    if (e.type === 'down') lastDown.current = { x: e.x, y: e.y };
  }, []);

  const handleEmit = useCallback((e: GlamEmitEvent) => {
    if (phaseRef.current !== 'playing') return;
    const crab = byBody.get(e.node);
    if (!crab || answered.current.has(e.node)) return;
    answered.current.add(e.node);
    if (crab.correct) {
      recolor(crab, e.node, GREEN);
      spawnSpark(lastDown.current.x, lastDown.current.y);
      setFound((f) => {
        const n = f + 1;
        if (n >= manifest.total) setPhase('won');
        return n;
      });
    } else {
      recolor(crab, e.node, RED);
      setWrong((w) => {
        const n = w + 1;
        if (n >= MAX_WRONG) setPhase('lost');
        return n;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byBody]);

  // Crabs move only while a round is on.
  useEffect(() => {
    if (phase === 'playing') glam.current?.play();
    else glam.current?.pause();
  }, [phase]);

  const start = () => {
    answered.current = new Set();
    // reset every crab back to its neutral colours
    for (const c of manifest.crabs) {
      glam.current?.set(c.body, 'fill', ORANGE);
      glam.current?.set(c.clawL, 'fill', CLAW);
      glam.current?.set(c.clawR, 'fill', CLAW);
    }
    setFound(0);
    setWrong(0);
    setSparks([]);
    setPhase('playing');
  };

  const lives = MAX_WRONG - wrong;

  return (
    <div style={styles.page}>
      <style>{SPARK_CSS}</style>
      <h1 style={styles.title}>🦀 Crab Letter Hunt</h1>
      <p style={styles.subtitle}>
        Find every crab wearing the letter <b style={{ color: '#1b6' }}>{manifest.target}</b> — before 3 mistakes.
      </p>

      <div style={styles.hud}>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Found</div>
          <div style={styles.statValue}>{found}/{manifest.total}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Lives</div>
          <div style={styles.statValue}>{'❤️'.repeat(Math.max(0, lives)) || '—'}</div>
        </div>
      </div>

      <div style={styles.stage}>
        <Glamour ref={glam} doc={crabDoc} onEmit={handleEmit} onPointer={handlePointer} style={styles.canvas} />
        {sparks.map((s) => <Sparkle key={s.id} x={s.x} y={s.y} />)}
        {phase !== 'playing' && (
          <div style={styles.overlay}>
            {phase === 'won' && <div style={styles.big}>🎉 You found all the {manifest.target}'s!</div>}
            {phase === 'lost' && <div style={styles.big}>💥 Too many misses!</div>}
            <button type="button" style={styles.button} onClick={start}>
              {phase === 'idle' ? 'Start' : 'Play again'}
            </button>
          </div>
        )}
      </div>

      <p style={styles.footnote}>
        The canvas only shows lettered crabs, moves them, and emits which one you tapped. The target
        letter, correct/wrong, the sparkle, and win/lose all run in React — the host drives each crab's
        colour through <code>player.set</code>.
      </p>
    </div>
  );
}

/** A one-shot gold star burst — 6 stars fly outward and fade, then React removes it. */
function Sparkle({ x, y }: { x: number; y: number }): JSX.Element {
  const stars = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    const r = 34;
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, i };
  });
  return (
    <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none' }}>
      {stars.map((s) => (
        <span
          key={s.i}
          className="glam-spark"
          style={{ ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px` }}
        >
          ✦
        </span>
      ))}
    </div>
  );
}

const SPARK_CSS = `
@keyframes glamSpark {
  0%   { transform: translate(-50%,-50%) scale(0.2); opacity: 0; }
  25%  { opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.15); opacity: 0; }
}
.glam-spark {
  position: absolute; left: 0; top: 0;
  color: #ffd23f; font-size: 18px; text-shadow: 0 0 6px #ffec99;
  animation: glamSpark 0.7s ease-out forwards;
}`;

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: 'system-ui, sans-serif', maxWidth: 460, margin: '32px auto', padding: '0 16px', color: '#1b2430', textAlign: 'center' },
  title: { fontSize: 30, margin: '0 0 4px' },
  subtitle: { color: '#5b6b77', margin: '0 0 16px', fontSize: 15 },
  hud: { display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12 },
  stat: { background: '#f2f6fb', borderRadius: 12, padding: '8px 20px', minWidth: 96 },
  statLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#7a8798' },
  statValue: { fontSize: 26, fontWeight: 700 },
  stage: { position: 'relative', width: 400, height: 300, margin: '0 auto', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.14)' },
  canvas: { width: 400, height: 300, cursor: 'pointer' },
  overlay: { position: 'absolute', inset: 0, background: 'rgba(15,25,40,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#fff' },
  big: { fontSize: 22, fontWeight: 700, padding: '0 20px', textAlign: 'center' },
  button: { fontSize: 18, fontWeight: 600, padding: '10px 28px', borderRadius: 999, border: 'none', background: '#ff7a45', color: '#fff', cursor: 'pointer' },
  footnote: { fontSize: 12, color: '#8a97a6', marginTop: 20, lineHeight: 1.5 },
};
