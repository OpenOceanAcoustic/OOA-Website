# OOA-RayMode WebAssembly 交互实验室

Bellhop2D 声线、传播损失、质点振速和本征声线计算全部在浏览器
Web Worker 中执行。页面不再把环境参数发送给 Python 计算后端；服务器仅提供
HTML、JavaScript 和 WebAssembly 静态文件。

## 首次构建

Emscripten SDK 默认位于 `/opt/emsdk`。新终端会自动加载已配置的用户环境；
也可以手动执行：

```bash
source /home/qp/.config/oob/wasm-env.sh
```

先编译并打包本地 WASM npm SDK，再安装网站依赖：

```bash
cd /mnt/repo/qp/OOA-Website
npm run build:wasm
npm install
```

`npm run build:wasm` 会执行 Emscripten/CMake 编译、TypeScript 类型检查、
`npm pack` 和干净项目安装冒烟测试。构建产物位于 `.wasm-build/`，本地包位于
`.wasm-packages/`，可复用的 Emscripten、ccache 与 npm 缓存位于
`.wasm-cache/`。

## 开发运行

```bash
npm run dev
```

浏览器打开终端显示的地址。Vite 已配置 WebAssembly pthread 所需的：

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

因此页面中的 `crossOriginIsolated` 和 `SharedArrayBuffer` 可以正常使用。

## 生产构建与静态预览

```bash
npm run build
python3 server.py
```

浏览器打开 <http://127.0.0.1:8000>。`server.py` 只服务 `dist/` 静态文件并
添加跨源隔离响应头，不再提供 `/api/simulate` 或 `/api/eigenrays`。

部署到其他 Web 服务器时也必须配置上述 COOP/COEP 响应头，并以
`application/wasm` 类型提供 `.wasm` 文件。

## 运行结构

```text
页面参数
  → TypeScript npm SDK
  → Web Worker
  → Bellhop2D C++ WebAssembly
  → TypedArray 结果
  → Canvas 绘图
```

场数据使用 TypedArray 在 Worker 和页面之间转移，不经过 JSON 或网络传输。
WASM npm 包名为 `@openocean/field-bellhop-2d`。页面会按设备逻辑核心数选择
原生线程数并限制为最多 4 条；线程池由 solver 持有，替换输入或清除缓存时不会
重复创建。
