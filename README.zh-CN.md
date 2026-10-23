# KARMEN Memory

**v0.3.0** · [Offline replica setup / 离线副本设置](docs/replication.en.md) · [中文](docs/replication.zh-CN.md)
[English](README.md) | 简体中文

本地 SQLite 记忆服务与管理后台，让多个 Agent 工具使用同一份经过确认的个人上下文。当前版本 **v0.3.0**，处于本地 Alpha 阶段。

[使用指南](docs/tutorial.zh-CN.md) · [接入说明](docs/integration.md) · [验收记录](docs/validation.md) · [下载](https://github.com/KarmenLoop/karmen-memory/releases)

![使用真实数据库的管理后台](docs/images/overview-desktop-v0.3.0.png)

截图中的合成记录由验收人员通过真实表单创建。新安装不会预填记忆、连接、调用记录或节省比例。Koder、Koder CLI、Cursor 始终排在前面。

## 已实现的功能

- 创建、编辑、收藏、归档、恢复记忆，并查看不可变的修订快照。
- 用本地句子规则提炼明确要求，去重后进入候选，人工确认后才能检索。
- 多语言词项检索，返回编号、项目、来源、版本、匹配词和上下文。
- 独立凭证、项目范围、只读、CI 限制、暂停与撤权，在服务端实际检查。
- 可选 HTTPS 局域网服务、证书指纹核对、一次性设备配对。
- JSON 导入导出、完整校验与事务、SQLite 一致性快照。
- 真实调用和检索耗时，以及明确标注为用户录入的任务成本对照。

## 启动

需要 Node **22.16+** 和 npm。Node 22 的内置 SQLite 驱动仍会显示实验性提示。局域网证书生成另外需要支持 `req -addext` 的 OpenSSL。

```sh
git clone https://github.com/KarmenLoop/karmen-memory.git
cd karmen-memory
npm ci
npm run build
npm start
```

打开 [http://127.0.0.1:4318](http://127.0.0.1:4318)。默认数据库为 `~/.karmen-memory/memory.sqlite`。使用 `KARMEN_MEMORY_HOME` 指定其他私有目录，同一个数据目录只运行一个服务。

开发模式运行 `npm run dev -- --port 5186`，打开 [http://127.0.0.1:5186](http://127.0.0.1:5186)，服务仍在 4318。Ctrl-C 停止。运行 `npm test` 检查实际存储、API、CLI、MCP 和本机 TLS。

## 接入工具

先在 Agent 接入页面签发具体项目的独立凭证，把仅显示一次的令牌保存到权限为 `0600` 的私有文件，用 `KARMEN_MEMORY_TOKEN_FILE` 指向它：

```sh
node bin/memory.mjs status
node bin/memory.mjs search "提交规范" --project "My Project"
```

MCP 宿主可启动 `node /absolute/path/karmen-memory/bin/mcp.mjs`，提供 `memory_search`、`memory_propose`、`memory_extract`、`memory_feedback`。CLI、MCP 和页面访问同一个数据库服务；读写凭证提交的内容需要审核，不能直接修改已确认事实。

本仓库的 CLI 是 KARMEN Memory 客户端，不替代 Koder CLI 或 Koder Open CLI。安装技能不会自动修改宿主配置。请逐个验证实际工具的协议与返回编号，凭证请求不等于宿主集成完成。

## 局域网

默认关闭。开启后生成私有 TLS 证书并启动 HTTPS。将公开证书通过可信方式复制到另一台电脑，核对 SHA-256 指纹，再生成 5 分钟内有效的一次性配对码。另一台电脑执行：

```sh
node bin/memory.mjs pair --url https://HOST_IP:4319 \
  --ca ./karmen-memory-ca.pem --code PAIRING_CODE --name "My second computer"
```

只共享“全设备”范围内、项目获准的事实。关闭共享会关掉监听端口；撤销凭证后下次请求被拒绝。正常退出服务也会关闭共享。原有模式访问主节点，主节点离线时远端不能检索；新离线副本模式按上方教程单独配置。

## 技能、数据与限制

[`karmen-memory`](skills/karmen-memory/SKILL.md) 用于实际检索与提交事实；[`shared-memory-console`](skills/shared-memory-console/SKILL.md) 用于管理界面设计。复制完整目录到宿主支持的技能位置并保留许可证。实际服务和凭证需另外配置。

数据库保存事实、依据、候选、修订、审计、评估和凭证哈希，不会自动读取聊天历史或调用付费模型。操作系统用户是本地信任边界；应用未实现静态加密，请使用系统磁盘保护。SQLite 快照包含私人数据与凭证哈希，需要妥善保管。JSON 导出不包含凭证。旧浏览器原型数据需要显式检查后导入。

本机真实数据库、HTTP 权限、独立 CLI/MCP、TLS 配对与进程重启已有运行检查。原生 Koder/Koder CLI/Cursor 等宿主接入、两台实体电脑互通、Windows 运行、Mac 安装包、向量语义检索、模型提炼和成本收益仍需各自实现或验收。目前没有跨工具准确率或节省 1/3 的实测结论。

[贡献](CONTRIBUTING.md) · [安全](SECURITY.md) · [Apache-2.0](LICENSE) · [NOTICE](NOTICE) · [第三方许可](THIRD_PARTY_NOTICES.md)
