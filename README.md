# OOA Website

OOA Website 是水声建模交互教学网站。React workspace 加载 OpenOcean Acoustic
的 Bellhop2D、Kraken 和 RAM 浏览器 Runtime；计算在学习者设备的 Web
Worker/WebAssembly 中执行，静态主机不接收实验环境，也不执行声场计算。

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
the original `f45c697` document, styling and browser interactions through a
mechanical React renderer. Its model SDK is loaded only inside the corresponding
Runtime when that page starts; the original navigation uses normal links, so
changing model pages unloads the active page and its Worker.

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
`application/wasm` and `.mjs` as JavaScript. The current intranet HTTP deployment
uses single-thread WASM and does not require an SSL certificate. These headers
are included for hosts that support cross-origin isolation:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The build includes `_headers` and `_redirects` for compatible static hosts. A
pthread runtime is selected only on a secure origin when `crossOriginIsolated`
is true; otherwise the Runtime remains single-threaded. Other hosts must express
the same MIME, fallback and cache behavior in their own configuration.

Architecture details live in [`docs/architecture/workspace.md`](docs/architecture/workspace.md),
the release-oriented completion audit is in
[`docs/architecture/completion-audit.md`](docs/architecture/completion-audit.md),
and the development workflow is in [`CONTRIBUTING.md`](CONTRIBUTING.md). The
Figma/token handoff remains deferred in [`docs/figma/README.md`](docs/figma/README.md).
