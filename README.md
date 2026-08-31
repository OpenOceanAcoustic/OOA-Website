# OOA Website

React workspace for the OpenOcean Acoustic Bellhop2D, Kraken and RAM browser
runtimes. Calculations execute locally in Web Workers/WebAssembly; the static web
host does not receive model input or perform field calculations.

## Local model sources

The website builds npm packages from the current working trees of sibling model
repositories. Dirty worktrees are allowed and recorded in provenance.

| Model family | Default source | Website dependency |
|---|---|---|
| Ray Mode | `../OpenOcean-Field-RayMode-Bellhop` | `@openocean/field-bellhop-2d` |
| Normal Mode | `../OpenOcean-Field-NormalMode` | `@openocean/field-normal-mode-kraken` |
| PE | `../OpenOcean-Field-PE` | `@openocean/field-pe-ram` |

Override these paths with `OOA_RAY_MODE_SOURCE`, `OOA_NORMAL_MODE_SOURCE` and
`OOA_PE_SOURCE`. The build writes only below this repository's ignored
`.wasm-build`, `.wasm-cache` and `.wasm-packages` directories.

## Bootstrap and development

Requires Node.js 22+, CMake, Ninja, `emcmake` and `emcc`.

```bash
npm run wasm:build
npm install
npm run verify:wasm
npm run build
```

After a model working tree changes:

```bash
npm run wasm:sync
```

The development commands are:

```bash
npm run dev
npm run storybook
```

The public routes remain `/`, `/normal-mode/` and `/pe/`. Each route preserves
the original `f45c697` document, styling and browser interactions. Its model SDK
is loaded only when that page starts; the original navigation uses normal links,
so changing model pages unloads the active page and its Worker.

## Verification

```bash
npm test
npm run test:build
npm run test:e2e
npm run build-storybook
```

`verify:wasm` checks package names, versions, exports, declarations, Workers,
native modules and WASM binaries, then prints source commits, dirty flags and tgz
SHA-256 values from `.wasm-packages/provenance.json`.

## Deployment

Serve `dist/` as an SPA with fallback to `index.html`, `.wasm` MIME type
`application/wasm`, and these response headers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The build includes `_headers` and `_redirects` for compatible static hosts. Other
hosts must express the same behavior in their own configuration.

Architecture details live in [`docs/architecture/workspace.md`](docs/architecture/workspace.md),
and the Figma/token handoff is in [`docs/figma/README.md`](docs/figma/README.md).
