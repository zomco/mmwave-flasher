# ADR 0001 — 独立网页仓库

日期：2026-11-14。状态：本地实现，线上切换待授权。

## 背景与选择

烧录页已包含设备选型、USB 上位机、配置与 HA 入门，具有独立于 ESPHome 组件的迭代节奏。旧目录同时承担前端构建、固件发布目标和协议测试输入，直接移动会使固件打包或网页测试失效。

考虑过继续在组件内维护网页、复制全部固件代码到网页仓库、依赖工作区的邻居相对路径。前者不符合维护目标；后两者分别产生双重源码和不可独立检出的构建。采用明确的单向依赖。

## 决定

| 归属 | 维护内容 |
| --- | --- |
| mmwave-flasher/static | 全部网页源码、图片、目录、模拟器、JS 协议客户端、UI/浏览器测试及 npm lockfile |
| mmwave-flasher/scripts | 网页发布组装、本地候选预览、依赖和契约检查 |
| mmwave-flasher/.github | 网页测试、Pages 构建部署、前端依赖更新 |
| mmwave-component | ESPHome 雷达与 MWCP 固件、YAML、原始协议、硬件验证资料、固件打包与 Alpha/Beta 发布 |
| mmwave-component/release-targets.json | 固件目标身份、板型与 UART；不包含展示文案、图片或坐标 |
| mmwave-flasher/static/device-catalog.json | 已验收硬件的展示、接线图及用户选型信息 |

运行时只需要两个 JSON 协议快照，它们在 docs/protocol/，源与完整提交由 component-pin.json 固定。网页构建完全离线于组件源码。契约回归与发布组装使用明确检出的 `.component/`，检查 SHA、清洁状态及快照一致性，复用固件端的 ZIP/manifest 校验实现。不会维护第二套固件校验器。

初始 pin 为提取前提交 `5c8826597a8d9c5f31eadf1bb91478e0c1bb5ce1`，其中仍含旧 static；它只是不可变的兼容性基线，不是网页维护分支。后续 pin 可指向拆分后的组件提交，检查脚本兼容新的 release-targets.json。协议原始文档和 C++ 测试夹具不迁移、不在网页仓库复制。

固件 Release 始终从 zomco/mmwave-component 下载，和承载 Pages 的仓库分开。保留 release.json / firmware-bundle.zip 契约，以及 firmware/<tag>/ 和 Beta OTA 别名。组件发布不会跨仓库自动触发网页；发布固件后，操作员明确触发 flasher Pages 刷新。暂不引入跨仓库写令牌、轮询部署或自动固件发布。

## 回溯与结果

- 提取前源码可用 `git show 5c8826597a8d9c5f31eadf1bb91478e0c1bb5ce1:static/<path>` 回溯。
- 历史 docs/reviews/web-console、工作区 docs/plans/mmwave-web-console 不迁移。旧命令作为当时证据保留；当前执行方式以新仓库 README 为准。
- 原组件 docs/FLASHER* 和 WEB_CONSOLE* 保留迁移指针；外部旧链接仍能找到新维护位置。
- tools/g2 是固件硬件回归工具，仍属组件。其 JS 帧校验器迁入 flasher/tools/g2；旧入口需要显式 MMWAVE_FLASHER_ROOT，以免误用过期的网页校验器。
- 普通开发、网页构建不要求 sibling checkout；完整回归增加一个固定的只读依赖。刷新 pin 需要维护者同步快照和回归，避免新固件悄悄改变旧网页测试基线。
- 域名与 Pages 所有权是部署操作，不能随文件移动自动完成。切换、回滚和验收见 PUBLISHING.md。

## 后续维护边界（2026-11-14）

工作区集中管理维护能力后，上表的本地候选预览与 tools/g2 归属已由 [工作区 ADR](https://github.com/zomco/mmwave-workspace/blob/main/docs/development/0001-centralized-maintenance.md) 更新：候选预览和完整 G2 工具位于 mmwave-workspace，包含 JS 帧校验器。网页产品代码及独立 CI/发布依赖继续留在 flasher。上文作为迁移当时的决定保留，不再作为 G2 当前命令入口。
