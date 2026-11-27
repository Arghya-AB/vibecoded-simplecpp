import { EditorView, basicSetup } from 'codemirror';
import { indentLess, indentMore } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { keymap } from '@codemirror/view';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';
import './styles.css';
import { defaultFiles, EXAMPLES } from './examples.js';
import { makeEventBuffer, makeStdinBuffer, pushEvent, pushStdin, resetEvents, resetStdin, EventType } from './shared.js';

const $ = (id) => document.getElementById(id);
let files = defaultFiles();
let active = 0;
let bgCanvas, frameCanvas, ctxBg, ctxFrame, targetCtx;
let bestFrame, ctxBest; // Most complete frame, restored after main() destroys local sprites.
let bestScore = -1;
let scoreCanvas, ctxScore; // Tiny copy used to score how much ink a frame has.
let lastX = 0, lastY = 0;
let running = false;
const eventSab = makeEventBuffer();
const stdinSab = makeStdinBuffer();

/* ---------------- editor ---------------- */
const insertFourSpaces = (view) => {
  if (view.state.readOnly) return false;
  if (view.state.selection.ranges.some(range => !range.empty)) return indentMore(view);
  view.dispatch(view.state.replaceSelection('    '));
  return true;
};

const view = new EditorView({
  doc: files[active].content,
  extensions: [
    keymap.of([{ key: 'Tab', run: insertFourSpaces, shift: indentLess }]),
    basicSetup, cpp(), indentUnit.of('    '), oneDark,
    EditorView.updateListener.of(u => {
      if (u.docChanged) files[active].content = u.state.doc.toString();
    }),
    EditorView.theme({ '&': { fontSize: '13px' }, '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } }),
  ],
  parent: $('editor'),
});

function renderTabs() {
  const box = $('file-tabs');
  box.innerHTML = '';
  files.forEach((f, i) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (i === active ? ' active' : '');
    const name = document.createElement('span');
    name.textContent = f.name;
    name.onclick = () => selectFile(i);
    tab.appendChild(name);
    const close = document.createElement('button');
    close.className = 'tab-close';
    close.textContent = '×';
    close.title = 'Close file';
    close.onclick = (e) => { e.stopPropagation(); removeFile(i); };
    tab.appendChild(close);
    box.appendChild(tab);
  });
}

function selectFile(i) {
  files[active].content = view.state.doc.toString();
  active = Math.max(0, Math.min(i, files.length - 1));
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: files[active].content } });
  renderTabs();
  view.focus();
}

function removeFile(i) {
  if (files.length === 1) return;
  files.splice(i, 1);
  if (active >= files.length) active = files.length - 1;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: files[active].content } });
  renderTabs();
}

$('new-file').onclick = () => {
  const name = prompt('New file name (e.g. utils.cpp or utils.h):', 'new.cpp');
  if (!name) return;
  if (files.some(f => f.name === name)) { alert('That file already exists.'); return; }
  files[active].content = view.state.doc.toString();
  files.push({ name, content: '' });
  active = files.length - 1;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
  renderTabs();
  view.focus();
};

const select = $('example-select');
for (const name of Object.keys(EXAMPLES)) {
  const opt = document.createElement('option');
  opt.value = opt.textContent = name;
  select.appendChild(opt);
}
select.onchange = () => {
  files = EXAMPLES[select.value].map(f => ({ ...f }));
  active = 0;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: files[0].content } });
  renderTabs();
  clearAll();
};
renderTabs();

/* ---------------- resizable panels ---------------- */
function installSplitter(handle, container, cssVar, axis, minFirst, minSecond, defaultValue, onResize) {
  const horizontalDrag = axis === 'x';
  const containerSize = () => horizontalDrag ? container.clientWidth : container.clientHeight;
  const handleSize = () => horizontalDrag ? handle.offsetWidth : handle.offsetHeight;
  const pointerRatio = (event) => {
    const rect = container.getBoundingClientRect();
    return horizontalDrag
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height;
  };
  const currentRatio = () => parseFloat(container.style.getPropertyValue(cssVar)) / 100 || defaultValue;

  function setRatio(ratio) {
    const usable = Math.max(1, containerSize() - handleSize());
    const min = Math.min(0.5, minFirst / usable);
    const max = Math.max(min, 1 - minSecond / usable);
    const clamped = Math.max(min, Math.min(max, ratio));
    container.style.setProperty(cssVar, `${(clamped * 100).toFixed(3)}%`);
    handle.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    if (onResize) onResize();
  }

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    handle.classList.add('dragging');
    document.body.classList.add('resizing');
    document.body.style.cursor = horizontalDrag ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const move = (e) => setRatio(pointerRatio(e));
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      handle.classList.remove('dragging');
      document.body.classList.remove('resizing');
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });

  handle.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    let ratio = currentRatio();
    if (event.key === 'Home') ratio = defaultValue;
    else if (horizontalDrag && event.key === 'ArrowLeft') ratio -= step;
    else if (horizontalDrag && event.key === 'ArrowRight') ratio += step;
    else if (!horizontalDrag && event.key === 'ArrowUp') ratio -= step;
    else if (!horizontalDrag && event.key === 'ArrowDown') ratio += step;
    else return;
    event.preventDefault();
    setRatio(ratio);
  });

  handle.addEventListener('dblclick', (event) => {
    event.preventDefault();
    setRatio(defaultValue);
  });

  return { refresh: () => setRatio(currentRatio()) };
}

const mainSplitter = installSplitter($('main-splitter'), $('app').querySelector('main'),
  '--editor-width', 'x', 260, 260, 0.5, () => view.requestMeasure());
const outputSplitter = installSplitter($('output-splitter'), $('output-pane'),
  '--graphics-height', 'y', 140, 120, 0.55);
window.addEventListener('resize', () => { mainSplitter.refresh(); outputSplitter.refresh(); });

/* ---------------- formatter ---------------- */
// Real clang-format, compiled to WebAssembly. Loaded on first use so it never
// delays startup. The style is a plain, forgiving default (2 spaces, no tabs).
const FORMAT_STYLE = '{BasedOnStyle: LLVM, IndentWidth: 2, UseTab: Never}';
let formatterPromise;
function getFormatter() {
  return (formatterPromise ??= import('@wasm-fmt/clang-format/vite')
    .then(async (m) => { await m.default(); return m.format; })
    .catch((e) => { formatterPromise = null; throw e; }));
}

async function formatActiveFile() {
  files[active].content = view.state.doc.toString();
  setStatus('Formatting…', 'busy');
  try {
    const format = await getFormatter();
    const name = files[active].name;
    const filename = /\.(h|hpp|hh|hxx)$/i.test(name) ? 'main.h' : 'main.cpp';
    const formatted = format(files[active].content, filename, FORMAT_STYLE);
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: formatted },
      selection: { anchor: Math.min(from, formatted.length), head: Math.min(to, formatted.length) },
    });
    files[active].content = formatted;
    setStatus(`Formatted ${name}.`);
  } catch (err) {
    setStatus('Format failed: ' + ((err && err.message) || err), 'error');
  }
}
$('format').onclick = formatActiveFile;

/* ---------------- download ---------------- */
function downloadActiveFile() {
  files[active].content = view.state.doc.toString();
  const name = files[active].name;
  const url = URL.createObjectURL(new Blob([files[active].content], {
    type: 'text/plain;charset=utf-8',
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus(`Downloaded ${name}.`);
}
$('download').onclick = downloadActiveFile;

/* ---------------- console ---------------- */
// stdout, stderr and the user's stdin all share one terminal-like stream.
const panels = { terminal: $('terminal'), errors: $('errors') };
const termLog = $('term-log');
const termInput = $('term-input');
let pointerOverCanvas = false;

function resizeTermInput() {
  termInput.style.height = 'auto';
  termInput.style.height = Math.min(termInput.scrollHeight, 140) + 'px';
}
function showPanel(name) {
  document.querySelectorAll('#console-tabs button').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
  Object.entries(panels).forEach(([k, el]) => el.classList.toggle('active', k === name));
  // If the pointer is already over the graphics window, keep keys going to the
  // canvas instead of stealing focus for the terminal input.
  if (name === 'terminal') (running && pointerOverCanvas ? $('canvas') : termInput).focus();
}
document.querySelectorAll('#console-tabs button').forEach(b => b.onclick = () => showPanel(b.dataset.panel));

function append(kind, text) {
  if (!text) return;
  if (kind === 'errors') {
    panels.errors.textContent += text;
    if (text.trim()) showPanel('errors');
    return;
  }
  const line = document.createElement('span');
  if (kind === 'echo') line.className = 'term-echo';
  else if (kind === 'stderr') line.className = 'term-stderr';
  line.textContent = text;
  termLog.appendChild(line);
  termLog.scrollTop = termLog.scrollHeight;
}
function clearConsole() {
  termLog.textContent = '';
  panels.errors.textContent = '';
}
function clearAll() {
  clearConsole();
  resetCanvas();
}
$('clear-console').onclick = clearConsole;
$('clear').onclick = clearAll;

function setStatus(text, cls = '') {
  $('status').textContent = text;
  $('status').className = cls;
}

/* ---------------- graphics ---------------- */
const canvas = $('canvas');
const visibleCtx = canvas.getContext('2d');
const css = (color) => '#' + (Number(color) >>> 0).toString(16).padStart(6, '0');

function resetCanvas() {
  visibleCtx.fillStyle = '#fff';
  visibleCtx.fillRect(0, 0, canvas.width, canvas.height);
  ctxBg = ctxFrame = targetCtx = null;
  bgCanvas = frameCanvas = null;
  bestFrame = ctxBest = null;
  bestScore = -1;
  scoreCanvas = ctxScore = null;
  $('canvas-title').textContent = '';
}

function makeLayer(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  return [c, ctx];
}

function inkScore(canvasSource) {
  if (!ctxScore) {
    scoreCanvas = document.createElement('canvas');
    scoreCanvas.width = scoreCanvas.height = 64;
    ctxScore = scoreCanvas.getContext('2d', { willReadFrequently: true });
  }
  ctxScore.clearRect(0, 0, 64, 64);
  ctxScore.drawImage(canvasSource, 0, 0, 64, 64);
  const d = ctxScore.getImageData(0, 0, 64, 64).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4)
    if (d[i + 3] > 0 && (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250)) n++;
  return n;
}

function paint(cmd) {
  const ctx = targetCtx || visibleCtx;
  const color = css(cmd.color ?? 0);
  switch (cmd.op) {
    case 'init': {
      canvas.width = cmd.w; canvas.height = cmd.h;
      [bgCanvas, ctxBg] = makeLayer(cmd.w, cmd.h);
      [frameCanvas, ctxFrame] = makeLayer(cmd.w, cmd.h);
      [bestFrame, ctxBest] = makeLayer(cmd.w, cmd.h);
      scoreCanvas = ctxScore = null;
      targetCtx = ctxFrame;
      $('canvas-title').textContent = cmd.title || '';
      visibleCtx.fillStyle = '#fff';
      visibleCtx.fillRect(0, 0, cmd.w, cmd.h);
      break;
    }
    case 'close': resetCanvas(); break;
    case 'target': targetCtx = cmd.target === 1 ? ctxBg : ctxFrame; break;
    case 'clear':
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      break;
    case 'beginRepaint':
      ctxFrame.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
      ctxFrame.drawImage(bgCanvas, 0, 0);
      targetCtx = ctxFrame;
      break;
    case 'present':
      visibleCtx.clearRect(0, 0, canvas.width, canvas.height);
      visibleCtx.drawImage(frameCanvas, 0, 0);
      // Local sprites are destroyed as main() returns, causing a final frame
      // that can be emptier (or fuller, thanks to imprints) than earlier ones.
      // Keep whichever presented frame contained the most drawing.
      {
        const score = inkScore(frameCanvas);
        if (score > bestScore) {
          bestScore = score;
          ctxBest.clearRect(0, 0, bestFrame.width, bestFrame.height);
          ctxBest.drawImage(frameCanvas, 0, 0);
        }
      }
      break;
    case 'line':
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, cmd.width || 2);
      ctx.beginPath(); ctx.moveTo(cmd.x1, cmd.y1); ctx.lineTo(cmd.x2, cmd.y2); ctx.stroke();
      break;
    case 'point':
      ctx.fillStyle = color;
      ctx.fillRect(cmd.x - 1, cmd.y - 1, 3, 3);
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(cmd.cx, cmd.cy, Math.max(0.5, cmd.r), 0, Math.PI * 2);
      if (cmd.fill) { ctx.fillStyle = color; ctx.fill(); }
      else { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, cmd.width || 1); ctx.stroke(); }
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(cmd.cx, cmd.cy, Math.max(0.5, cmd.w / 2), Math.max(0.5, cmd.h / 2), 0, 0, Math.PI * 2);
      if (cmd.fill) { ctx.fillStyle = color; ctx.fill(); }
      else { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, cmd.width || 1); ctx.stroke(); }
      break;
    case 'polygon':
      if (!cmd.pts.length) break;
      ctx.beginPath();
      ctx.moveTo(cmd.pts[0][0], cmd.pts[0][1]);
      for (let i = 1; i < cmd.pts.length; i++) ctx.lineTo(cmd.pts[i][0], cmd.pts[i][1]);
      ctx.closePath();
      if (cmd.fill) { ctx.fillStyle = color; ctx.fill(); }
      else { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, cmd.width || 2); ctx.stroke(); }
      break;
    case 'text':
      ctx.fillStyle = color;
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(cmd.text, cmd.x, cmd.y + 8);
      break;
  }
}

// main() destroys local sprites on return, triggering a final empty repaint.
// Restore the fullest frame that was displayed so the drawing stays visible.
function restoreBestFrame() {
  if (!bestFrame) return;
  visibleCtx.clearRect(0, 0, canvas.width, canvas.height);
  visibleCtx.drawImage(bestFrame, 0, 0);
}

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return [Math.floor(e.offsetX * canvas.width / r.width),
          Math.floor(e.offsetY * canvas.height / r.height)];
}
canvas.addEventListener('mousedown', (e) => {
  [lastX, lastY] = pointerPos(e);
  pushEvent(eventSab, EventType.ButtonPress, lastX, lastY, 0, 1, e.button + 1, '');
  canvas.focus();
});
canvas.addEventListener('mouseup', (e) => {
  const [x, y] = pointerPos(e);
  pushEvent(eventSab, EventType.ButtonRelease, x, y, 0, 0, e.button + 1, '');
});
canvas.addEventListener('mousemove', (e) => {
  if (!e.buttons) return;
  [lastX, lastY] = pointerPos(e);
  pushEvent(eventSab, EventType.MotionNotify, lastX, lastY, 0, e.buttons, 0, '');
});
// After Run the terminal input is focused (so stdin is easy to type). Hovering
// the graphics window switches keyboard focus to the canvas, letting a plain
// keypress reach the program instead of being typed into the input box. Moving
// away hands focus back to the terminal.
canvas.addEventListener('mouseenter', () => {
  pointerOverCanvas = true;
  if (running) canvas.focus();
});
canvas.addEventListener('mouseleave', () => {
  pointerOverCanvas = false;
  if (document.activeElement === canvas && running &&
      panels.terminal.classList.contains('active')) termInput.focus();
});
canvas.addEventListener('keydown', (e) => {
  const ch = e.key.length === 1 ? e.key : '';
  pushEvent(eventSab, EventType.KeyPress, lastX, lastY, e.keyCode || ch.charCodeAt(0) || 0, 0, 0, ch);
  e.preventDefault();
});

/* ---------------- worker ---------------- */
function createWorker() {
  const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  w.onmessage = ({ data: msg }) => {
    switch (msg.type) {
      case 'status': setStatus(msg.text, 'busy'); break;
      case 'running': break;
      case 'draw': paint(msg.cmd); break;
      case 'stdout': append('stdout', msg.text); break;
      case 'stderr': append('stderr', msg.text); break;
      case 'compileError':
      case 'runtimeError':
        restoreBestFrame();
        append('errors', msg.text + '\n');
        showPanel('errors');
        setStatus(msg.type === 'compileError' ? 'Compilation failed.' : 'Runtime error.', 'error');
        running = false;
        $('run').disabled = false;
        $('stop').disabled = true;
        break;
      case 'done':
        restoreBestFrame();
        setStatus(`Finished in ${msg.ms} ms (exit ${msg.result.exitCode}).`);
        running = false;
        $('run').disabled = false;
        $('stop').disabled = true;
        break;
    }
  };
  w.onerror = (e) => {
    append('errors', 'Worker error: ' + e.message + '\n');
    setStatus('Worker error.', 'error');
    running = false;
    $('run').disabled = false;
    $('stop').disabled = true;
  };
  return w;
}
let worker = createWorker();

function stop() {
  if (!running) return;
  // There is no safe way to interrupt a running WebAssembly call: terminating
  // the worker is the only reliable stop, so replace it with a fresh one.
  worker.terminate();
  worker = createWorker();
  running = false;
  $('run').disabled = false;
  $('stop').disabled = true;
  resetEvents(eventSab);
  resetStdin(stdinSab);
  restoreBestFrame();
  showPanel('terminal');
  setStatus('Stopped.');
}
$('stop').onclick = stop;

function run() {
  if (running) return;
  running = true;
  $('run').disabled = true;
  $('stop').disabled = false;
  files[active].content = view.state.doc.toString();
  clearAll();
  showPanel('terminal');
  const initial = termInput.value;
  termInput.value = '';
  resizeTermInput();
  setStatus('Starting…', 'busy');
  worker.postMessage({
    type: 'run',
    files: files.map(f => ({ name: f.name, content: f.content })),
    eventSab, stdinSab, initialStdin: initial ? (initial.endsWith('\n') ? initial : initial + '\n') : '',
    quality: $('build-mode').value === 'quality',
    sanitize: $('sanitize').checked,
  });
}
$('run').onclick = run;
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === 'Enter') { e.preventDefault(); run(); }
  else if (e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); formatActiveFile(); }
});

function sendStdin() {
  const value = termInput.value;
  if (!value) return;
  const text = value.endsWith('\n') ? value : value + '\n';
  pushStdin(stdinSab, text);
  append('echo', text);
  termInput.value = '';
  resizeTermInput();
}
$('term-send').onclick = sendStdin;
termInput.addEventListener('input', resizeTermInput);
// A pasted test case can contain newlines; the textarea keeps them verbatim.
termInput.addEventListener('paste', () => requestAnimationFrame(resizeTermInput));
termInput.addEventListener('keydown', (e) => {
  // Shift+Enter inserts a newline (default textarea behaviour) so a whole
  // multi-line test case can be composed before sending it with Enter.
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendStdin(); }
});

$('env-info').textContent = eventSab
  ? 'clang + lld in WebAssembly · stdin/events: shared'
  : 'clang + lld in WebAssembly · stdin/events: batch (serve with COOP/COEP for interactive input)';
resetCanvas();
