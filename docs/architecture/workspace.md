# OOA Website workspace architecture

## Dependency direction

```text
styles ──────────────────────────────────────────┤
environment ─────────────────────────────────────┤
runtime-core ──> runtime-ray ────────────────────┤
             └─> runtime-normal-mode ────────────┤──> apps/web model features
             └─> runtime-pe ─────────────────────┤
                                                  └──> typed page controllers

assets (catalog only; no production dependency until a page consumes an asset)
```

The application has three route-level feature modules. Each route explicitly
composes the original visible sections from TSX and mounts its page-specific
strict TypeScript controller; there is no raw HTML renderer, shared Workbench or
result-tab layout. A route creates exactly one typed Runtime and injects it into
the controller. Controllers never receive a model SDK Input. Each concrete
OpenOcean SDK is imported in exactly one `sdk-loader.ts`; source and binding
directories in sibling model repositories are never imported by the website.

## Package responsibilities

| Package | Owns | Must not own |
|---|---|---|
| `assets` | catalogued brand graphics, icons and later page illustrations; currently not a web dependency | screenshots, WASM output or model data |
| `styles` | shared CSS control interfaces and page chrome used by two or more sections | model workflows or one-off model layouts |
| `environment` | shared environment types, JSON parsing, browser file reading and generic limits | a concrete WASM SDK or native model parsing |
| `runtime-core` | lifecycle, cancellation, stale-request protection, errors and memory budgets | React, Zustand or canvas |
| `runtime-*` | one model family's SDK, Worker, native Input, cache, request ID and typed result contract | another runtime family, React or Canvas |
| `apps/web/features/*/page` | explicit original page sections and their DOM contracts | SDK access or cross-model state |
| `apps/web/features/*/controller` | transient page state, browser events, exact Canvas algorithms and Runtime calls | page layout or concrete SDK imports |
| `apps/web/features/*/styles` | model-specific layout and scientific presentation | styles for unrelated models |

## Runtime lifecycle and data flow

```text
Field source
  -> development: sibling current worktree (`wasm:sync`)
  -> release: detached clean origin/main worktree (`wasm:release`)
  -> CMake/Emscripten npm tgz
  -> .wasm-packages/active
  -> npm directory link
  -> one @ooa/runtime-* sdk-loader
  -> one instance-owned typed Runtime
  -> Worker/WASM
  -> typed page Controller
  -> original canvas renderer
```

The original top navigation uses document links. Changing model pages therefore
unloads the active document and releases its Worker without adding another SPA
lifecycle layer. Within a page, request tokens prevent an older calculation from
overwriting a newer result. Native ENV/FLP/RAM inputs remain in a Runtime-owned
`sourceId` cache, and large fields stay in typed arrays.

WASM load or execution errors are surfaced as `RuntimeError`; there is no silent
simulation fallback. Demonstration adapters are constructed explicitly only for
`?demo` and are never selected by a normal URL.

Every controller exposes the same mount seam:

```ts
interface MountedModelPage {
  readonly ready: Promise<void>;
  dispose(): Promise<void>;
}
```

Its `dispose()` removes listeners, stops timers/RAF/observers and releases the
Runtime. DOM queries are scoped to the matching `data-ooa-page` root. Controllers
preserve the accepted event timing and DOM identifiers and must not introduce a
second visual layout.

## Page source layout

```text
features/<model>/
├── page/        # explicit TSX sections; text, ids and node order
├── controller/  # event binding, transient interaction state and Canvas calls
├── styles/      # only this model's layout and visualization selectors
└── route/       # document title, imports and section composition
```

The deletion test governs sharing: if moving a selector or resource to a shared
package does not remove knowledge from at least two callers, it stays local.
This keeps `@ooa/styles` and `@ooa/assets` small and stable.

## Enforced boundaries

`npm run verify:imports` enforces the package direction above, including the
single `sdk-loader.ts` import seam, no cross-runtime dependencies and the ban on
raw-page HTML loading or remote compute uploads. `npm run verify:structure`
rejects production JS in Runtime/Controller directories, retired `page-runtime`
facades, unused internal dependencies and missing CSS/resource contracts.
`npm run typecheck` uses strict TypeScript.
`tests/build/spa-artifacts.test.mjs` asserts that production output includes the
three first-phase families and excludes NX2D, Bellhop3D, Krakenc, RAMGeo and RAMS.

## Styles and resources

`@ooa/styles` contains only CSS used by at least two pages: `base.css`,
`controls.css` and `model-lab.css`. Ray and all model-specific scientific Canvas
styles remain in their Feature. CSS extraction is mechanical and may not change
selector weight, declaration order or computed values. `@ooa/assets` is a
maintained catalog, but the web workspace does not depend on it until a real page
resource is consumed.

## Release provenance

`wasm:release` fetches each Field repository's `origin/main`, prepares detached
worktrees under ignored `.field-release-sources/`, rebuilds all packages and
checks that source commit, dirty flag, tgz hash and active package hash agree.
It never switches or cleans the sibling development worktrees. A clean release
must be followed by `npm run check:release`.
