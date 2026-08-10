import { parseArgs } from 'node:util';
import { EXIT_MISSING_RENDER_DEP, GlamRenderEnvError } from '@glamour-labs/player/node';
import { newCommand } from './commands/new.js';
import { validateCommand } from './commands/validate.js';
import { renderCommand } from './commands/render.js';
import { previewCommand } from './commands/preview.js';
import { doctorCommand, formatDoctorReport } from './commands/doctor.js';

function usage(): void {
  console.error('Usage: glam <new|validate|render|preview|doctor> [args]');
  console.error('  glam new [path]                         write a starter .glam');
  console.error('  glam validate <file>                    validate a .glam, exit 0/1');
  console.error('  glam render <file> -o <out.png> [--state name]');
  console.error('  glam preview <file>                     serve a live preview');
  console.error('  glam doctor                             check whether render can run');
  console.error('');
  console.error('Exit codes: 0 ok · 1 failed · 3 a render prerequisite is missing (run `glam doctor`)');
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  switch (command) {
    case 'new': {
      const target = rest[0] ?? 'scene.glam';
      const written = newCommand(target);
      console.log(written);
      return;
    }

    case 'validate': {
      const file = rest[0];
      if (!file) {
        usage();
        process.exitCode = 1;
        return;
      }
      const result = validateCommand(file);
      if (result.ok) {
        console.log('ok');
      } else {
        for (const err of result.errors) console.error(err);
        process.exitCode = 1;
      }
      return;
    }

    case 'render': {
      const { values, positionals } = parseArgs({
        args: rest,
        options: {
          output: { type: 'string', short: 'o' },
          state: { type: 'string' },
        },
        allowPositionals: true,
      });
      const file = positionals[0];
      const output = values.output;
      if (!file || !output) {
        console.error('Usage: glam render <file> -o <out.png> [--state name]');
        process.exitCode = 1;
        return;
      }
      await renderCommand(file, output, { state: values.state });
      console.log(output);
      return;
    }

    case 'preview': {
      const file = rest[0];
      if (!file) {
        usage();
        process.exitCode = 1;
        return;
      }
      const handle = await previewCommand(file);
      console.log(handle.url);
      // Long-running: intentionally do not close — the process stays up
      // serving the preview until the user kills it (Ctrl-C).
      return;
    }

    case 'doctor': {
      const report = await doctorCommand();
      console.log(formatDoctorReport(report));
      if (!report.canRender) process.exitCode = EXIT_MISSING_RENDER_DEP;
      return;
    }

    default:
      usage();
      process.exitCode = 1;
  }
}

main(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  // A missing browser/bundle is an environment problem, not a bad document, and
  // gets its own exit code so a caller — usually the cast-glamour self-verify
  // loop — can tell "install something" apart from "fix the .glam" without
  // parsing prose.
  if (err instanceof GlamRenderEnvError) {
    console.error('');
    console.error('Run `glam doctor` for the full prerequisite check.');
    process.exitCode = err.exitCode;
    return;
  }
  process.exitCode = 1;
});
