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
const O2 = process.argv.includes('--O2');
const pch = process.argv.includes('--pch');
const oflag = process.env.OFLAG || (O2 ? '-O2' : '-O0');
const extra = (process.env.EXTRA || '').split(/\s+/).filter(Boolean);
const src = process.env.SRC || '#include <simplecpp>\nint main(){ Turtle t; return 0; }';

const libdir = path.join(root, 'simplecpp');
const extraFiles = {};
for (const f of await fs.readdir(libdir)) extraFiles['/lib/simplecpp/' + f] = await fs.readFile(path.join(libdir, f), 'utf8');
const sysroot = await (await fetch(dist + 'sysroot.tar')).arrayBuffer();
let err = '';
const t0 = Date.now();
const clang = await Clang({ thisProgram: 'clang++', printErr: d => err += d + '\n' });
const lld = await LLD({ thisProgram: 'wasm-ld', printErr: d => err += d + '\n' });
setUpSysroot(clang, sysroot, extraFiles);
setUpSysroot(lld, sysroot, extraFiles);
if (pch) {
  clang.FS.writeFile('/simplecpp.pch', new Uint8Array(await fs.readFile(path.join(root, 'public/toolchain', process.env.OFLAG === '-Ofast' ? 'simplecpp-ofast.pch' : 'simplecpp.pch'))));
}
clang.FS.writeFile('/prelude.h', ['#include <algorithm>','#include <cmath>','#include <cstdio>','#include <cstdlib>','#include <cstring>','#include <functional>','#include <iostream>','#include <limits>','#include <map>','#include <memory>','#include <queue>','#include <set>','#include <sstream>','#include <string>','#include <utility>','#include <vector>','#include <simplecpp>'].join('\n')+'\n');
clang.FS.mkdirTree('/project');
clang.FS.writeFile('/project/all.cpp', src);
const inc = ['-internal-isystem', '/include/wasm32-wasi/c++/v1', '-internal-isystem', '/include/c++/v1',
  '-internal-isystem', 'lib/clang/20/include', '-internal-isystem', '/include/wasm32-wasi',
  '-internal-isystem', '/include'];
const args = ['-cc1', '-triple', 'wasm32-unknown-wasi', '-emit-obj', '-mrelocation-model', 'static',
  '-mframe-pointer=none', '-ffp-contract=on', '-fno-rounding-math', '-mconstructor-aliases',
  '-target-cpu', 'generic', '-fvisibility=hidden', '-debugger-tuning=gdb', '-fdebug-compilation-dir=/',
  '-fcoverage-compilation-dir=/', '-resource-dir', 'lib/clang/20', '-I', '/lib/simplecpp', '-I', '/project',
  ...(pch ? ['-include-pch', '/simplecpp.pch'] : []), ...inc,
  oflag, ...extra, '-std=c++20', '-w', '-fdeprecated-macro', '-ferror-limit', '19',
  '-fgnuc-version=4.2.1', '-fno-implicit-modules', '-fskip-odr-check-in-gmf',
  '-o', '/tmp/all.o', '-x', 'c++', '/project/all.cpp'];
const t1 = Date.now();
const rc = clang.callMain(args);
console.log('compile rc', rc, 'ms', Date.now() - t1, 'err', err.slice(0, 500));
if (rc === 0) {
  lld.FS.writeFile('/tmp/all.o', clang.FS.readFile('/tmp/all.o', { encoding: 'binary' }));
  const t2 = Date.now();
  const lrc = lld.callMain(['-m', 'wasm32', '-Llib/clang/20/lib/wasm32-unknown-wasi', '-L/lib/wasm32-wasi',
    '/lib/wasm32-wasi/crt1-command.o', '/tmp/all.o', '--allow-undefined', '-lc++', '-lc++abi', '-lc',
    'lib/clang/20/lib/wasm32-unknown-wasi/libclang_rt.builtins.a', '-o', 'a.out']);
  console.log('link rc', lrc, 'ms', Date.now() - t2);
  const mod = await WebAssembly.compile(lld.FS.readFile('a.out', { encoding: 'binary' }));
  console.log('module?', !!mod, 'env imports', WebAssembly.Module.imports(mod).filter(x => x.module === 'env').length);
  if (process.env.IMPORTS) console.log(WebAssembly.Module.imports(mod).filter(x => x.module === 'env').map(x => x.name).join('\n'));
  if (process.env.RUN) {
    const { runModule } = await import('../src/runtime.js');
    try {
      const r = await runModule(mod, {
        eventSab: null, stdinSab: null,
        onDraw: () => {}, onStdout: s => process.stdout.write('STDOUT: ' + s), onStderr: s => process.stdout.write('STDERR: ' + s),
      });
      console.log('run result', r);
    } catch (e) {
      console.log('RUN ERROR:', e.message);
    }
  }
}
console.log('total ms', Date.now() - t0);
