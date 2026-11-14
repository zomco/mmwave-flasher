# MMWave Flasher

毫米波雷达在线烧录页面与 Web Serial 上位机。维护 React / Tailwind 页面、设备选型与接线说明、固件版本选择、USB 调试与配置、观测记录导出，以及 Wi-Fi / Home Assistant / 卡片入门引导。

## 开发

项目日常开发统一在 [mmwave-workspace](https://github.com/zomco/mmwave-workspace/blob/main/docs/development/README.md) 进行；Skill、内部维护指南、G2 和本地候选预览工具在那里维护。下列命令保留独立检出/CI 的可复现能力，工作区通过统一入口调用同一套实现。

要求 Node.js 24、npm。网页构建不需要组件仓库、HA 或设备：

```sh
cd static
npm ci
npm run dev
# 或 npm run build，产物 static/dist/
```

开发模式的固件列表默认为空，这是防止将模拟版本当成可烧录固件的保护。网页其余功能可以使用。需要真实已发布版本时，在构建后按下面的组装步骤生成列表，不要往 public/releases.json 写入假发布。

## 回归与发布组装

C++ / JS 协议一致性回归依赖 `component-pin.json` 指定的组件提交。`.component/` 是忽略的、可重建的测试依赖，不是产品源码维护位置；脚本不会覆盖已有 checkout。

```sh
python scripts/prepare_component.py
python scripts/check_contract.py
python -m unittest discover -s tests -v
cd static
npm run test:unit
npm run test:browser
npm run build
cd ..
# 读取 mmwave-component 的 GitHub Release，不编译或发布固件。
# 需要 gh CLI；CI 使用只读 GH_TOKEN。
python scripts/assemble.py zomco/mmwave-component static/dist
```

测试需要 g++ 及 Chrome/Chromium/Edge；可设置 `MWCP_GPP` 和 `MWCP_CHROME`，Windows 还需将编译器所在目录加入 PATH。浏览器测试使用模拟串口，不操作设备。离线组装可附加 `--local-releases <目录>`，目录包含 release.json 和 firmware-bundle.zip，或包含多组这样的子目录。

固件代码、发布目标、协议原始资料归 [mmwave-component](https://github.com/zomco/mmwave-component)；卡片归 [mmwave-card](https://github.com/zomco/mmwave-card)。更新协议时，在一个变更内更新组件 pin、两个运行时 JSON 快照和兼容测试。不要编辑 `.component/`，不要无声跟随组件 main。新增硬件必须先在组件完成验收，再更新网页目录。

## 使用与维护

- [USB 上位机使用指南](docs/WEB_CONSOLE_CN.md) · [English](docs/WEB_CONSOLE.md)
- [烧录与设备目录说明](docs/FLASHER_CN.md) · [English](docs/FLASHER.md)
- [仓库边界与迁移决定](docs/architecture/0001-independent-flasher.md)
- [Pages 首次切换与后续发布操作单](docs/PUBLISHING.md)
- [本次迁移验证记录](docs/migration-validation.md)

本仓库从 mmwave-component 提交 `5c8826597a8d9c5f31eadf1bb91478e0c1bb5ce1` 提取。原 static/ 的源码、图片、测试及 lockfile 保留，MIT 版权沿用 LICENSE。历史验收报告留在原组件仓库和 mmwave-workspace；旧路径按架构文档回溯。仅迁移不代表新固件或新真机验收。
