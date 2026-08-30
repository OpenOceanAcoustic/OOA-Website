# OOA 声场 WebAssembly 交互实验室

Ray Mode、Normal Mode 和抛物方程（PE）计算均在用户浏览器的 Web Worker / WebAssembly 中执行。服务器只提供 HTML、JavaScript、WebAssembly 等静态资源，不接收环境参数，也不承担声场计算。

## 页面与当前能力

- `/`：Bellhop2D Ray Mode。展示声线、传播损失、质点振速和精确本征声线，并支持导入 Bellhop ENV、伴随文件和统一环境 JSON。主声场可选择几何、Gaussian 等 Bellhop 波束类型，以及相干或非相干 TL；ENV 原始环境与网页预设分开保存，可以切换后再恢复。
- `/normal-mode/`：Kraken Normal Mode。默认使用 Pekeris 浅海波导，支持导入 Kraken `.env` + 同名 `.flp` 或统一环境 JSON；展示原始模态数、实际参与合成的前 N 个模态、复水平波数谱、本征函数、任意选中单模态的传播损失场，以及模态截断对完整声场的影响。
- `/pe/`：RAM PE。默认使用 Pekeris 浅海波导，支持导入 RAM `.in` 或统一环境 JSON；固定环境与网格，顺序计算 `nPade=1..10`，展示当前声场、相对 `nPade=10` 的差值场、收敛曲线及垂向剖面。

三个页面都提供 Pekeris、Munk 深海声道、表层跃变、等声速水体和自定义 500 m 节点环境。Normal Mode 与 PE 的非 Munk 环境通过采样 SSP 原样送入 C++ WASM，不是仅用于绘图的前端近似。首版求解内核启用 Kraken 和 RAM；Krakenc、RAMGeo 和 RAMS 尚未接入网页，不会作为可选项显示。Normal Mode 的单模态场直接使用 Kraken 返回的复水平波数和本征函数，按点声源模态公式合成：

```text
p_m(z, r) = phi_m(z) i sqrt(2 pi) exp(i pi/4) phi_m(z_s)
              exp(-i k_m r) / sqrt(k_m r)
```

网页显示未经全场归一化的 `TL_m = -20 log10(|p_m|)`，切换模态不需要重新启动 WASM 求解器。PE 页面把 `nPade=10` 作为同网格高阶参考，用于观察 Padé 截断趋势，并不将其声明为解析真值。

## 首次构建

需要 Node.js 20+、CMake、Ninja 和 Emscripten SDK。当前环境的 Emscripten SDK 位于 `/opt/emsdk`，必要时可手动加载：

```bash
source /home/qp/.config/oob/wasm-env.sh
```

先编译三个本地 WASM npm SDK，再安装并构建网站：

```bash
cd /mnt/repo/qp/OOA-Website
npm run build:wasm
npm install
npm run build
```

也可以只重建一个计算方法：

```bash
npm run build:wasm:ray
npm run build:wasm:normal
npm run build:wasm:pe
```

`build:wasm:*` 会执行 Emscripten/CMake 编译、TypeScript 检查、npm 打包和相应冒烟测试。本地包位于 `.wasm-packages/`，中间构建目录位于 `.wasm-build/`。三个 npm 包分别为：

- `@openocean/field-bellhop-2d`
- `@openocean/field-normal-mode-kraken`
- `@openocean/field-pe-ram`

Normal Mode 和 PE 的 WASM SDK 均以各自最新 `main` 为基线。网站所需的 Kraken ENV/FLP 与 RAM `.in` 文本导入能力保存在从 `main` 派生的 `website-main-wasm` 集成分支中；根仓 `.gitmodules` 的远端跟随分支仍设为 `main`，正式提交时由 gitlink 固定已经验证的具体提交。

## 开发与生产预览

开发运行：

```bash
npm run dev
```

生产构建与静态预览：

```bash
npm run build
python3 server.py
```

然后打开 <http://127.0.0.1:8000>。`server.py` 仅服务 `dist/`，不提供声场计算 API。

Ray/Normal 的原生线程能力依赖跨源隔离。无论使用 Vite、Nginx、Caddy 还是其他静态服务器，都必须返回：

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

同时应以 `application/wasm` 提供 `.wasm` 文件。域名解析只是把域名指向服务器；正式部署还需要 HTTPS、静态站点配置以及上述响应头。PE 内核自身保持单线程，多个 `nPade` 工况在一个 Web Worker 内顺序运行，避免阻塞页面交互。

## 运行结构

```text
页面参数
  -> 本地 npm SDK
  -> Web Worker
  -> OOB C++ WebAssembly
  -> TypedArray 结果
  -> Canvas 可视化
```

声场网格和复数数组通过可转移的 TypedArray 在 Worker 与页面之间传递，不经过 JSON，也不会上传到服务器。Kraken SDK 的复压力布局为 `[frequency][range][depth][real/imaginary]`，Normal Mode 网页在绘图边界转换为 `[depth][range]`；RAM 2.0 SDK 公开的场已经是 `[depth][range]`，网页不再进行二次转置。

## 导入模型原生环境文件或 JSON

三个模型页面都提供“导入环境文件 / JSON”入口：

- Ray Mode / Bellhop：一次选中一个 `.env`，以及需要的同名伴随文件，例如 `.ssp`、`.bty`、`.ati`、`.trc`、`.brc`、`.sbp`。
- Normal Mode / Kraken：同时选中一个 Kraken `.env` 和同名 `.flp`。可直接使用 [`tests/MunkK.env`](tests/MunkK.env) 与 [`tests/MunkK.flp`](tests/MunkK.flp) 作为成套模板。
- PE / RAM：选择一个 RAM `.in`。可直接使用 [`tests/ram.in`](tests/ram.in) 作为模板。
- 统一 JSON：单独选择一个 `.json`，三个模型都可使用。可直接使用 [`tests/Pekeris.environment.json`](tests/Pekeris.environment.json) 作为模板。

统一 JSON 的核心字段如下，单位固定为 SI（地形距离使用 km）：

```json
{
  "title": "Pekeris JSON Example",
  "profilePoints": [[0, 1500], [200, 1500]],
  "waterDepthM": 200,
  "frequencyHz": 100,
  "sourceDepthM": 50,
  "maximumRangeKm": 20,
  "bottomSoundSpeedMps": 1700,
  "bottomDensityKgM3": 1800,
  "bottomAttenuationDbPerWavelength": 0.5,
  "bathymetry": [[0, 200], [20, 200]],
  "angleRangeDegrees": [-20, 20],
  "beamCount": 1000
}
```

剖面节点必须按深度严格递增，并从 `0 m` 延伸至 `waterDepthM`；`bathymetry` 节点格式为 `[距离 km, 深度 m]`。Bellhop、Kraken、RAM 原生环境文件以及统一 JSON 的解析和声场计算都在浏览器本地完成，文件不会上传。

Ray Mode 会把导入地形、角度范围、beam 数以及用户选择的 `BeamType`、`COHERENT_TL` / `INCOHERENT_TL` 送入 Bellhop WASM；Normal Mode 按 Kraken 距离无关模型读取 `.env` 与 `.flp`；PE 按 RAM `.in` 的原生输入语义建立传播环境并送入 RAM WASM。
