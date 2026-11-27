// Frontend-only C++ compiler.  Clang and LLD themselves are WebAssembly; no
// request ever leaves the browser.  Every .cpp file is compiled as its own
// translation unit (exactly like a normal C++ compiler) and the resulting
// objects are linked together.  Headers are written to the virtual filesystem
// so quoted and #include <simplecpp> includes resolve normally.
import { Clang, LLD, setUpSysroot } from 'browsercc';
import { PRELUDE } from './prelude.js';

const rawHeaders = import.meta.glob('../simplecpp/*', { query: '?raw', import: 'default', eager: true });
const libFiles = {};
for (const [key, value] of Object.entries(rawHeaders)) {
  libFiles['/lib/simplecpp/' + key.split('/').pop()] = value;
}

const url = (name) => new URL('../toolchain/' + name, import.meta.url).href;
let sysrootPromise;
const pchCache = new Map();
function sysroot() { return (sysrootPromise ??= fetch(url('sysroot.tar')).then(r => r.arrayBuffer())); }
function pch(name) {
  if (!pchCache.has(name)) pchCache.set(name, fetch(url(name)).then(r => r.arrayBuffer()));
  return pchCache.get(name);
}

const INCLUDE_PATHS = [
  '-internal-isystem', '/include/wasm32-wasi/c++/v1',
  '-internal-isystem', '/include/c++/v1',
  '-internal-isystem', 'lib/clang/20/include',
  '-internal-isystem', '/include/wasm32-wasi',
  '-internal-isystem', '/include',
];

const CC1_ARGS = [
  '-cc1', '-triple', 'wasm32-unknown-wasi', '-emit-obj',
  '-mrelocation-model', 'static', '-mframe-pointer=none', '-ffp-contract=on',
  '-fno-rounding-math', '-mconstructor-aliases', '-target-cpu', 'generic',
  '-fvisibility=hidden', '-debugger-tuning=gdb', '-fdebug-compilation-dir=/',
  '-fcoverage-compilation-dir=/', '-resource-dir', 'lib/clang/20',
  '-I', '/lib/simplecpp', '-I', '/project',
  '-include-pch', '/simplecpp.pch',
  ...INCLUDE_PATHS,
  '-std=c++20', '-w', '-fdeprecated-macro', '-ferror-limit', '19',
  '-fgnuc-version=4.2.1', '-fno-implicit-modules', '-fskip-odr-check-in-gmf',
];

// Checks chosen so their runtime handlers can be implemented in plain JS in
// src/runtime.js.  They catch the mistakes students hit most often (null
// dereferences, bad alignment, falling off a non-void function, /0.0) and
// report a file:line instead of silently producing a strange value.
const SANITIZE_ARGS = ['-fsanitize=null,alignment,return,float-divide-by-zero'];

const LINK_ARGS = (objects) => [
  '-m', 'wasm32',
  '-Llib/clang/20/lib/wasm32-unknown-wasi', '-L/lib/wasm32-wasi',
  '/lib/wasm32-wasi/crt1-command.o',
  ...objects,
  '--allow-undefined',
  '-lc++', '-lc++abi', '-lc',
  'lib/clang/20/lib/wasm32-unknown-wasi/libclang_rt.builtins.a',
  '-o', 'a.out',
];

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}

export async function compileProject(files, onStatus = () => {}, options = {}) {
  const quality = !!options.quality;
  const sanitize = !!options.sanitize;
  onStatus('Starting C++ compiler…');
  let lldErr = '';
  const [sysrootBytes, pchBytes] = await Promise.all([
    sysroot(), pch(quality ? 'simplecpp-ofast.pch' : 'simplecpp.pch'),
  ]);

  const lld = await LLD({
    thisProgram: 'wasm-ld',
    locateFile: (f) => url(f),
    printErr: (d) => { lldErr += d + '\n'; },
  });
  setUpSysroot(lld, sysrootBytes, libFiles);

  // Each translation unit gets a fresh Clang instance: browsercc's Emscripten
  // module cannot be safely reused for a second callMain().
  async function freshClang(collect) {
    const clang = await Clang({
      thisProgram: 'clang++',
      locateFile: (f) => url(f),
      printErr: collect,
    });
    setUpSysroot(clang, sysrootBytes, libFiles);
    clang.FS.writeFile('/simplecpp.pch', new Uint8Array(pchBytes));
    clang.FS.writeFile('/prelude.h', PRELUDE);
    clang.FS.mkdirTree('/project');
    // Quoted includes resolve against /project, so write all user files.
    for (const file of files) {
      const name = file.name.replace(/^\/+/, '');
      const parts = name.split('/');
      parts.pop();
      if (parts.length) clang.FS.mkdirTree('/project/' + parts.join('/'));
      clang.FS.writeFile('/project/' + name, file.content);
    }
    return clang;
  }

  const sources = files.filter(f => /\.(cpp|cc|cxx|c)$/i.test(f.name)).map(f => f.name.replace(/^\/+/, ''));
  if (!sources.length) {
    return { module: null, error: 'No C++ source file found. Add a .cpp file with main().' };
  }

  const objects = [];
  for (const [i, name] of sources.entries()) {
    onStatus(`Compiling ${name} (${i + 1}/${sources.length})…`);
    let fileErr = '';
    const clang = await freshClang(d => { fileErr += d + '\n'; });
    const objName = `/tmp/tu${i}.o`;
    const rc = clang.callMain([...CC1_ARGS, quality ? '-Ofast' : '-O0',
      ...(sanitize ? SANITIZE_ARGS : []),
      '-o', objName, '-x', 'c++', '/project/' + name]);
    if (rc !== 0) {
      const header = sources.length > 1 ? `=== ${name} ===\n` : '';
      return { module: null, error: header + stripAnsi(fileErr).trim() || 'Compilation failed.' };
    }
    objects.push({ name: objName, bytes: clang.FS.readFile(objName, { encoding: 'binary' }) });
  }

  onStatus('Linking…');
  for (const obj of objects) lld.FS.writeFile(obj.name, obj.bytes);
  const lrc = lld.callMain(LINK_ARGS(objects.map(o => o.name)));
  if (lrc !== 0) {
    return { module: null, error: stripAnsi(lldErr).trim() || 'Linking failed.' };
  }

  onStatus('Preparing WebAssembly module…');
  const bytes = lld.FS.readFile('a.out', { encoding: 'binary' });
  const module = await WebAssembly.compile(bytes);
  return { module, error: null };
}
