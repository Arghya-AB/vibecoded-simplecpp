// Generates the precompiled headers reused by every browser compile.
// They contain the C++ standard headers plus the complete simplecpp port, so a
// user's `#include <simplecpp>` is satisfied instantly from the AST file.
// Two variants are built because Clang rejects a PCH whose optimization level
// differs from the compile that consumes it.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Clang, setUpSysroot } from 'browsercc';

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
const sysroot = await (await fetch(dist + 'sysroot.tar')).arrayBuffer();
const libdir = path.join(root, 'simplecpp');
const libFiles = {};
for (const f of await fs.readdir(libdir)) libFiles['/lib/simplecpp/' + f] = await fs.readFile(path.join(libdir, f), 'utf8');
const { PRELUDE } = await import('../src/prelude.js');

const inc = ['-internal-isystem', '/include/wasm32-wasi/c++/v1', '-internal-isystem', '/include/c++/v1',
  '-internal-isystem', 'lib/clang/20/include', '-internal-isystem', '/include/wasm32-wasi',
  '-internal-isystem', '/include'];

for (const { file, flag } of [
  { file: 'simplecpp.pch', flag: '-O0' },
  { file: 'simplecpp-ofast.pch', flag: '-Ofast' },
]) {
  let err = '';
  // A fresh Clang instance is required for each callMain() invocation.
  const clang = await Clang({ thisProgram: 'clang++', printErr: d => { err += d + '\n'; } });
  setUpSysroot(clang, sysroot, libFiles);
  clang.FS.writeFile('/prelude.h', PRELUDE);
  const args = ['-cc1', '-triple', 'wasm32-unknown-wasi', '-emit-pch', '-mrelocation-model', 'static',
    '-mframe-pointer=none', '-ffp-contract=on', '-fno-rounding-math', '-mconstructor-aliases',
    '-target-cpu', 'generic', '-fvisibility=hidden', '-debugger-tuning=gdb',
    '-fdebug-compilation-dir=/', '-fcoverage-compilation-dir=/', '-resource-dir', 'lib/clang/20',
    '-I', '/lib/simplecpp', ...inc, flag, '-std=c++20', '-fdeprecated-macro', '-ferror-limit', '19',
    '-fgnuc-version=4.2.1', '-fno-implicit-modules', '-fskip-odr-check-in-gmf',
    '-fno-pch-timestamp', '-fpch-instantiate-templates',
    '-o', '/out.pch', '-x', 'c++-header', '/prelude.h'];
  const rc = clang.callMain(args);
  if (rc !== 0) { console.error(err); process.exit(1); }
  const out = path.join(root, 'public/toolchain', file);
  await fs.writeFile(out, clang.FS.readFile('/out.pch', { encoding: 'binary' }));
  console.log('wrote', out, (await fs.stat(out)).size, 'bytes');
}
