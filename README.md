# vibecoded-simplecpp

A complete port of the `simplecpp` C++ graphics library to the browser. You write
C++ on the left; graphics appear in the panel on the top right; stdout and
interactive stdin share one terminal-style stream below it, with compiler
errors on a separate tab.

**Everything runs in the browser.** Clang and LLD are compiled to WebAssembly
(via [`browsercc`](https://github.com/BertalanD/browsercc)) and the WASI runtime,
graphics bridge and event loop are plain JavaScript in a Web Worker. There is no
backend, no remote compile service, and no server-side execution.

## Quick start

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally <http://localhost:5173>). Pick an example
and press **Run** (or `Ctrl`/`Cmd` + `Enter`). The **Build** selector defaults to
**Fast** (quick compiles); **Quality** trades compile time for a faster-running
program.

For the production build:

```bash
npm run build
npm run preview
```

Both the dev server and the preview server send `Cross-Origin-Opener-Policy` and
`Cross-Origin-Embedder-Policy` headers so the page is cross-origin isolated.
That enables `SharedArrayBuffer`, which is what makes `wait()`, `getClick()` and
interactive `cin` genuinely non-blocking. GitHub Pages cannot send custom
headers, so `public/coi-serviceworker.js` adds them at runtime instead. The page
reloads once while that worker takes control; afterwards input and events work
the same as in local development.

The terminal input accepts multi-line test cases: **Shift+Enter** inserts a new
line, **Enter** sends the whole buffer to `cin`, and pasting text with newlines
keeps them verbatim. You can paste a full test case before or while the program
is running; it stays buffered until the program reads it.

To test keyboard events, hover over (or click) the graphics window while the
program runs. Hovering moves focus from the terminal input to the canvas, so a
plain keypress reaches the program instead of being typed into the input box;
moving the mouse away gives focus back to the terminal. The canvas shows an
outline while it has keyboard focus.

A key pressed while a program waits in `getClick()` is not lost: it is buffered
and the following `checkEvent()` can still read it with `keyPressEvent()` /
`charFromEvent()`, as in the **Click and keys** example.

## Deploy to GitHub Pages

This is a static site; no server or backend is needed.

1. Push this repository to GitHub.
2. In the repository settings, open **Pages** and set **Build and deployment →
   Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs `npm ci`, `npm run build`
   and publishes `dist/` on every push to `main`.

The Vite base path is `./`, so the site works at both
`https://<user>.github.io/` and `https://<user>.github.io/<repo>/`. The bundled
COI service worker handles the headers on GitHub Pages; no extra configuration
is required.

## Writing programs

The end-user API is unchanged. Programs still start with:

```cpp
#include <simplecpp>

int main() {
  initCanvas("Hello", 500, 500);
  Circle c(250, 250, 80);
  c.setColor(COLOR("orange"));
  c.setFill();
  cout << "Hello from wasm!" << endl;
  getClick();
  return 0;
}
```

Supported API: `Turtle`, `Canvas`, `Sprite`, `Line`, `Circle`, `Rectangle`,
`Polygon`, `Text`, `XEvent`, `COLOR()`, `wait()`, `turtleSim()`, `sim`,
`initCanvas()`, `getClick()`, `checkEvent()`, `repeat`, `dotimes`, etc.

Multiple files are supported. Use the **+** button next to the file tabs to add
`.cpp` files and headers. Each `.cpp` is compiled as its own translation unit
and the objects are linked together, just like a desktop compiler, so quoted
includes (`#include "utils.h"`) resolve between your files.

The **Format** button next to the file tabs (or `Ctrl`/`Cmd` + `Shift` + `F`)
runs real clang-format in WebAssembly on the active file. The download button at
the far right of the top bar saves that file with its exact tab name.
While a program is running, **Run** stays disabled and **Stop** terminates it;
the editor and console are immediately usable again. Drag the borders between
the editor/output and graphics/console to resize those panels; double-click a
border to reset it.

### Files and crashes

`<fstream>`, `FILE*` and friends work: there is a private in-memory scratch
directory preopened at `.`, so a program can create, write and read temporary
files. It is discarded when the program finishes and never touches the host
filesystem.

A crashing C++ program cannot harm the browser: WebAssembly memory is
bounds-checked. Out-of-bounds reads usually return zero or nearby garbage
instead of segfaulting, and a pointer far outside linear memory traps with an
`out of bounds memory access` error. To make these mistakes easier to find,
**Sanitize** is checked by default (it works in either build mode): it
instruments your code and reports null pointer dereferences, misaligned accesses, floating-point division
by zero and missing returns with a `file:line:column` in the **Errors** tab,
e.g.:

```
Undefined behaviour: null pointer dereference of type 'int' at /project/main.cpp:4:12
```

### Notes on the port

- The X11 implementation in the original library was replaced by a small
  header-only bridge (`simplecpp/host.h`) whose functions are WebAssembly
  imports implemented in `src/runtime.js`. The public headers and end-user API
  are otherwise the same.
- Precompiled headers containing the standard library and the whole ported
  library make compiles fast: `simplecpp.pch` for **Fast** (`-O0`) and
  `simplecpp-ofast.pch` for **Quality** (`-Ofast`). Clang requires a PCH built
  with the same optimization level. Rebuild both after changing anything in
  `simplecpp/`: `npm run build:pch` followed by `npm run build`.
- When `main()` returns, local graphics objects are destroyed. The IDE restores
  the fullest frame that was presented so the final drawing stays on screen.
  For persistent drawings inside a program, use `imprint()` as in normal
  simplecpp.

## Project layout

| Path | Purpose |
| --- | --- |
| `simplecpp/` | Header-only browser port of the library |
| `src/compiler.js` | Clang/LLD driver, separate translation units, PCH, sanitizer flags |
| `src/runtime.js` | WASI + `env` imports, canvas commands, event/stdin rings |
| `src/worker.js` | Compile/run pipeline in a Web Worker |
| `src/main.js` | Editor, tabs, console panels, canvas rendering, input events |
| `src/shared.js` | SharedArrayBuffer ring layouts for events and stdin |
| `src/examples.js` | Starter programs |
| `public/toolchain/` | WebAssembly toolchain and precompiled headers |
| `public/coi-serviceworker.js` | Adds COOP/COEP headers on static hosts such as GitHub Pages |
| `.github/workflows/deploy.yml` | Builds and publishes `dist/` to GitHub Pages |
| `tests/browser-test.mjs` | End-to-end Playwright tests |

## Tests

```bash
npm run build
npm test
```

`npm test` starts `vite preview` and runs browser tests covering multi-file
compilation, stdin, graphics, turtle drawing, mouse events, compiler
diagnostics, sanitizer diagnostics, file I/O and formatting.
`node tests/bench.mjs --pch` reports compile timings.
