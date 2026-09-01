# 完整性收尾审计

更新于 2026-09-01。OOA Website 定位为桌面端水声建模交互教学网站；服务器只托管静态资源，计算与实验数据留在学习者设备中。本阶段不包含移动端、Figma、账号、后端计算、PWA、SSR 或页面换肤。

## 已完成

- `f45c697` 的三个桌面页面、公开 URL、DOM 契约、CSS 和 Canvas 算法继续作为唯一界面基线。
- 从三个 Field 仓库最新 `main` 的 clean detached worktree 成功构建 Bellhop2D、Kraken 和 RAM npm 包。
- `wasm-package-lock.json` 已冻结三个来源 commit、tgz/content SHA-256 和每个发布文件哈希；普通 `check` 会拒绝字节变化。
- `wasm:release` 已改为重建锁定 commit，不再随远端 `main` 漂移；下一次升级必须单独执行 `wasm:freeze`。
- Normal Mode 与 PE 已由严格 TypeScript Feature Hook、React 区块和模型 Canvas renderer 接管，旧 page controller 已删除。
- Ray Route 已由 `useRayPage` 统一创建和释放 Runtime；原理论动画、声场、振速与本征声线算法隔离在模型 Canvas experience 中。
- `@ooa/ui` 只含模型无关受控控件，`@ooa/styles` 只含真实复用 CSS，`@ooa/assets` 只维护通过验证的资源 catalog。
- Tailwind CSS 4.3.3 已接入且关闭 Preflight；未强制重写无法精确等价的现有 CSS。
- 正常入口不回退模拟结果；只有显式 `?demo` 创建 demonstration adapter。
- Bellhop ENV+SSP+BTY、Kraken ENV+FLP、RAM `.in` 和统一 JSON 都有真实浏览器覆盖。
- 六张 1440/1280 宽度整页截图使用 Linux Chromium、真实 WASM、固定计时文本和 `maxDiffPixels: 0`。
- 浏览器测试记录网络请求；模型输入和结果不上传到外部计算服务。

## 当前冻结来源

| 模型 | npm 包 | commit | tgz SHA-256 |
|---|---|---|---|
| Ray | `@openocean/field-bellhop-2d@2.0.0` | `470ab6d128687cf1041a864e3074c5b03a973050` | `7e228c48f3612129303cc5f7a77e731f5f79c80a2444fb017ebda7ac70d7959f` |
| Normal Mode | `@openocean/field-normal-mode-kraken@2.0.0` | `8f7093bdb921829be23b1ea257c6bc7d2ed4e87a` | `33846d0b6071bbd1bd5a54da38003b4f9c79a4a5dc3c59202ce82dc6619b564a` |
| PE | `@openocean/field-pe-ram@2.0.0` | `ceb09d68ab4450f1a4f573898f95b9727cfa13c2` | `816b7e142c12229511d535aa33be842d0f3ff648c9bf2b172d11966865354cb3` |

三项 provenance 均为 `sourceDirty: false`。当前相邻开发工作树是否 dirty 不影响冻结发布，也不会被发布脚本切换或清理。

## 发布前仍需完成

1. 在实际内网静态服务器部署最终 `dist`，验证 `/`、`/normal-mode/`、`/pe/` 的 fallback。
2. 验证 `.wasm`、`.mjs` 和 Worker MIME；HTML 不缓存，带哈希资源长期缓存。
3. 在目标 Chrome/Edge 桌面端各跑一次真实 Bellhop2D、Kraken 和 RAM smoke。
4. 内网 HTTP 保持单线程 WASM；未来只有 HTTPS 与 COOP/COEP 均验证后才启用 pthread。

## 稳定版完成定义

- `npm run check:release` 全部通过，锁文件和 clean provenance 一致。
- `dist` 只含 Bellhop2D、Kraken、RAM 和它们需要的运行文件。
- 六张视觉门禁无差异，页面全部原操作路径通过。
- 实际内网主机无外部计算请求，三个模型均在用户浏览器本地完成计算。
