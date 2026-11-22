# Pages 迁移与发布操作单

本操作单是后续执行计划。当前迁移仅本地验证，未推送、未更改 Pages/DNS、未发布固件。先取得对应外部操作的授权。

## 首次上线

1. 分别审查组件与 flasher 变更。提交 flasher 全部源码、契约快照、工作流和 lockfile；提交组件删除旧 static/、拆分发布目标与工作流的变更；最后提交工作区子模块指针。不要包含 cases、HA 配置或其他产品修改。
2. 在授权范围内推送候选。新仓库 Settings → Pages 选择 GitHub Actions，并配置 github-pages 环境。对候选所在 main 运行 Publish GitHub Pages。工作流固定 github.sha；核对 checkout 日志及发布的 build-info.json，两者必须是已批准提交。组件 pin 是兼容测试基线，不能拿来替代网页 SHA。
3. 首次先通过仓库默认地址 `https://zomco.github.io/mmwave-flasher/` 验证。不要同时给两个仓库绑定 mmwave.owkor.com。核对页面、图片、脚本、选择 Alpha.3 后的 manifest/factory/OTA 下载及校验和；仅检查 HTTP 结果，不连接串口、不烧录。
4. 明确取得域名迁移授权后，在旧 mmwave-component Pages 移除自定义域名，再在 mmwave-flasher Pages 绑定 mmwave.owkor.com，确认 DNS、HTTPS 与实际服务仓库。保持旧已部署网页可供回退，避免两个 Pages 流程同时覆盖域名。
5. 核对新域名下 build-info.json、releases.json、Alpha.2/Alpha.3 目录和核心路径。新构建会重新从组件公开 Release 下载已发布字节，不会编译固件。确认固件标签与 SHA-256 一致；网页提供的链接不能出现 flasher/releases 固件来源。
6. 记录候选 SHA、运行 ID、实际 checkout SHA、线上资源与校验结果。更新工作区状态。删除的组件 Pages 工作流在组件迁移提交生效后停止后续旧仓库部署；已有站点/域名设置仍需单独管理。

## 日常更新

- `esp-web-tools` 固定为已验证的 `10.4.0`。烧录下载保护补丁依赖该包的源码与打包结构；`10.5.2` 缺少 `src/flash.ts`，不能直接升级。后续升级必须单独适配补丁并通过空下载拒绝、擦写前保护及浏览器回归，不能跳过 postinstall 保护来恢复部署。

- 网页 main 推送触发网页检查与 Pages；授权推送前应明确包含关联部署。
- 发布新固件仍在 mmwave-component 手动运行 Publish。发布成功后在 **mmwave-flasher** 手动运行 Publish GitHub Pages，刷新同一网页候选的版本目录。不同仓库的 workflow_run 不作自动连接。
- Node 24 + npm ci；运行契约检查、Python 组装测试、JS 单元和浏览器测试及生产构建。Pages 只读下载组件 Release，使用 GITHUB_TOKEN，无跨仓库写 PAT。
- 完整版本目录与稳定 Beta OTA 路径由 scripts/assemble.py 生成。API/校验失败停止上传部署，不将失败当成空列表。新目录无 Beta 时 models.json 为空是正常行为。

## 回滚

保留首个新站构建及旧站部署回执。若首次切换出现核心故障，可在授权范围内把域名绑定恢复到旧组件 Pages 部署，或在新仓库回退网页提交再部署。两者都不改变设备固件或 GitHub Release。不要以重新发布 Alpha、覆盖 tag 或重烧设备来解决网页迁移问题。
