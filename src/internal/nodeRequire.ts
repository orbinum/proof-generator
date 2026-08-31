/**
 * Reaching Node's `require` from code that is compiled to BOTH module systems.
 *
 * Two facts make this awkward, and neither has an inline solution:
 *
 *  - **`eval('require')` throws in a real ESM module.** Verified:
 *    `ReferenceError: require is not defined`. It works in the CommonJS output
 *    and fails in the ESM one, from the same source line.
 *  - **`createRequire(import.meta.url)` is a syntax error in CommonJS.**
 *    `import.meta` cannot appear there at all, so the file will not parse —
 *    which means the obvious fix breaks the other half.
 *
 * The way out is to ask the runtime what it is, at call time rather than parse
 * time. `eval` keeps `import.meta` out of the source text the CommonJS parser
 * sees, so both builds parse; the branch then picks the mechanism that exists.
 *
 * Every caller is already behind a runtime check for Node
 * (`typeof window === 'undefined' && typeof self === 'undefined'`), and this
 * module contains no top-level statement that touches a Node built-in. A
 * browser bundle that includes it does not execute it, and `bundling.test.ts`
 * asserts that Node built-ins are reached lazily, never at module scope.
 */

/** Cached across calls: resolving costs a dynamic import the first time. */
let cached: NodeRequire | undefined;

/** The subset of `require` this package uses. */
export interface NodeRequire {
  (id: string): unknown;
  resolve(id: string): string;
}

/**
 * Node's `require`, however this module was loaded.
 *
 * Throws where there is no Node — a browser, a worker, React Native — with a
 * message saying so, rather than the `ReferenceError` that names nothing.
 */
export async function getNodeRequire(): Promise<NodeRequire> {
  if (cached) return cached;

  // CommonJS: `require` is in scope. `eval` rather than a bare reference so
  // a bundler does not try to resolve or shim it.
  try {
    const fromCjs = eval('typeof require !== "undefined" ? require : undefined') as
      | NodeRequire
      | undefined;
    if (fromCjs) {
      cached = fromCjs;
      return cached;
    }
  } catch {
    // Fall through to the ESM path.
  }

  // ESM: build one with `createRequire`. The `node:module` import sits inside
  // `eval` so the CommonJS build never parses it and no bundler follows the
  // edge.
  //
  // The base must be THIS module's own path, so resolution starts from the
  // installed package the way CommonJS `require` does. Anchoring on
  // `process.cwd()` instead is subtly wrong: it works whenever the process runs
  // inside the project and fails when it does not — a CLI invoked from
  // elsewhere, a test runner with its own working directory. Measured: with the
  // CWD outside the project, the CommonJS build resolved fine while a
  // CWD-anchored ESM build failed with "Cannot find module".
  //
  // `import.meta` cannot supply it. Written literally it stops the CommonJS
  // build from parsing; inside `eval` it throws, because indirect eval runs in
  // global scope where `import.meta` is a syntax error. Both measured. A stack
  // frame carries the same information and parses in either format.
  try {
    const { createRequire } = await (eval('import("node:module")') as Promise<{
      createRequire: (path: string) => NodeRequire;
    }>);
    cached = createRequire(ownModulePath() ?? `${process.cwd()}/`);
    return cached;
  } catch (error) {
    throw new Error(
      `Node's require is unavailable in this environment: ${(error as Error).message}`
    );
  }
}

/**
 * This module's own file path, read from a stack frame.
 *
 * The frame below `Error` is the caller inside this file, so its path is this
 * module's. Returns null when the stack is absent or shaped unexpectedly, and
 * the caller then falls back to the working directory — right more often than
 * it is wrong, and never worse than what this replaced.
 */
function ownModulePath(): string | null {
  for (const frame of (new Error().stack ?? '').split('\n').slice(1)) {
    const url = frame.match(/(file:\/\/\/[^\s)]+?)(?::\d+)*\)?$/);
    if (url?.[1]) return url[1];
    const path = frame.match(/(\/[^\s()]+\.(?:c?js|mjs|ts))(?::\d+)*\)?$/);
    if (path?.[1]) return path[1];
  }
  return null;
}
