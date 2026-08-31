# OOA Website workspace architecture

## Dependency direction

```text
assets ──────────────────────────────────────────┐
styles ──────────────────────────────────────────┤
environment ─────────────────────────────────────┤
runtime-core ──> runtime-ray ────────────────────┤
             └─> runtime-normal-mode ────────────┤──> apps/web model features
             └─> runtime-pe ─────────────────────┤
visualization ───────────────────────────────────┘
```

The application has three route-level feature modules. Each route explicitly
composes the original visible sections from TSX and attaches its page-specific
controller; there is no raw HTML renderer, shared Workbench or result-tab layout. Controllers call
the corresponding `@ooa/runtime-*/page-runtime` deep facade and never receive a
model SDK Input. Each concrete OpenOcean SDK is imported in exactly one
`sdk-loader.ts`; source and binding directories in sibling model repositories
are never imported by the website.

## Package responsibilities

| Package | Owns | Must not own |
|---|---|---|
| `assets` | catalogued brand graphics, icons and later page illustrations | screenshots, WASM output or model data |
| `styles` | shared CSS control interfaces and page chrome used by two or more sections | model workflows or one-off model layouts |
| `environment` | shared environment types, presets, import, edit and validation | a concrete WASM SDK |
| `runtime-core` | lifecycle, cancellation, stale-request protection, errors and memory budgets | React, Zustand or canvas |
| `runtime-*` | one model family's SDK mapping and result contract | another runtime family or UI state |
| `visualization` | reusable DPR/canvas primitives for later incremental extraction | model execution or page redesign |
| `apps/web/features/*/page` | explicit original page sections and their DOM contracts | SDK access or cross-model state |
| `apps/web/features/*/controller` | browser events, Canvas orchestration and Runtime facade calls | page layout or concrete SDK imports |
| `apps/web/features/*/styles` | model-specific layout and scientific presentation | styles for unrelated models |

## Runtime lifecycle and data flow

```text
sibling model working tree
  -> CMake/Emscripten
  -> npm tgz
  -> .wasm-packages/active
  -> npm directory link
  -> one @ooa/runtime-* SDK loading boundary
  -> Worker/WASM
  -> original page result contract
  -> original canvas renderer
```

The original top navigation uses document links. Changing model pages therefore
unloads the active document and releases its Worker without adding another SPA
lifecycle layer. Within a page, request tokens prevent an older calculation from
overwriting a newer result. Native ENV/FLP/RAM inputs remain in a Runtime-owned
`sourceId` cache, and large fields stay in typed arrays.

WASM load or execution errors are surfaced as `RuntimeError`; there is no silent
simulation fallback. A future demonstration adapter must be explicitly gated by
`?demo` and must not be used by the normal route.

The current controllers preserve the accepted event timing and DOM identifiers.
Future controller extraction follows the same visible-section seams and keeps
calculation behind the Runtime facade; it must not introduce a second visual
layout.

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
single `sdk-loader.ts` import seam and the ban on raw-page HTML loading.
`npm run verify:structure` checks the four feature directories, asset catalog
entries and exported CSS files.
`npm run typecheck` uses strict TypeScript.
`tests/build/spa-artifacts.test.mjs` asserts that production output includes the
three first-phase families and excludes NX2D, Bellhop3D, Krakenc, RAMGeo and RAMS.
