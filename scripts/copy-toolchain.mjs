// Copy the precompiled clang/lld WASM toolchain into public/ so the browser
// can fetch it from a same-origin URL (no server-side compilation is used).
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'browsercc', 'dist');
const dst = join(root, 'public', 'toolchain');

if (!existsSync(src)) {
  console.error('browsercc is not installed; run npm install first.');
  process.exit(1);
}
mkdirSync(dst, { recursive: true });
for (const name of ['clang.js', 'clang.wasm', 'lld.js', 'lld.wasm', 'sysroot.tar']) {
  cpSync(join(src, name), join(dst, name));
}
console.log('Copied browsercc toolchain to public/toolchain');
