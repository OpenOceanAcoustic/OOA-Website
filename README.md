# OOA-RayMode 交互实验室

一个使用 OOB 原生 Bellhop2D Python 接口的交互教学网页：左侧设置声速环境，中间展示声线，右侧联动显示传播损失。SSP 在 0–5000 m 范围内每 500 m 提供一个可水平拖动的声速节点；海底半空间的纵波声速、密度和吸收也可实时调节。进阶实验在 −20.3° 至 +20.3° 使用 1000 条等角度声线，对比 OOB 的传统 `EIGENRAY/ARRIVALS` 与精确 `PARTICLE_RAY/PARTICLE_ARRIVALS`（C++ `MODE_E_PC_*`）结果。接收器可直接在距离—深度图上拖动，松开后由原生求解器重新计算。

页面首屏给出经典 Hamilton 射线方程，并从 OOB 原生 `RAY` 结果中选择 9 条代表声线依次播放。动画只控制已计算轨迹的显示进度，同步标注 OOB 发射角、传播进度和局部步进方向，不在浏览器中重复求解射线方程。

传播链路实验台采用即时刷新：19 条代表声线来自 OOB `RAY` 模式；TL 场由 OOB `COHERENT_TL` 模式使用 1000 个发射角计算。海底半空间参数直接进入 OOB 输入，因此底质变化由原生边界反射模型反映到传播损失中。完整 60–120 dB colorbar 用于对照环境变化。

先安装同目录中的 OOB Python wheel（正式包名为 `openocean_field.ray_mode`，旧 `py_bellhop` 接口已移除）。OOB 构建过程会执行类型存根生成，因此在复用当前虚拟环境时需要显式安装构建工具：

```bash
python3 -m pip install "numpy>=1.23" \
  "pybind11-stubgen==2.5.5" "mypy==1.17.1" wheel
python3 -m pip install ./OpenOcean-Field-RayMode --no-build-isolation
```

```bash
python3 server.py
```

浏览器打开 <http://127.0.0.1:8000>。

后端不生成 `.ray/.arr/.shd` 中间文件。轨迹、到达和压力场均直接读取 OOB `ResultHandle` 所拥有的只读 NumPy 内存视图。
