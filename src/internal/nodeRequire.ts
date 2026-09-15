/**
 * Reaching Node's `require` from code that is compiled to BOTH module systems.
 *
 * `createRequire` is the one mechanism that exists in both, so there is a
 * single path rather than a CommonJS branch and an ESM branch. What differs is
 * only where resolution starts from, and `typeof __filename` answers that at
 * runtime without either format having to parse the other's syntax.
 *
 * **This file used to use `eval` twice, and neither is needed.** The reasons
 * recorded for them stopped being true:
 *
 *  - `eval('require')` was there because a bare `require` fails in a real ESM
 *    module. But `createRequire` covers CommonJS too, so the branch it guarded
 *    is gone. Worth stating because the obvious fix is wrong: the `eval` could
 *    NOT have been made indirect, which is what bundlers suggest. Indirect eval
 *    runs in global scope, where `require` is not in scope — it returns
 *    `undefined`, so the CommonJS build would have fallen through to the ESM
 *    path and worked by accident.
 *  - `eval('import("node:module")')` was there so the CommonJS build would not
 *    parse the dynamic import. It parses it fine: Node has supported `import()`
 *    from CommonJS since v12, and tsup emits it untouched in both formats.
 *
 * What the `eval` DID buy, and what replaces it: this source is typechecked as
 * CommonJS, so writing `import.meta.url` is a compile error (TS1343) even
 * though the ESM output would accept it. `ownModulePath()` reads the same path
 * from a stack frame, in code the typechecker can see.
 *
 * Neither `import()` here is a static edge, so a bundler does not follow it and
 * `tests/environments/bundling.test.ts` still passes — it asserts that no Node
 * builtin is named in a STATIC import.
 *
 * Every caller is already behind a runtime check for Node
 * (`typeof window === 'undefined' && typeof self === 'undefined'`), and this
 * module contains no top-level statement that touches a Node built-in. A
 * browser bundle that includes it does not execute it.
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

  try {
    const { createRequire } = await import('node:module');

    // THIS module's own path, so resolution starts from the installed package
    // the way CommonJS `require` does. Anchoring on `process.cwd()` instead is
    // subtly wrong: it works whenever the process runs inside the project and
    // fails when it does not — a CLI invoked from elsewhere, a test runner with
    // its own working directory. Measured: with the CWD outside the project, a
    // CWD-anchored build failed with "Cannot find module".
    //
    // `__filename` exists in the CommonJS output and is exact. The ESM output
    // has `import.meta.url` instead, but it cannot be WRITTEN here: this source
    // is typechecked under `module: CommonJS`, where `import.meta` is TS1343.
    // Hiding it inside `eval` is what this file used to do. A stack frame
    // carries the same path and is ordinary code.
    const base = typeof __filename !== 'undefined' ? __filename : ownModulePath();

    cached = createRequire(base ?? `${process.cwd()}/`) as NodeRequire;
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
 * Only the ESM output needs it — CommonJS has `__filename`. The frame below
 * `Error` is the caller inside this file, so its path is this module's.
 *
 * Returns null when the stack is absent or shaped unexpectedly, and the caller
 * then falls back to the working directory: right more often than it is wrong,
 * and no worse than having no base at all.
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
