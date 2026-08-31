# OOA Website workspace architecture

## Dependency direction

```text
design-tokens ──────> ui
       │               │
       └──> visualization
environment ───────────┐
runtime-core ──────────┼──> runtime-ray
                       ├──> runtime-normal-mode
                       └──> runtime-pe

ui + environment + runtimes + visualization
                    │
                    v
                 apps/web
```

The application has three route-level feature modules. Each route mechanically
renders the original page nodes as React elements and attaches its page-specific
controller; there is no shared Workbench or result-tab layout. Controllers call
the corresponding `@ooa/runtime-*/page-runtime` deep facade and never receive a
model SDK Input. Each concrete OpenOcean SDK is imported in exactly one
`sdk-loader.ts`; source and binding directories in sibling model repositories
are never imported by the website.

## Package responsibilities

| Package | Owns | Must not own |
|---|---|---|
| `design-tokens` | semantic colors, type, spacing, radius, motion and chart scales | components or model parameters |
| `ui` | model-neutral controls, panels and layout | Bellhop, Kraken or RAM terminology |
| `environment` | shared environment types, presets, import, edit and validation | a concrete WASM SDK |
| `runtime-core` | lifecycle, cancellation, stale-request protection, errors and memory budgets | React, Zustand or canvas |
| `runtime-*` | one model family's SDK mapping and result contract | another runtime family or UI state |
| `visualization` | reusable DPR/canvas primitives for later incremental extraction | model execution or page redesign |
| `apps/web/features/*` | the frozen original page, controller and route boundary | direct model SDK access |

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

The typed runtime classes and Zustand stores remain narrow seams for later
incremental extraction. They must not be used to introduce a second visual
layout while the original-page compatibility layer is active.

## Enforced boundaries

`npm run verify:imports` enforces the package direction above, including the
single `sdk-loader.ts` import seam. `npm run typecheck` uses strict TypeScript.
`tests/build/spa-artifacts.test.mjs` asserts that production output includes the
three first-phase families and excludes NX2D, Bellhop3D, Krakenc, RAMGeo and RAMS.
