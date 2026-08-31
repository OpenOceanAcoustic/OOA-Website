# 完善性收尾审计

更新于 2026-08-31。产品定位是桌面端水声建模交互教学网站；服务器只托管静态资源，计算与实验数据留在学习者设备中。本清单不包含移动端、账号系统、后端计算、PWA、SSR 或页面换肤。

## 已完成的收敛项

- 三个 `f45c697` 原始桌面页面和公开 URL 已恢复；React 以明确的页面区块 TSX 保留节点顺序、属性和文字，没有整页 HTML 解析、Workbench 或结果标签页。
- Bellhop2D、Kraken 和 RAM 分别由相邻 Field 工作树构建为正式本地 WASM npm 包；网站不读取模型源码或 bindings。
- Bellhop2D 的 ENV/SSP/BTY、Kraken 的 ENV+FLP、RAM 的 `.in` 均通过各自 npm 包的静态工厂解析。
- 模型原生 Input 和原始文档只保存在对应 Runtime 内部；Feature 只接收 `sourceId`、通用页面 DTO、模型提示和 TypedArray 结果。
- `legacy-sdk` 透传导出已删除；架构门禁禁止 Feature 导入 Field 包、接收 SDK Input、访问相邻源码或发起外部计算上传请求。
- Ray 的声线、声场、水平/垂直复振速和本征声线组合，Kraken 的完整/截断/单模态实验，以及 RAM 的 1–10 Padé sweep 都由对应 Runtime facade 执行。
- 正常入口的 WASM 错误直接失败；确定性演示结果只允许显式 `?demo`。
- 三个页面 Runtime facade 均采用 latest-request 语义：新请求取消同模型旧 Worker 任务，缓存拒绝过期 Promise，页面 request token 再阻止旧结果覆盖；错误统一为 `RuntimeError`。
- npm 链接、源码状态、tgz 和 active 内容均有 SHA-256 校验；`node_modules` 不再污染 active 包哈希。
- 开发模式固定单线程；生产运行时只有在安全上下文且 `crossOriginIsolated` 时采用推荐 pthread，否则明确使用单线程。
- 生产 Playwright 覆盖三个模型启动、重新计算和模型原生环境导入；`dist` 只包含 Bellhop2D、Kraken 和 RAM。
- 1440×900 与 1280×900 的六张仓库内视觉回归图已经冻结，不依赖外部设计平台。
- 页面资源登记在 `@ooa/assets`；Normal Mode 与 PE 实际共享的页面外壳和控件样式由 `@ooa/styles` 维护，模型专属样式仍贴近页面。
- 三个页面只经过 `sdk-loader → instance-owned Typed Runtime → Typed Controller` 单轨调用；旧 `page-runtime`、全局 backend 注入和未参与 `tsc` 的生产 JS 已删除。
- Runtime 的 SDK、Worker、native Input、实验缓存和 request ID 均为实例状态；`dispose()` 会取消任务并释放相关资源。
- 六张桌面整页截图已由锁定的 Linux Chromium 执行严格 `maxDiffPixels: 0` 门禁，普通测试不会覆盖 baseline。
- 正式发布新增 `wasm:release`：从三个 `origin/main` 创建 detached clean worktree，且不接触开发工作树。

## 当前发布阻塞项

1. **补齐 Ray `origin/main` 的 clean-build 漏件**
   - `wasm:release` 已验证三个 clean worktree 分别固定在 Ray `95e8c45`、Normal Mode `103f530`、PE `dbf587e`。
   - Ray `origin/main` 的 `bindings/wasm/bellhop_2d/CMakeLists.txt` 把 `package/native_loader.mjs` 声明为构建依赖，但该文件没有被提交到 `origin/main`，因此 clean 构建在 `bellhop_2d_wasm_typecheck` 前按预期失败。
   - 开发工作树中存在被忽略的本地副本，解释了开发构建为何可以通过；发布流程不会复制该未追踪文件，也不会伪造 clean provenance。
   - 需要在 Ray 仓库补一个只提交该 loader（并验证 clean clone 构建）的窄 PR；合并后重新执行 `npm run wasm:release` 和 `npm run check:release`。

2. **最终内网主机验收**
   - 当前生产 `dist` 与本机 preview 已通过，仍需在实际内网静态服务器验证三个 URL、`.wasm`/`.mjs` MIME 和缓存头。
   - 内网 HTTP 按单线程 WASM 验收，不要求 SSL。以后启用 HTTPS 且 COOP/COEP 验证通过后，才验收 pthread。

## 稳定版前的剩余工程项

- 合并上述 Ray loader 漏件并完成一次全链路 clean provenance 发布验证。
- 在实际内网静态主机完成 MIME、缓存、SPA fallback 和三个真实 WASM 路由 smoke。
- 后续数值测试可继续增加有限值比例、参数变化响应与缓存复用断言；这不阻塞当前架构单轨收口，也不得把新 Field 版本造成的合理数值变化当 UI 回归。

## 首个稳定版本完成定义

- 三个 Field 来源均为可追溯 clean commit，provenance 与最终发布产物一致。
- 三个原页面只调用 Runtime facade，Feature 中没有具体 SDK 类型、Input、Worker 或 WASM 路径。
- 支持的模型原生文档均完成解析与真实模型运行测试。
- `npm run check:release` 通过，最终内网主机上的三个 URL 完成真实 WASM smoke。
- 浏览器网络记录中没有环境文档或计算结果上传请求。
- 两个桌面宽度的 DOM、控件和视觉回归经人工批准；批准之前生产页面没有任何视觉变更。
