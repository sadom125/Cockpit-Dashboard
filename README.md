# Cockpit Dashboard

Obsidian 驾驶舱仪表盘首页插件。替代 Obsidian 默认首页，提供知识库管理的"仪表盘"体验。

## 功能

| 功能 | 说明 |
|------|------|
| 👋 问候语 | 根据时间显示问候，**双击名字可自定义**，显示截止待办提醒（🔴🟡🟢） |
| 📂 知识分类 | 一级文件夹卡片，点击打开分类概览，**支持折叠** |
| 📊 统计卡片 | 笔记数/待办/完成率/专注时长，**支持折叠** |
| 📅 日历看板 | 月视图，带待办点标记 |
| ✅ 待办管理 | 支持标签过滤（#标签）、优先级（high/mid/low）、截止日期，**支持折叠** |
| ✏️ 最近更新 | 最近编辑的文件列表，**支持折叠** |
| ⭐ 收藏文件 | 收藏/取消收藏双向同步 |
| ⚡ 闪念胶囊 | 随手记想法，保存到 `_daily/YYYY-MM-DD.md`，**支持折叠** |
| 📈 编辑热力图 | 近 30 天 5×6 格子，颜色深浅反映编辑活跃度，**支持折叠** |
| 🔍 迷你搜索 | 工具栏搜索按钮展开内嵌搜索，实时匹配笔记 |
| 🛩️ 驾驶舱 H5 | 一键启动 `http://localhost:3456` H5 版驾驶舱 |
| 📝 工作日志 | 一键调用 Python 脚本自动写日志 |
| 🍅 番茄钟 | 浮动可拖拽全局单例，25+5 循环，**支持最小化/关闭**，工具栏 🍅 按钮重启 |
| 🤖 Hermes 启动 | 一键打开 Obsidian 内置终端 + 启动 Hermes TUI |
| 💡 每日运维小贴士 | 15 条内置运维技巧，按日期轮换 |

## 安装

### 方式一：BRAT 一键安装（推荐）

1. 安装社区插件 [BRAT](https://obsidian.md/plugins?search=BRAT)（Obsidian 设置 → 社区插件 → 搜索 BRAT → 安装启用）
2. BRAT 设置 → `Add Beta plugin` → 输入：
   ```
   https://github.com/sadom125/Cockpit-Dashboard
   ```
3. 启用插件 Cockpit Dashboard

> 后续更新：BRAT 会自动检测 GitHub Release，一键更新。

### 方式二：手动安装

1. 从 [Releases](https://github.com/sadom125/Cockpit-Dashboard/releases) 下载最新版 zip
2. 解压到 Obsidian Vault 的 `.obsidian/plugins/cockpit-dashboard/` 目录下
3. Obsidian → 设置 → 社区插件 → 刷新 → 启用 "Cockpit Dashboard"

## 待办语法

在 `_data/todos.md` 中：

```markdown
- [ ] 普通待办
- [x] 已完成待办 | created: 2026-06-01 | done: 2026-06-02
- [ ] 高优先级任务 p:high
- [ ] 带截止日期 due: 2026-06-10
- [ ] 带标签 #工作 #紧急
```

## 数据存储

| 文件 | 用途 |
|------|------|
| `_data/todos.md` | 待办列表 |
| `_data/bookmarks.md` | 收藏文件列表 |
| `_daily/YYYY-MM-DD.md` | 闪念胶囊 |

## 作者

h (sadom125)
