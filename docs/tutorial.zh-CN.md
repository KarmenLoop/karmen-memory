# KARMEN Memory: 原型使用指南

[English](tutorial.en.md) | 简体中文 · [首页](../README.zh-CN.md)

本指南对应 **v0.1.1**, 预发布原型.

## 1. 下载与安装

在发行页选择 preview ZIP，或需要修改源文件时选 source ZIP；共享界面技能是单独的 skill ZIP。将 SHA256SUMS 中对应行与本地完整哈希比较，macOS 用 shasum -a 256，PowerShell 用 Get-FileHash -Algorithm SHA256。

预构建包解压后进入 karmen-memory-preview，用 Python 3 启动本地静态服务：

```sh
python3 -m http.server 5187 --bind 127.0.0.1
```

打开 http://127.0.0.1:5187，不要直接双击 index.html。源代码方式需要 Node 22.12+：运行 npm ci、npm run build，再运行 npm run preview -- --port 5187 --strictPort。

## 2. 配置与第一次操作

不需要 API 密钥。创建一条合成记忆，填写类型、项目与共享范围，搜索并编辑它，刷新后查看记录。再收藏、归档、恢复，检查每个状态反馈。候选页可处理一条提议和一个范围冲突。

## 3. 检索、导入导出与技能

检索页展示本地关键词选出的上下文。导出后先读 JSON，再保存；导入最多 500 条、文件不超过 1 MB，为新增式导入，不是覆盖恢复。变更来源、端口或设备前先导出，确认新位置导入后再继续。

设计技能位于 skills/shared-memory-console，将完整目录复制到宿主支持的一个新技能目录并加载 SKILL.md。它不启动数据库、联网同步或真实适配器。

## 4. 排错与版本管理

端口占用时更换空闲端口；页面空白时确认从解压后的正确根目录提供服务。记忆不见时检查浏览器、端口与来源是否变化。设置重置会恢复样例，先导出要保留的数据。

升级前导出并核对 JSON，保留旧预览目录；在新目录验证新包再切换，回退时仍保留最新导出。Ctrl+C 停止本地服务。移除文件不会自动清除浏览器 localStorage；需要清理时使用对应来源的浏览器存储设置。

[Apache-2.0](../LICENSE) · [NOTICE](../NOTICE) · [Third-party notices](../THIRD_PARTY_NOTICES.md)
