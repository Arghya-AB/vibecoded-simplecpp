import { firefox } from 'playwright';

const base = process.env.BASE_URL || 'http://localhost:4173/';
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

const failures = [];
function check(name, condition, detail = '') {
  console.log((condition ? '  PASS ' : '  FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!condition) failures.push(name);
}
const status = () => page.locator('#status').textContent();
const stdout = () => page.locator('#term-log').textContent();
const errors = () => page.locator('#errors').textContent();

async function waitFor(pattern, timeout = 90000) {
  await page.waitForFunction(p => new RegExp(p).test(document.getElementById('status').textContent),
    pattern.source || pattern, { timeout });
}
const waitFinished = () => waitFor(/Finished in|failed|error/i);

await page.goto(base, { waitUntil: 'load' });
await page.waitForSelector('#editor .cm-content');
check('cross-origin isolated (SharedArrayBuffer available)',
  await page.evaluate(() => typeof SharedArrayBuffer !== 'undefined'));
check('build mode defaults to Fast', (await page.inputValue('#build-mode')) === 'fast');

const inkPixels = () => page.evaluate(() => {
  const c = document.getElementById('canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4)
    if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) n++;
  return n;
});

/* 1. Welcome: graphics, stdout and interactive stdin. */
console.log('\nWelcome example');
await page.fill('#term-input', 'Alice');
await page.click('#run');
await waitFinished();
const welcomeOut = await stdout();
const welcomeErr = await errors();
const welcomeInk = await inkPixels();
check('no compiler errors', !welcomeErr.trim(), welcomeErr.slice(0, 160));
check('stdin reaches cin', /Hello, Alice!/.test(welcomeOut), JSON.stringify(welcomeOut));
check('graphics rendered', welcomeInk > 2000, welcomeInk + ' non-white pixels');

/* 2. Multi-file project with a user header. */
console.log('\nMultiple files');
await page.selectOption('#example-select', 'Multiple files');
await page.click('#run');
await waitFinished();
check('multi-file output', /flower\(\) returned 16/.test(await stdout()));
check('multi-file compiles', !(await errors()).trim(), (await errors()).slice(0, 160));
check('multi-file graphics', (await inkPixels()) > 1000);

/* 3. Turtle art example (turtleSim API). */
console.log('\nTurtle art');
await page.selectOption('#example-select', 'Turtle art');
await page.click('#run');
await waitFinished();
check('turtleSim runs', /Done drawing/.test(await stdout()), (await stdout()).slice(0, 120));
check('turtleSim draws', (await inkPixels()) > 100, (await inkPixels()) + ' pixels');

/* 4. Events: a real click must reach getClick(). */
console.log('\nClick and keys');
await page.selectOption('#example-select', 'Click and keys');
await page.click('#run');
await page.waitForFunction(() => /Click anywhere/.test(document.getElementById('term-log').textContent), null, { timeout: 90000 });
const origin = await page.locator('#canvas').evaluate(el => {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top) };
});
await page.mouse.click(origin.x + 123, origin.y + 234);
await waitFinished();
const clickOut = await stdout();
check('mouse click reaches getClick()', /Clicked at 123, 234/.test(clickOut), JSON.stringify(clickOut));

console.log('\nKey press during getClick()');
await page.selectOption('#example-select', 'Click and keys');
await page.click('#run');
await page.waitForFunction(() => /Click anywhere/.test(document.getElementById('term-log').textContent),
  null, { timeout: 90000 });
await page.locator('#canvas').hover();
await page.keyboard.press('a');
await page.locator('#canvas').click({ position: { x: 60, y: 70 } });
await waitFinished();
const keyBeforeClickOut = await stdout();
check('key press during getClick() reaches checkEvent()', /You pressed: a/.test(keyBeforeClickOut),
  JSON.stringify(keyBeforeClickOut));
check('click still reported', /Clicked at 60,\s*6\d/.test(keyBeforeClickOut),
  JSON.stringify(keyBeforeClickOut));

console.log('\nKey events');
await page.locator('#editor .cm-content').click();
await page.keyboard.press('ControlOrMeta+A');
await page.keyboard.insertText(
  '#include <simplecpp>\nint main(){ initCanvas("Keys", 300, 300); cout << "Press a key" << endl; ' +
  'XEvent e; do { nextEvent(e); } while (!keyPressEvent(e)); ' +
  'cout << "You pressed: " << charFromEvent(e) << endl; return 0; }');
await page.click('#run');
await page.waitForFunction(() => /Press a key/.test(document.getElementById('term-log').textContent),
  null, { timeout: 90000 });
await page.locator('#canvas').hover();
check('hovering canvas takes keyboard focus',
  await page.evaluate(() => document.activeElement && document.activeElement.id === 'canvas'));
await page.keyboard.press('a');
await waitFinished();
check('key event reaches program', /You pressed: a/.test(await stdout()), JSON.stringify(await stdout()));
check('key was not typed into stdin', (await page.inputValue('#term-input')) === '',
  JSON.stringify(await page.inputValue('#term-input')));

/* 5. Interactive stdin: send input while the program is already running. */
console.log('\nInteractive stdin');
await page.selectOption('#example-select', 'Welcome');
await page.click('#run');
await page.waitForFunction(() => /Type your name/.test(document.getElementById('term-log').textContent), null, { timeout: 90000 });
await page.fill('#term-input', 'Bob');
await page.click('#term-send');
await waitFinished();
check('stdin sent mid-run reaches cin', /Hello, Bob!/.test(await stdout()), JSON.stringify(await stdout()));

/* 6. wait() is cooperative and does not hang the worker. */
console.log('\nwait()');
await page.locator('#editor .cm-content').click();
await page.keyboard.press('ControlOrMeta+A');
await page.keyboard.insertText('#include <simplecpp>\nint main(){ wait(0.05); cout << "waited ok" << endl; return 0; }');
await page.click('#run');
await waitFinished();
check('wait() completes', /waited ok/.test(await stdout()), JSON.stringify(await stdout()));

/* 7. Quality build (-Ofast) still compiles, links and runs. */
console.log('\nQuality build');
await page.selectOption('#build-mode', 'quality');
await page.locator('#editor .cm-content').click();
await page.keyboard.press('ControlOrMeta+A');
await page.keyboard.insertText('#include <simplecpp>\nint main(){ cout << 1.5 + 1.5 << endl; return 0; }');
await page.click('#run');
await waitFinished();
check('quality build runs', /^3\s*$/m.test(await stdout()), JSON.stringify(await stdout()));
await page.selectOption('#build-mode', 'fast');

/* 8. Multi-line stdin: Shift+Enter and pasted test cases. */
console.log('\nMulti-line stdin');
await page.locator('#editor .cm-content').click();
await page.keyboard.press('ControlOrMeta+A');
await page.keyboard.insertText(
  '#include <iostream>\n#include <string>\nusing namespace std;\n' +
  'int main(){ string a,b; getline(cin,a); getline(cin,b); ' +
  'cout << "[" << a << "|" << b << "]" << endl; return 0; }');
await page.click('#run');
await page.fill('#term-input', 'alpha');
await page.press('#term-input', 'Shift+Enter');
await page.keyboard.insertText('beta');
check('Shift+Enter inserts a newline', (await page.inputValue('#term-input')) === 'alpha\nbeta');
await page.press('#term-input', 'Enter');
await waitFinished();
check('multi-line input reaches getline()', /\[alpha\|beta\]/.test(await stdout()), JSON.stringify(await stdout()));

console.log('\nPasted test case');
await page.click('#run');
await page.locator('#term-input').focus();
await page.keyboard.insertText('one\ntwo');
check('pasted newlines are preserved', (await page.inputValue('#term-input')) === 'one\ntwo');
await page.press('#term-input', 'Enter');
await waitFinished();
check('pasted test case reaches getline()', /\[one\|two\]/.test(await stdout()), JSON.stringify(await stdout()));

/* 9. Basic file I/O in the scratch filesystem. */
console.log('\nFile I/O');
await page.locator('#editor .cm-content').click();
await page.keyboard.press('ControlOrMeta+A');
await page.keyboard.insertText(
  '#include <simplecpp>\n#include <fstream>\n' +
  'int main(){ std::ofstream f("scratch.txt"); f << "hello file" << std::endl; f.close(); ' +
  'std::ifstream g("scratch.txt"); std::string s; std::getline(g, s); cout << s << endl; return 0; }');
await page.click('#run');
await waitFinished();
check('file I/O works', /hello file/.test(await stdout()), JSON.stringify(await stdout()));

/* 10. Sanitizer reports undefined behaviour instead of a silent bad value. */
console.log('\nSanitizer');
check('sanitizer defaults off', !(await page.isChecked('#sanitize')));
await page.locator('#editor .cm-content').click();
await page.keyboard.press('ControlOrMeta+A');
await page.keyboard.insertText('#include <simplecpp>\nint main(){ int* x = 0; cout << *x << std::endl; return 0; }');
await page.click('#run');
await waitFinished();
check('plain build still completes', /Finished in/.test(await status()), await status());
check('no sanitizer warning by default', !/Undefined behaviour/.test(await errors()));
await page.check('#sanitize');
await page.click('#run');
await waitFor(/Runtime error/i);
const sanErr = await errors();
check('sanitizer catches null deref',
  /Undefined behaviour: null pointer dereference/.test(sanErr) && /main\.cpp:\d+:\d+/.test(sanErr),
  sanErr.slice(0, 200));

console.log('\nSanitized real program');
await page.click('#console-tabs button[data-panel="terminal"]');
await page.selectOption('#example-select', 'Welcome');
await page.fill('#term-input', 'Sanitize');
await page.click('#run');
await waitFinished();
check('sanitized Welcome example runs',
  /Hello, Sanitize!/.test(await stdout()) && !/not a Function/.test(await errors()),
  JSON.stringify((await stdout()).slice(-120)));
await page.uncheck('#sanitize');

/* 11. Format runs clang-format on the active file. */
console.log('\nFormat');
await page.locator('#editor .cm-content').click();
await page.keyboard.press('ControlOrMeta+A');
await page.keyboard.insertText('#include <simplecpp>\nint main(){int x=0;if(x==0){cout<<"hi"<<endl;}return 0;}');
await page.click('#format');
await page.waitForFunction(() => /Formatted main\.cpp/.test(document.getElementById('status').textContent),
  null, { timeout: 30000 });
const formatted = await page.evaluate(() =>
  [...document.querySelectorAll('#editor .cm-line')].map(e => e.textContent).join('\n'));
check('format button formats active file', /int main\(\) \{\n\s+int x = 0;/.test(formatted),
  JSON.stringify(formatted.slice(0, 160)));

/* 12. Compiler diagnostics appear in the errors panel. */
console.log('\nCompile diagnostics');
await page.selectOption('#example-select', 'Welcome');
await page.locator('#editor .cm-content').click();
await page.keyboard.press('ControlOrMeta+A');
await page.keyboard.insertText('#include <simplecpp>\nint main(){ this is not c++; }');
await page.click('#run');
await waitFor(/failed|error/i);
check('syntax error reported', /error:/.test(await errors()), (await errors()).slice(0, 160));
check('error panel shown', await page.locator('#errors').evaluate(el => el.classList.contains('active')));

check('no uncaught browser errors', consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 3)));

console.log('\n' + (failures.length ? 'BROWSER TEST FAIL: ' + failures.join(', ') : 'BROWSER TEST PASS'));
await browser.close();
process.exit(failures.length ? 1 : 0);
