# KARMEN Memory

[English](README.md) | 简体中文

一个可交互的个人记忆管理原型：查看事实来源，整理候选记忆，并尝试它们如何成为智能体上下文。当前数据保存在浏览器中，真实智能体和设备同步尚未接入。

[下载原型 v0.1.1](https://github.com/KarmenLoop/karmen-memory/releases/tag/v0.1.1) · [使用指南](docs/tutorial.zh-CN.md) · [Issues](https://github.com/KarmenLoop/karmen-memory/issues)

## 可以试什么

创建、修改、搜索、收藏、归档和恢复记忆；导入导出 JSON；审阅候选与范围冲突；查看本地关键词检索结果。工具访问设置和设备配对均为明确标记的模拟。

![当前版本的中文原型界面](docs/images/overview-desktop-v0.1.1.png)

*v0.1.1 的真实浏览器截图，使用合成数据。文档可切换语言，应用界面目前为中文。*

## 开始使用

最快方式是下载 preview ZIP，在解压后的 karmen-memory-preview 目录运行：

```sh
python3 -m http.server 5187 --bind 127.0.0.1
```

打开 http://127.0.0.1:5187。需要源码时选择 source ZIP，使用 Node 22.12+ 和 npm：

```sh
npm ci
npm run build
npm run preview -- --port 5187 --strictPort
```

## 第一次操作

在记忆库添加一条虚构偏好，搜索标题，刷新页面确认仍在，再归档、恢复并导出。检索页只做本地关键词匹配，不使用模型或嵌入服务。Koder、Koder CLI、Cursor 的顺序不代表已经连接真实工具。

## 数据与限制

数据位于当前浏览器来源的 localStorage，键名为 karmen-memory-console-demo-v1，不是加密存储。换端口、浏览器或设备不会自动带走数据。使用合成资料，不放凭据。配对码 246810 和 31.8% 数字是演示，后者不是成本基准结果。

## 文档与许可证

[下载、配置、实践与升级](docs/tutorial.zh-CN.md) · [Design](https://github.com/KarmenLoop/karmen-memory/blob/v0.1.1/docs/design.md) · [Validation](https://github.com/KarmenLoop/karmen-memory/blob/v0.1.1/docs/validation.md) · [Apache-2.0](LICENSE) · [NOTICE](NOTICE) · [Third-party notices](THIRD_PARTY_NOTICES.md)

包内 shared-memory-console 技能用于设计这类管理界面，不会自动启动记忆服务。
