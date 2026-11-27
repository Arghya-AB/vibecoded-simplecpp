// WASI + the `env` imports used by the ported simplecpp headers.
// stdout/stderr go to the console panel, stdin comes from a shared ring, and
// all drawing is posted to the main thread as canvas commands.
import { WASI, File, OpenFile, ConsoleStdout, PreopenDirectory } from '@bjorn3/browser_wasi_shim';
import { EVT_HEADER, EVT_STRIDE, STD_HEADER, STD_CAP } from './shared.js';

const COLOR_NAMES = {
  black: 0x000000, white: 0xffffff, red: 0xff0000, green: 0x008000, lime: 0x00ff00,
  blue: 0x0000ff, yellow: 0xffff00, cyan: 0x00ffff, aqua: 0x00ffff, magenta: 0xff00ff,
  fuchsia: 0xff00ff, orange: 0xffa500, purple: 0x800080, pink: 0xffc0cb, brown: 0xa52a2a,
  gray: 0x808080, grey: 0x808080, silver: 0xc0c0c0, gold: 0xffd700, navy: 0x000080,
  teal: 0x008080, olive: 0x808000, maroon: 0x800000, violet: 0xee82ee, indigo: 0x4b0082,
  turquoise: 0x40e0d0, skyblue: 0x87ceeb, lightblue: 0xadd8e6, darkblue: 0x00008b,
  lightgray: 0xd3d3d3, darkgray: 0xa9a9a9, transparent: 0xffffff,
};

function colorFromName(name) {
  const key = String(name).trim().toLowerCase();
  if (COLOR_NAMES[key] !== undefined) return COLOR_NAMES[key];
  if (key[0] === '#') {
    const h = key.slice(1);
    if (h.length === 3) return parseInt(h.split('').map(c => c + c).join(''), 16) || 0;
    return parseInt(h.slice(0, 6), 16) || 0;
  }
  const rgb = key.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb) return (Number(rgb[1]) << 16) | (Number(rgb[2]) << 8) | Number(rgb[3]);
  // Deterministic colour for any other X11-ish name.
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return h;
}

function sleepSignal(sab, ms) {
  if (!sab) {
    const end = performance.now() + ms;
    while (performance.now() < end) { /* no SAB: cooperative fallback */ }
    return;
  }
  const i32 = new Int32Array(sab);
  const v = Atomics.load(i32, 2);
  Atomics.wait(i32, 2, v, Math.max(1, Math.min(ms, 100)));
}

class SharedStdin {
  constructor(sab) {
    this.sab = sab;
    this.file = new File(new Uint8Array(0));
    this.fd = new OpenFile(this.file);
    // `cin` is buffered by libc++ and reads through fd_read; supply bytes from
    // the main thread on demand, blocking cooperatively while waiting.
    this.fd.fd_read = (size) => {
      if (!sab) return { ret: 0, data: new Uint8Array(0) };
      const i32 = new Int32Array(sab);
      while (Atomics.load(i32, 0) === Atomics.load(i32, 1) && Atomics.load(i32, 3) === 0) {
        sleepSignal(sab, 20);
      }
      const w = Atomics.load(i32, 0);
      const r = Atomics.load(i32, 1);
      const n = Math.min(size, w - r);
      const bytes = new Uint8Array(sab, STD_HEADER * 4, STD_CAP);
      const data = new Uint8Array(n);
      for (let i = 0; i < n; i++) data[i] = bytes[(r + i) % STD_CAP];
      if (n) Atomics.store(i32, 1, r + n);
      return { ret: 0, data };
    };
  }
}

export async function runModule(module, opts) {
  const { eventSab, stdinSab, onDraw, onStdout, onStderr } = opts;
  const start = performance.now();
  let memory = null;

  const view = () => new DataView(memory.buffer);
  const readString = (ptr) => {
    if (!ptr) return '';
    const bytes = new Uint8Array(memory.buffer);
    let end = ptr;
    while (end < bytes.length && bytes[end] !== 0) end++;
    return new TextDecoder().decode(bytes.subarray(ptr, end));
  };
  const putI32 = (ptr, value) => { if (ptr) view().setInt32(ptr, value | 0, true); };

  const evI32 = eventSab ? new Int32Array(eventSab) : null;
  const evBytes = eventSab ? new Uint8Array(eventSab) : null;
  function popEvent(type, x, y, keycode, state, button, ch) {
    if (!evI32) return 0;
    const r = Atomics.load(evI32, 1);
    const w = Atomics.load(evI32, 0);
    if (r >= w) return 0;
    const base = EVT_HEADER + (r % 64) * EVT_STRIDE;
    putI32(type, evI32[base + 0]);
    putI32(x, evI32[base + 1]);
    putI32(y, evI32[base + 2]);
    putI32(keycode, evI32[base + 3]);
    putI32(state, evI32[base + 4]);
    putI32(button, evI32[base + 5]);
    if (ch) {
      const bytes = new Uint8Array(memory.buffer);
      for (let i = 0; i < 4; i++) bytes[ch + i] = evBytes[base * 4 + 24 + i];
    }
    Atomics.store(evI32, 1, r + 1);
    return 1;
  }
  const noEvent = (t, x, y, k, s, b, c) => {
    let n = 0;
    while (n++ < 2000 && evI32 && Atomics.load(evI32, 1) >= Atomics.load(evI32, 0)) {
      sleepSignal(eventSab, 5);
    }
    return popEvent(t, x, y, k, s, b, c);
  };

  // UBSan (the "Sanitize" switch) calls into JS with compiler-generated
  // metadata.  SourceLocation is { filename*, line, column }; the type name,
  // when present, follows in the TypeDescriptor at data+12.
  function ubsanLocation(dataPtr) {
    const dv = view();
    const file = readString(dv.getUint32(dataPtr, true));
    const line = dv.getUint32(dataPtr + 4, true);
    const col = dv.getUint32(dataPtr + 8, true);
    return `${file || '<unknown>'}:${line}:${col}`;
  }
  function ubsanError(what, dataPtr) {
    throw new Error(`Undefined behaviour: ${what} at ${ubsanLocation(dataPtr)}`);
  }

  const env = {
    sc_initCanvas: (titlePtr, w, h) => {
      onDraw({ op: 'init', title: readString(titlePtr), w, h });
      return 0;
    },
    sc_closeCanvas: () => onDraw({ op: 'close' }),
    sc_canvasWidth: () => env._w || 500,
    sc_canvasHeight: () => env._h || 500,
    sc_setTarget: (t) => onDraw({ op: 'target', target: t }),
    sc_clearTarget: () => onDraw({ op: 'clear' }),
    sc_beginRepaint: () => onDraw({ op: 'beginRepaint' }),
    sc_endRepaint: () => onDraw({ op: 'present' }),
    sc_drawLine: (x1, y1, x2, y2, color, width) =>
      onDraw({ op: 'line', x1, y1, x2, y2, color, width }),
    sc_drawPoint: (x, y, color) => onDraw({ op: 'point', x, y, color }),
    sc_drawCircle: (cx, cy, r, color, fill, width) =>
      onDraw({ op: 'circle', cx, cy, r, color, fill: !!fill, width }),
    sc_drawEllipse: (cx, cy, w, h, color, fill, width) =>
      onDraw({ op: 'ellipse', cx, cy, w, h, color, fill: !!fill, width }),
    sc_drawPolygon: (ptr, n, color, fill, width) => {
      const dv = view();
      const pts = [];
      for (let i = 0; i < n; i++) pts.push([dv.getFloat64(ptr + i * 16, true), dv.getFloat64(ptr + i * 16 + 8, true)]);
      onDraw({ op: 'polygon', pts, color, fill: !!fill, width });
    },
    sc_drawText: (x, y, textPtr, color) =>
      onDraw({ op: 'text', x, y, text: readString(textPtr), color }),
    sc_textWidth: (textPtr) => readString(textPtr).length * 12,
    sc_textHeight: () => 28,
    sc_textDescent: () => 6,
    sc_colorName: (namePtr) => colorFromName(readString(namePtr)),
    sc_colorRGB: (r, g, b) => ((r & 255) << 16) | ((g & 255) << 8) | (b & 255),
    sc_now: () => performance.now() - start,
    sc_sleepMs: (ms) => sleepSignal(eventSab, ms),
    sc_nextEvent: (t, x, y, k, s, b, c) => noEvent(t, x, y, k, s, b, c),
    sc_checkEvent: (t, x, y, k, s, b, c) => popEvent(t, x, y, k, s, b, c),
    sc_discardEvents: () => { if (evI32) Atomics.store(evI32, 1, Atomics.load(evI32, 0)); },
    sc_echoKey: (x, y, textPtr, color) =>
      onDraw({ op: 'text', x, y, text: readString(textPtr), color }),
    sc_spriteStatus: (count) => onStderr('[sprite count: ' + count + ']\n'),
    sc_abort: () => { throw new Error('Program aborted.'); },
    __ubsan_handle_type_mismatch_v1_abort: (dataPtr) => {
      const dv = view();
      const typePtr = dv.getUint32(dataPtr + 12, true);
      const typeName = typePtr ? readString(typePtr + 4) : '';
      const suffix = typeName ? ' of type ' + typeName : '';
      const check = (dv.getUint32(dataPtr + 16, true) >>> 8) & 255;
      if (check === 0) ubsanError('null pointer dereference' + suffix, dataPtr);
      if (check === 4) ubsanError('misaligned pointer access' + suffix, dataPtr);
      ubsanError('invalid pointer access' + suffix, dataPtr);
    },
    __ubsan_handle_alignment_assumption_abort: (dataPtr) =>
      ubsanError('invalid alignment assumption', dataPtr),
    __ubsan_handle_missing_return: (dataPtr) =>
      ubsanError('control reached the end of a non-void function', dataPtr),
    __ubsan_handle_divrem_overflow_abort: (dataPtr) =>
      ubsanError('floating-point division by zero', dataPtr),
    _w: 0,
    _h: 0,
  };
  // Remember canvas size for the initCanvas(-1) case (whole-window size).
  const origInit = env.sc_initCanvas;
  env.sc_initCanvas = (titlePtr, w, h) => {
    if (w === -1) { w = 640; h = 480; }
    env._w = w; env._h = h;
    return origInit(titlePtr, w, h);
  };

  const stdin = new SharedStdin(stdinSab);
  const dec = (push) => {
    const td = new TextDecoder();
    return (bytes) => push(td.decode(bytes, { stream: true }));
  };
  // An in-memory scratch directory gives <fstream>, FILE* and friends a
  // real place to create/read files.  It lives only for this run, so a
  // student's program cannot touch the host filesystem.
  const scratch = new Map();
  const fds = [
    stdin.fd,
    new ConsoleStdout(dec(onStdout)),
    new ConsoleStdout(dec(onStderr)),
    new PreopenDirectory('.', scratch),
  ];
  const wasi = new WASI([], [], fds, { debug: false });
  // Sanitizer builds can reference checks we did not expect.  Rather than
  // failing at instantiation with a missing-import error, give any unknown
  // sanitizer handler a JS implementation that reports a real diagnostic.
  const envImports = new Proxy(env, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      if (typeof prop === 'string' && /^__(ubsan|asan|lsan|msan|tsan)_/.test(prop)) {
        return (dataPtr) => ubsanError('sanitizer check failed (' + prop + ')', dataPtr || 0);
      }
      return undefined;
    },
  });
  const instance = await WebAssembly.instantiate(module, {
    env: envImports,
    wasi_snapshot_preview1: wasi.wasiImport,
  });
  memory = instance.exports.memory;
  wasi.start(instance);
  return { exitCode: 0, ms: performance.now() - start };
}
