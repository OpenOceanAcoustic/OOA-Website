# OOA Website

OOA Website 是水声建模交互教学网站。React workspace 加载 OpenOcean Acoustic
的 Bellhop2D、Kraken 和 RAM 浏览器 Runtime；计算在学习者设备的 Web
Worker/WebAssembly 中执行，静态主机不接收实验环境，也不执行声场计算。

## Local model sources

日常开发从同级 Field 仓库的当前工作树构建 npm 包。未提交修改允许参与开发构建，
并会以 `sourceDirty: true` 写入 provenance；这表示“确实使用了当前本地代码”，
而不是退回了旧包。正式发布不使用这些开发工作树，而是由
`npm run wasm:release` 在 `.field-release-sources/` 创建三个 `origin/main`
的 detached clean worktree 后重新构建。

| Model family | Default source | Website dependency |
|---|---|---|
| Ray Mode | `../OpenOcean-Field-RayMode` | `@openocean/field-bellhop-2d` |
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

Start the website with:

```bash
npm run dev
```

The public routes remain `/`, `/normal-mode/` and `/pe/`. Each route preserves
the original `f45c697` document, styling and browser interactions through
explicit section-level React markup. Its model SDK is loaded only inside the corresponding
Runtime when that page starts; the original navigation uses normal links, so
changing model pages unloads the active page and its Worker.

## Environment import

三个页面都接受统一 FieldDocument v4/兼容 JSON，并按内容嗅探 JSON，不只依赖
文件扩展名。一次选择的文件总量上限为 32 MiB：

- Ray Mode：Bellhop `.env`，以及可选的同名 `.ssp`/`.bty`；
- Normal Mode：同名 Kraken `.env` + `.flp`，两份文件可以分两次选择；
- PE：RAM `.in`（也接受以 `.env` 命名的 JSON）。

导入器优先使用对应原生模型解析器，再快速回退到严格的 canonical/兼容解析。
FieldDocument 中超出当前页面能力的二维 SSP、复杂边界、接收网格或数值范围会转换
为页面可编辑预览；导入状态会明确列出“原值 → 页面实际值”和任何有损投影，
原始 JSON 本身不会被改写。RAMGeo/RAMS 原生文本尚不做猜测性转换，会返回明确的
不支持错误。

## Verification

```bash
npm test
npm run test:build
npm run test:e2e
npm run visual:test
```

`verify:wasm` checks package names, versions, exports, declarations, Workers,
native modules and WASM binaries, then prints source commits, dirty flags and tgz
SHA-256 values from `.wasm-packages/provenance.json`.

## Release and deployment

正式发布固定执行：

```bash
npm run wasm:release
npm run check:release
```

该流程不会切换、清理或提交同级 Field 开发工作树。它要求发布 provenance
全部为 clean，且提交号与各仓库 `origin/main` 完全一致。

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
and the development workflow is in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Page and style maintenance

The accepted interface is explicit React markup rather than a raw HTML document
loaded at runtime. Each model feature owns `page/`, `controller/`, `styles/` and
`route/` directories. Shared shipped resources live in `@ooa/assets`; CSS used
by more than one page lives in `@ooa/styles`. Model-specific layout remains next
to the model page so changing one experiment cannot unexpectedly restyle the
others.

No paid design platform is part of the development or release workflow. The
desktop visual baselines under `tests/visual/baseline` can be refreshed only
with `npm run visual:update` after an approved visual change. Normal test runs
never overwrite the accepted screenshots.
