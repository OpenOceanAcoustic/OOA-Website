# Development workflow

OOA Website 是静态托管、浏览器本地计算的水声建模教学网站。任何改动都必须保持两个不变量：正常入口只使用真实 Field WASM 结果；未经明确的视觉任务不得改变原页面。

## 仓库职责

- `OOA-Website`：页面、Runtime 接口、环境导入、可视化、WASM 构建编排和静态部署。
- `OpenOcean-Field-RayMode-Bellhop`：Bellhop2D 原生实现和 npm 包。
- `OpenOcean-Field-NormalMode`：Kraken 原生实现和 npm 包。
- `OpenOcean-Field-PE`：RAM 原生实现和 npm 包。

一个提交只属于一个仓库。不要把 Field 实现修改和网站修改混成一次提交，也不要恢复 Git 子模块。

## 首次初始化

```bash
npm run wasm:build
npm install
npm run verify:wasm
npm run build
```

三个源码目录默认位于网站同级目录，可通过 `OOA_RAY_MODE_SOURCE`、`OOA_NORMAL_MODE_SOURCE` 和 `OOA_PE_SOURCE` 覆盖。

## 日常改动

### 只改网站

```bash
npm run verify:wasm
npm run dev
npm run check
```

`verify:wasm` 会拒绝源码工作树在上次构建后发生变化的情况。发生这种错误时不要绕过验证，应按下一节刷新包。

### 修改 Field 模型或 npm 接口

1. 在对应 Field 仓库完成并测试修改。
2. 提交 Field 仓库；本地探索可以 dirty，准备发布时必须 clean。
3. 在网站仓库运行：

```bash
npm run wasm:sync
npm run check
```

4. 检查 `npm run verify:wasm` 输出的 commit、dirty 状态和 tgz SHA。
5. 只提交网站侧 Runtime、测试和文档修改；`.wasm-*` 构建产物不进入 Git。

### 修改原页面

- 先增加或更新桌面端 DOM/视觉回归，再改 TSX、CSS 或 Canvas。
- 保留原文字、控件属性、触发时机和 Canvas 语义；架构迁移不得顺带换肤。
- Feature 不得导入 `@openocean/field-*` 或通过 `legacy-sdk` 获取具体 SDK。
- 页面按可见区块维护在对应 `page/`，禁止重新引入 `index.html?raw`、运行时 DOMParser 或整页 `dangerouslySetInnerHTML`。
- 至少被两个页面区块使用的控件样式才进入 `@ooa/styles`；模型专属布局留在 Feature。
- 图标、品牌图形和插图登记到 `@ooa/assets/src/catalog.json`，页面不得跨 Feature 借用私有资源。
- 视觉改动必须单独提交；开发和发布不依赖外部付费设计平台。

## 提交前检查

```bash
npm run check
git diff --check
```

提交信息建议使用：

```text
feat(runtime-ray): expose Bellhop experiment result
fix(environment): preserve Kraken FLP receiver grid
refactor(web): extract original field section without visual changes
test(pe): cover Padé convergence selection
```

## 发布检查

1. 确认三个 Field 仓库工作树 clean，且提交号是本次准备发布的版本。
2. 运行 `npm run wasm:sync`。
3. 运行 `npm run check:release`。
4. 保存 `.wasm-packages/provenance.json` 作为发布构建记录。
5. 部署 `dist/`，不要部署源码仓库或 `.wasm-build`。
6. 在最终内网地址验证三个公开 URL 和真实 WASM 计算；HTTP 固定验收单线程，未来 HTTPS + COOP/COEP 再验收 pthread。

## Review checklist

- [ ] 正常入口没有 demo、模拟结果或远程计算回退。
- [ ] Feature 没有具体 Field SDK 类型、构建器或源码相对路径。
- [ ] 大型网格保持 TypedArray，没有转换成普通数组存储。
- [ ] 新任务的取消、过期结果和 Worker 释放有测试。
- [ ] 环境文档没有被上传，模型专属信息没有在导入中丢失。
- [ ] 原页面布局和功能没有未经授权的变化。
- [ ] 生产产物只包含 Bellhop2D、Kraken 和 RAM。
