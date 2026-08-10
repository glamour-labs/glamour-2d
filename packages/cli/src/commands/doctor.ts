import { diagnoseRenderEnv, installKind, type EnvCheck } from '@glamour-labs/player/node';

const INSTALL_LABEL = {
  'source-checkout': 'source checkout',
  'global-install': 'global install',
  'project-dependency': 'project dependency',
} as const;

export interface DoctorReport {
  checks: EnvCheck[];
  /** True when every prerequisite for `glam render` is satisfied. */
  canRender: boolean;
}

/**
 * Answer one question: can THIS install produce a PNG?
 *
 * `glam validate`, `glam new` and `glam preview` need nothing beyond the CLI
 * itself; only `render` needs a browser. So a failing doctor does not mean the
 * CLI is broken — it means the self-verify loop's second half is unavailable,
 * which is worth stating plainly rather than leaving to be inferred.
 */
export async function doctorCommand(): Promise<DoctorReport> {
  const checks = await diagnoseRenderEnv();
  return { checks, canRender: checks.every((c) => c.ok) };
}

/** Render the report for a terminal. Returns the text so tests can assert it. */
export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(`glam doctor — ${INSTALL_LABEL[installKind()]}`);
  lines.push('');

  for (const check of report.checks) {
    lines.push(`${check.ok ? '  ok  ' : ' FAIL '} ${check.name}`);
    lines.push(`         ${check.detail}`);
  }

  lines.push('');
  if (report.canRender) {
    lines.push('`glam render` is ready. The full self-verify loop (validate + render) will run.');
  } else {
    lines.push('`glam render` cannot run yet. `new`, `validate` and `preview` still work.');
    lines.push('');
    lines.push('Fix, in order:');
    for (const check of report.checks) {
      if (!check.ok && check.fix) lines.push(`  ${check.fix}`);
    }
  }

  return lines.join('\n');
}
