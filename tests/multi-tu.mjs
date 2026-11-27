// Verifies separate translation units: an unguarded header included by two
// .cpp files must compile, just as it would with a normal C++ compiler.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Clang, LLD, setUpSysroot } from 'browsercc';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('file:')) {
    try { return new Response(await fs.readFile(new URL(url)), { status: 200 }); }
    catch { return new Response(null, { status: 404 }); }
  }
  return originalFetch(input, init);
};
const dist = pathToFileURL(path.join(root, 'node_modules/browsercc/dist') + '/').href;
const libdir = path.join(root, 'simplecpp');
const extraFiles = {};
for (const f of await fs.readdir(libdir)) extraFiles['/lib/simplecpp/' + f] = await fs.readFile(path.join(libdir, f), 'utf8');
const sysroot = await (await fetch(dist + 'sysroot.tar')).arrayBuffer();
const pch = await fs.readFile(path.join(root, 'public/toolchain/simplecpp.pch'));
const prelude = [
  '#include <algorithm>', '#include <cmath>', '#include <cstdio>', '#include <cstdlib>',
  '#include <cstring>', '#include <functional>', '#include <iostream>', '#include <limits>',
  '#include <map>', '#include <memory>', '#include <queue>', '#include <set>',
  '#include <sstream>', '#include <string>', '#include <utility>', '#include <vector>',
  '#include <simplecpp>',
].join('\n') + '\n';

let err = '';
const lld = await LLD({ thisProgram: 'wasm-ld', printErr: d => { err += d + '\n'; } });
setUpSysroot(lld, sysroot, extraFiles);
const projectFiles = {
  '/project/fractals.h': `namespace fract { void hello(); }\n`,
  '/project/main.cpp': `#include <simplecpp>\n#include "fractals.h"\nint main(){ fract::hello(); cout << "ok" << endl; return 0; }\n`,
  '/project/fractals.cpp': `#include <simplecpp>\n#include "fractals.h"\nvoid fract::hello() {}\n`,
};
async function setupClang() {
  const clang = await Clang({ thisProgram: 'clang++', printErr: d => { err += d + '\n'; } });
  setUpSysroot(clang, sysroot, extraFiles);
  clang.FS.writeFile('/prelude.h', prelude);
  clang.FS.writeFile('/simplecpp.pch', new Uint8Array(pch));
  clang.FS.mkdirTree('/project');
  for (const [name, content] of Object.entries(projectFiles)) clang.FS.writeFile(name, content);
  return clang;
}

const inc = ['-internal-isystem', '/include/wasm32-wasi/c++/v1', '-internal-isystem', '/include/c++/v1',
  '-internal-isystem', 'lib/clang/20/include', '-internal-isystem', '/include/wasm32-wasi',
  '-internal-isystem', '/include'];
const base = ['-cc1', '-triple', 'wasm32-unknown-wasi', '-emit-obj', '-mrelocation-model', 'static',
  '-mframe-pointer=none', '-ffp-contract=on', '-fno-rounding-math', '-mconstructor-aliases',
  '-target-cpu', 'generic', '-fvisibility=hidden', '-debugger-tuning=gdb', '-fdebug-compilation-dir=/',
  '-fcoverage-compilation-dir=/', '-resource-dir', 'lib/clang/20', '-I', '/lib/simplecpp', '-I', '/project',
  '-include-pch', '/simplecpp.pch', ...inc, '-O0', '-std=c++20', '-w', '-fdeprecated-macro',
  '-ferror-limit', '19', '-fgnuc-version=4.2.1', '-fno-implicit-modules', '-fskip-odr-check-in-gmf'];
const objects = [];
let ok = true;
for (const [i, name] of ['main.cpp', 'fractals.cpp'].entries()) {
  const clang = await setupClang();
  const out = `/tmp/tu${i}.o`;
  const rc = clang.callMain([...base, '-o', out, '-x', 'c++', `/project/${name}`]);
  console.log(name, 'rc', rc);
  if (rc !== 0) ok = false;
  else { objects.push(out); lld.FS.writeFile(out, clang.FS.readFile(out, { encoding: 'binary' })); }
}
if (ok) {
  const lrc = lld.callMain(['-m', 'wasm32', '-Llib/clang/20/lib/wasm32-unknown-wasi', '-L/lib/wasm32-wasi',
    '/lib/wasm32-wasi/crt1-command.o', ...objects, '--allow-undefined', '-lc++', '-lc++abi', '-lc',
    'lib/clang/20/lib/wasm32-unknown-wasi/libclang_rt.builtins.a', '-o', 'a.out']);
  console.log('link rc', lrc);
  if (lrc === 0) {
    const mod = await WebAssembly.compile(lld.FS.readFile('a.out', { encoding: 'binary' }));
    console.log('module?', !!mod);
  } else ok = false;
}
if (err.trim()) console.log('compiler diagnostics:', err.trim().slice(0, 500));
console.log(ok ? 'MULTI-TU PASS' : 'MULTI-TU FAIL');
process.exit(ok ? 0 : 1);
