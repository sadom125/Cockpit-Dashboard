# Cockpit Dashboard

Obsidian 驾驶舱仪表盘首页插件。替代 Obsidian 默认首页，提供知识库管理的"仪表盘"体验。

## 功能

| 功能 | 说明 |
|------|------|
| 👋 问候语 | 根据时间显示不同的问候语 |
| 💡 每日运维小贴士 | 15 条内置运维技巧，按日期轮换 |
| 🔍 迷你搜索 | 工具栏搜索按钮展开内嵌搜索，实时匹配笔记 |
| 📂 知识分类 | 一级文件夹卡片，点击打开分类概览 |
| ✅ 待办管理 | 支持标签过滤（#标签）、优先级（high/mid/low）、截止日期 |
| ⭐ 收藏文件 | 收藏/取消收藏双向同步，最近更新区和收藏区实时联动 |
| 📈 编辑热力图 | 近 30 天 5×6 格子，颜色深浅反映编辑活跃度 |
| ⚡ 闪念胶囊 | 随手记想法，保存到 `_daily/YYYY-MM-DD.md` |
| 🤖 Hermes 启动 | 一键打开 Obsidian 内置终端 + 启动 Hermes TUI |

## 安装

手动安装（社区插件）：

1. 下载 `main.js`、`manifest.json`、`data.json`
2. 放到 Obsidian Vault 的 `.obsidian/plugins/dashboard/` 目录下
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
