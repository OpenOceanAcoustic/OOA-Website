# 完善性收尾审计

更新于 2026-08-31。产品定位是桌面端水声建模交互教学网站；服务器只托管静态资源，计算与实验数据留在学习者设备中。本清单不包含移动端、账号系统、后端计算、PWA、SSR 或页面换肤。

## 已完成的收敛项

- 三个 `f45c697` 原始桌面页面和公开 URL 已恢复；React 机械渲染原节点顺序、属性和文字，没有启用 Workbench 或结果标签页。
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
- 1440×900 与 1280×900 的六张 Figma 迁移参考图已经冻结，Figma 文件页结构和 1:1 验收规则已经记录。

## 当前发布阻塞项

1. **清理 Field 来源工作树**
   - 本次接口已分别形成窄提交：Bellhop `7c98675`、Kraken `5086101`、RAM `ac9daf4`。
   - Bellhop 和 Normal Mode 仓库仍有本任务之外的 dirty 修改，发布门禁会按预期拒绝；不得回滚或夹带这些修改。
   - 由仓库所有者处理无关修改后，重新运行 `npm run wasm:sync`，要求 provenance 三项均为 `sourceDirty: false`。

2. **最终内网主机验收**
   - 当前生产 `dist` 与本机 preview 已通过，仍需在实际内网静态服务器验证三个 URL、`.wasm`/`.mjs` MIME 和缓存头。
   - 内网 HTTP 按单线程 WASM 验收，不要求 SSL。以后启用 HTTPS 且 COOP/COEP 验证通过后，才验收 pthread。

3. **Figma 文件连接与人工批准**
   - 等待可编辑空白 Figma 主文件链接；当前没有连接 Figma，也没有从 Figma 改动生产视觉。
   - 链接提供后，按 `docs/figma/README.md` 建页、导入基线、1:1 重建并叠加验收。

## 稳定版前的剩余工程项

- 增加固定 Canvas fixture golden 与非 Canvas 像素比较；当前已有 DOM/控件/页面尺寸合同和 Figma 静态参考，但还没有自动像素阈值门禁。
- 在三页逐页人工验收后，再删除未被生产路由使用的 Workbench、替代 Panel、Zustand workflow 和简化 Canvas 脚手架；验收前不做破坏性清理。
- 增加数值健全性断言：有限值比例、参数变化响应、Padé/模态差值和缓存复用，不把新 Field 版本造成的合理数值变化当 UI 回归。

## 首个稳定版本完成定义

- 三个 Field 来源均为可追溯 clean commit，provenance 与最终发布产物一致。
- 三个原页面只调用 Runtime facade，Feature 中没有具体 SDK 类型、Input、Worker 或 WASM 路径。
- 支持的模型原生文档均完成解析与真实模型运行测试。
- `npm run check:release` 通过，最终内网主机上的三个 URL 完成真实 WASM smoke。
- 浏览器网络记录中没有环境文档或计算结果上传请求。
- Figma 基线经人工批准；批准之前生产页面没有任何视觉变更。
