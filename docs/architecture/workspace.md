# OOA Website workspace architecture

## Production data flow

```text
frozen Field commit
  -> CMake / Emscripten npm package
  -> one runtime sdk-loader
  -> instance-owned typed Runtime
  -> page Feature Hook
  -> original React teaching sections
  -> model Canvas renderer
```

The server only delivers static HTML, JavaScript, Worker and WebAssembly files.
Environment parsing and all Bellhop2D, Kraken and RAM calculations remain in the
learner's browser. Normal URLs surface a real Runtime failure; deterministic
demonstration adapters are available only through the explicit `?demo` query.

## Workspace dependency direction

```text
@ooa/styles ──────────────────────────────────────────────┐
@ooa/ui ──────────────────────────────────────────────────┤
@ooa/environment ─────────────────────────────────────────┤
@ooa/runtime-core -> @ooa/runtime-ray ────────────────────┤
                  -> @ooa/runtime-normal-mode ────────────┼-> @ooa/web
                  -> @ooa/runtime-pe ─────────────────────┘

@ooa/assets (catalogued, but not a web dependency until an asset is used)
```

Only the matching `sdk-loader.ts` may import an `@openocean/field-*` package.
Runtime packages do not import React or Canvas and never import one another.
Features submit typed teaching requests and receive model results with large
grids preserved as TypedArray instances.

## Package responsibilities

| Package or directory | Responsibility |
|---|---|
| `@ooa/assets` | Validated brand/icon/illustration/texture catalog; never environments, fixtures, WASM or results |
| `@ooa/styles` | Exact shared reset, controls and Normal/PE model-lab CSS |
| `@ooa/ui` | Controlled, model-neutral React primitives actually reused by pages |
| `@ooa/environment` | Shared environment DTO, JSON import, file limits and SSP utilities |
| `@ooa/runtime-core` | Lifecycle, cancellation, stale-request protection, errors and memory budgets |
| `@ooa/runtime-*` | One model SDK/Worker, native Input cache, experiment cache and typed result contract |
| `features/*/hooks` | Page parameters, task sequencing, import status and Runtime lifetime |
| `features/*/canvas` | Accepted scientific drawing and local pointer/RAF interaction |
| `features/*/page` | Original visible teaching sections, text, IDs, controls and node order |
| `features/*/styles` | Model-only layout and scientific presentation |
| `features/*/route` | Document title and original section composition |

Normal Mode and PE are controlled React pages: their Hooks own state and their
Canvas modules consume small typed rendering inputs. Ray keeps its much larger
accepted theory/field/eigenray drawing system isolated as one feature-local
Canvas experience behind `useRayPage`; the Route no longer owns a Runtime or
mounts a page controller.

The three top-level links remain normal `<a href>` links. A model change loads a
new document, so cleanup cancels pending work and disposes the active Worker.
No cross-refresh or cross-model state persistence is promised.

## Styles and resources

Tailwind CSS 4.3.3 is present with Preflight disabled. It scans only web and UI
sources. Existing CSS values remain authoritative; Tailwind utilities or
`@apply` may be introduced only when zero-pixel visual tests prove identical
computed output. Canvas, MathML, pseudo-elements, scientific color maps and
complex animations may remain in ordinary CSS.

The deletion test governs sharing: a shared module must remove duplicate
knowledge from at least two production callers. Model terms and one-off model
layouts stay in the Feature. `@ooa/assets` is intentionally not declared by the
web app until a catalogued resource replaces an existing CSS graphic without a
DOM or pixel change.

## Frozen WASM packages

`wasm:freeze` is the only operation that adopts the latest Field `origin/main`.
It builds detached clean worktrees, verifies the packages and writes the tracked
`wasm-package-lock.json` with source commits and per-file hashes. After freezing:

- `wasm:release` checks out the locked commits, not a moving branch;
- `check:wasm-lock` compares every published package file with the lock;
- component work must not run `wasm:sync`;
- a Field upgrade requires a separate freeze and full numerical/UI acceptance.

Current frozen commits are Ray `470ab6d1`, Normal Mode `8f7093bd` and PE
`ceb09d68`. Release provenance must be clean and agree with those commits.

## Enforced checks

- `verify:imports`: Field SDK seam, runtime direction, no raw HTML, no adjacent
  source imports, no remote calculation upload and model-neutral UI.
- `verify:structure`: Hook/Canvas/page layout, no retired page controller,
  TypeScript production sources, real internal dependencies and valid assets.
- `check:wasm-lock`: exact package version, contract files and byte hashes.
- `visual:test`: six full-page Linux Chromium screenshots with zero changed
  pixels; baselines are not updated during component work.
- Playwright: real WASM startup, calculations, imports, interactions, navigation
  disposal and same-origin-only network traffic.
