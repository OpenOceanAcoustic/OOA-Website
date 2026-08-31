# 完善性收尾审计

基线提交：`25ab33a`。产品定位是桌面端水声建模交互教学网站；服务器只托管静态资源，计算与实验数据留在学习者设备中。本清单不包含移动端、账号系统、后端计算或 Figma 换肤。

## 当前已具备

- 三个原始桌面页面和公开 URL 已恢复，未启用重新设计的 Workbench。
- Bellhop2D、Kraken 和 RAM 来自相邻 Field 工作树生成的正式 WASM npm 包。
- npm 链接、源码状态、tgz 和 active 内容均有 SHA-256 校验；构建拒绝陈旧包。
- 开发模式使用兼容的单线程实现，生产模式可根据模型包建议与跨源隔离能力选择运行方式。
- 真实浏览器测试覆盖三模型启动、重新计算和常用环境文档导入。
- 生产产物仅包含首期三个模型族。

## P0：发布前必须完成

1. **固定可复现的 Field 版本**
   - Bellhop 和 Normal Mode 当前仍是 dirty 工作树；开发构建允许 dirty，正式发布必须来自已提交的 Field 状态。
   - 三个 Field 仓库分别提交模型改动后重新运行 `npm run wasm:sync`，归档 provenance 与最终 `dist`。

2. **让 Runtime 真正拥有模型计算**
   - 删除 `runtime-*/legacy-sdk` 的具体 SDK 透传。
   - 每个 Runtime 对页面只暴露 `importEnvironment`、`runExperiment`、`cancel`、`dispose` 这一类小接口。
   - Bellhop 输入映射、显示声线/声场/振速/本征声线组合，Kraken 完整/截断/单模态结果，以及 RAM 1–10 Padé sweep 都收进对应 Runtime 实现。
   - 原页面 DOM、CSS 和 Canvas 交互保持不变，只替换控制器调用的计算接口。

3. **无损保留模型专属环境信息**
   - Bellhop ENV/SSP/BTY 的 2D SSP、边界和 Beam 信息必须进入类型化 native template。
   - Kraken ENV/FLP 的网格、源接收器和模态选项必须保留。
   - RAM `.in` 的介质段、测深和离散参数必须保留。
   - 通用可编辑环境不能覆盖或丢弃原始模型信息。

4. **补齐失败与生命周期语义**
   - 所有 SDK/Worker/WASM 错误统一为 `RuntimeError`，页面不得显示成功或演示结果。
   - 同模型新任务取消旧任务，过期结果不能覆盖新结果。
   - 明确采用普通文档导航还是 SPA 路由生命周期；两种方式只能保留一种，并用测试验证 Worker 释放。

5. **验证真实部署环境**
   - 在最终静态主机上验证 HTTPS、WASM MIME、SPA fallback、COOP/COEP 和 pthread/single-thread 选择。
   - 为带哈希的 JS/WASM 设置长期 immutable 缓存，为 `index.html` 设置短缓存或 no-cache。
   - 用生产 `dist` 而不是已运行的开发服务器执行 Playwright smoke。

## P1：首个稳定版本应完成

- 删除未被生产路由使用的 Workbench、替代 Panel、Zustand workflow 和简化 Canvas，避免两套页面实现并存。
- 增加桌面端原界面截图与 Canvas fixture golden，保护布局、文字、色标和交互语义。
- 增加数值健全性测试：输出形状、有限值比例、参数变化响应、场差参考和缓存命中行为。
- 给高内存或长时间任务提供预算提示、取消反馈和设备能力说明。
- 增加简短隐私说明：环境文档和计算结果默认不离开浏览器。
- 检查键盘操作、ARIA 和桌面浏览器兼容性，不扩展到移动端布局。

## Later：功能稳定以后

- 将原 HTML 按现有视觉区块机械迁移为 JSX；迁移不得改变 DOM 顺序和计算样式。
- 在确有复用价值时，把原 Canvas 算法逐步收进 `@ooa/visualization`，不要先建立第二套简化绘图。
- 通过 Figma Variables、Design Tokens 和 Storybook 分批替换资源；不接受 Figma 自动生成业务页面代码。

## 首个稳定版本完成定义

- 三个 Field 源仓库均为可追溯的 clean commit，provenance 与发布产物一致。
- 三个原页面只调用 Runtime 接口，feature 中不存在具体 SDK 类型或构建器。
- 所有支持的环境文档均通过 round-trip/模型运行测试。
- `npm run check:release` 通过，最终主机上的三个 URL 完成真实 WASM smoke。
- 浏览器网络记录中没有环境文档或计算结果上传请求。
