# 仓库迁移验证 · 2026-11-14

结论：本地迁移的基本功能验证通过；尚未提交、推送或部署，不改变线上 RDP 候选的既有验收结论。

源基线：mmwave-component `5c8826597a8d9c5f31eadf1bb91478e0c1bb5ce1`。目标：mmwave-flasher。原仓库 97 个被 Git 跟踪的 static 文件全部在新仓库中找到，原活动 static 目录已移除。未变更 ESPHome 雷达、MWCP 固件实现、配置 YAML、固件 Release 或 HA 环境。

## 本次实际验证

| 检查 | 结果 |
| --- | --- |
| 组件 `tests/test_releases.py` | 21/21 通过，固件目录不依赖网页 |
| flasher `python -m unittest discover -s tests -v` | 11/11 通过，含组装、Beta 别名、错误传播及契约漂移拒绝 |
| flasher `npm run test:unit` | 151/151 通过，包含与固定组件提交的 C++ 互操作回归 |
| flasher `npm run test:browser` | 9/9 通过，模拟串口连接/保存、释放保护、清单校验、浏览器生命周期 |
| 最终链接拆分定向回归 | app-flash-ready 2/2 通过；页头 GitHub 指向 flasher，固件版本说明仍指向 component；随后生产重建通过 |
| flasher `npm run build` | 通过，生成 static/dist |
| 独立目录构建 | 仅复制 static 和 docs/protocol，无邻接组件、无 .component；npm ci --offline --no-audit --no-fund 安装 50 个包，生产构建通过 |
| 契约及目录 | pin/checkout 一致、依赖干净、两个 JSON 快照字节一致、型号/板型匹配 |
| 工作流与工作区 | 新旧工作流 YAML 解析通过；flasher 变更选中 installer，组件 C++ 变更选中 firmware，互不误选 |
| 文档与迁移完整性 | 新仓库 Markdown 本地链接存在；组件旧指南保留迁移指针；历史报告未批量改写 |
| 历史 G2 入口 | 显式 MMWAVE_FLASHER_ROOT 可加载新仓库校验器（仅空输入入口检查，不声称验证新硬件帧） |

环境：Windows，Node 24.22.1，现有 npm lockfile，g++ 来自 D:/msys64/ucrt64/bin。首轮错误配置了不存在的 mingw64 编译器路径，改为实际 ucrt64 后单元测试全部通过。浏览器首轮在受限环境启动失败且进程未结束，清理本次进程后在允许启动本地无头浏览器的环境重跑通过。没有跳过失败测试或降低断言。

构建保留 lucide-react 的 `use client` bundler 提示，未影响生产构建；本次不扩大到依赖升级。未编译固件、未连接 USB、未运行真机长测。远端 Linux Actions、公开 Release 下载和域名切换需在后续获批发布时核验；本轮离线组装测试不替代线上发布验收。

## 后续操作边界

先审查并分别提交两个子仓库，再更新工作区 gitlink。推送/Pages/域名变更按 [PUBLISHING.md](PUBLISHING.md)单独批准。首次部署须确认新仓库实际 checkout SHA、build-info.json、已发布固件的下载路径和 hash。之后发布新固件，在 flasher 仓库单独触发 Pages 刷新；无需为网页迁移重编固件。
