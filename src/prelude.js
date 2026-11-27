// Must stay byte-for-byte identical to the file used when generating
// public/toolchain/simplecpp.pch (scripts/build-pch.mjs).
export const PRELUDE = [
  '#include <algorithm>', '#include <cmath>', '#include <cstdio>', '#include <cstdlib>',
  '#include <cstring>', '#include <functional>', '#include <iostream>', '#include <limits>',
  '#include <map>', '#include <memory>', '#include <queue>', '#include <set>',
  '#include <sstream>', '#include <string>', '#include <utility>', '#include <vector>',
  '#include <simplecpp>',
].join('\n') + '\n';
