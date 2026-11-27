// Layouts of the two (optional) SharedArrayBuffers used for input.
// Event ring: [write, read, wake, reserved] followed by 64 slots of 16 int32s.
export const EVT_CAP = 64;
export const EVT_STRIDE = 16;
export const EVT_HEADER = 4;
export const EVT_BYTES = (EVT_HEADER + EVT_CAP * EVT_STRIDE) * 4;

// Stdin ring: [write, read, wake, closed] followed by STD_CAP bytes.
export const STD_CAP = 16384;
export const STD_HEADER = 4;
export const STD_BYTES = STD_HEADER * 4 + STD_CAP;

export const EventType = {
  KeyPress: 2,
  ButtonPress: 4,
  ButtonRelease: 5,
  MotionNotify: 6,
};

export function makeEventBuffer() {
  if (typeof SharedArrayBuffer === 'undefined') return null;
  return new SharedArrayBuffer(EVT_BYTES);
}

export function makeStdinBuffer() {
  if (typeof SharedArrayBuffer === 'undefined') return null;
  return new SharedArrayBuffer(STD_BYTES);
}

export function resetEvents(sab) {
  if (!sab) return;
  const i32 = new Int32Array(sab);
  Atomics.store(i32, 1, Atomics.load(i32, 0));
}

export function pushEvent(sab, type, x, y, keycode = 0, state = 0, button = 0, chars = '') {
  if (!sab) return;
  const i32 = new Int32Array(sab);
  const w = Atomics.load(i32, 0);
  const base = EVT_HEADER + (w % EVT_CAP) * EVT_STRIDE;
  i32[base + 0] = type;
  i32[base + 1] = x | 0;
  i32[base + 2] = y | 0;
  i32[base + 3] = keycode | 0;
  i32[base + 4] = state | 0;
  i32[base + 5] = button | 0;
  const bytes = new Uint8Array(sab);
  for (let i = 0; i < 4; i++) bytes[base * 4 + 24 + i] = chars.charCodeAt(i) & 0xff;
  Atomics.store(i32, 0, w + 1);
  Atomics.add(i32, 2, 1);
  Atomics.notify(i32, 2);
}

export function pushStdin(sab, text) {
  if (!sab) return 0;
  const data = new TextEncoder().encode(text);
  const i32 = new Int32Array(sab);
  const bytes = new Uint8Array(sab, STD_HEADER * 4, STD_CAP);
  const w = Atomics.load(i32, 0);
  let n = 0;
  while (n < data.length && n < STD_CAP) bytes[(w + n) % STD_CAP] = data[n++];
  if (n) {
    Atomics.store(i32, 0, w + n);
    Atomics.add(i32, 2, 1);
    Atomics.notify(i32, 2);
  }
  return n;
}

export function closeStdin(sab) {
  if (!sab) return;
  Atomics.store(new Int32Array(sab), 3, 1);
  Atomics.add(new Int32Array(sab), 2, 1);
  Atomics.notify(new Int32Array(sab), 2);
}
