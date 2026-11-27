// The whole compile/run pipeline lives in this worker so the UI stays alive.
import { compileProject } from './compiler.js';
import { runModule } from './runtime.js';
import { pushStdin, resetEvents } from './shared.js';

const send = (msg) => self.postMessage(msg);

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type !== 'run') return;
  const { files, eventSab, stdinSab, initialStdin, quality, sanitize } = msg;
  const t0 = performance.now();
  try {
    resetEvents(eventSab);
    if (initialStdin) pushStdin(stdinSab, initialStdin);
    const { module, error } = await compileProject(files, (text) => send({ type: 'status', text }), { quality, sanitize });
    if (!module) {
      send({ type: 'compileError', text: error });
      return;
    }
    send({ type: 'running' });
    const result = await runModule(module, {
      eventSab,
      stdinSab,
      onDraw: (cmd) => send({ type: 'draw', cmd }),
      onStdout: (text) => { if (text) send({ type: 'stdout', text }); },
      onStderr: (text) => { if (text) send({ type: 'stderr', text }); },
    });
    send({ type: 'done', ms: Math.round(performance.now() - t0), result });
  } catch (err) {
    const text = (err && err.message) ? err.message : String(err);
    if (/unreachable|out of bounds|undefined element|function signature/i.test(text)) {
      send({ type: 'runtimeError', text: 'Runtime error: ' + text });
    } else {
      send({ type: 'runtimeError', text });
    }
  }
};
