import { expect, test } from 'vitest';
import { doctorCommand, formatDoctorReport } from '../src/commands/doctor.js';

test('reports every render prerequisite, and passes in a built dev checkout', async () => {
  const report = await doctorCommand();

  // All three prerequisites are always reported, pass or fail — someone missing
  // two of them should learn both in one run, not one per round trip.
  expect(report.checks.map((c) => c.name)).toEqual([
    'player UMD bundle',
    'playwright package',
    'chromium browser',
  ]);
  expect(report.canRender).toBe(true);
});

test('a failing check carries a runnable fix, and the report prints it', () => {
  const text = formatDoctorReport({
    canRender: false,
    checks: [
      { name: 'player UMD bundle', ok: true, detail: '/somewhere/glam-player.umd.js' },
      {
        name: 'playwright package',
        ok: false,
        detail: "Cannot find package 'playwright'",
        fix: 'npm install -g playwright && npx playwright install chromium',
      },
    ],
  });

  expect(text).toContain('FAIL  playwright package');
  expect(text).toContain('npm install -g playwright');
  // The distinction that stops a caller editing a perfectly good document.
  expect(text).toContain('`new`, `validate` and `preview` still work');
});

test('a healthy report never emits a fix section', () => {
  const text = formatDoctorReport({
    canRender: true,
    checks: [{ name: 'chromium browser', ok: true, detail: 'launches' }],
  });

  expect(text).not.toContain('Fix, in order:');
  expect(text).toContain('is ready');
});
