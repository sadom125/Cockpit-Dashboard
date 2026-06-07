# Cockpit Dashboard 插件 — 项目档案

> **源码路径**: `~/Downloads/cockpit`（独立 Git 仓库）
> **Obsidian 插件目录**: `~/.obsidian/plugins/cockpit-dashboard/`（同步维护）
> **Obsidian Vault**: `~/Downloads/Documents/Obsidian`

---

## 项目介绍

Cockpit Dashboard 是一个 Obsidian 插件，提供：

- **日历看板**：月视图日历，带动画和双向同步
- **待办管理**：待办状态筛选，与 Hermes Agent todo 双向同步
- **番茄钟**：浮动可拖拽全局单例，25+5 循环
- **统计卡片**：数据存 `_data/focus.md`
- **JS 模块化架构**：`src/` + `build.js`

### 数据文件位置
- Todos: `_data/todos.md`（vault 根目录）
- 番茄钟数据: `_data/focus.md`（vault 根目录）

---

## 技术架构

### 文件结构
```
cockpit-dashboard/
├── build.js          # 打包脚本（29KB，800+行）
├── main.js           # 编译后的主入口
├── styles.css        # 样式
├── data.json         # 插件配置
├── manifest.json     # 插件清单
├── README.md         # 说明文档
├── src/              # 源代码（模块拆分）
│   ├── +build.js     # 开发构建脚本
│   └── ...           # 各功能模块
└── .git/             # Git 子模块
```

### 开发流程
1. 修改 `src/` 下的源代码
2. 运行 `node build.js` 打包
3. 刷新 Obsidian 插件页面生效

### 关键特性
- 主入口从 1260 行重构为 8 个模块（~787 行）
- position: fixed / z-index: 999 实现浮动单例
- 双向同步：Hermes → Obsidian checkbox (- [ ] / - [x])

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-06-03 | 终端迁移：iTerm2+oh-my-zsh+p10k → Ghostty+Starship(tokyo-night)。Cockpit 主题随之适配 tokyo-night 风格 |
| 2026-06-04 | **大版本 v2**：日历看板(月视图/动画/双向同步)、待办状态筛选、统计卡片 |
| 2026-06-04 | **JS 模块化**：main.js 从 1260→787 行，8 个 src 模块 + build.js |
| 2026-06-04 | **番茄钟**：浮动可拖拽全局单例，25+5 循环，数据存 _data/focus.md |
| 2026-06-05 | Dashboard 插件数据文件确认为 `_data/todos.md`（vault 根目录） |
| 2026-06-05 | Todo 与 Dashboard 双向同步规则建立 |
| 2026-06-06 | 创建备份策略：main.js.backup-before-v2, styles.css.backup-before-* |
| 2026-06-06 | 确认源码在 `~/Downloads/cockpit` + `~/.obsidian/plugins/cockpit-dashboard/` 双维护 |
| 2026-06-07 | Codex++ 故障排查文档写入 Obsidian（非 Cockpit 直接相关） |

---

## 经验教训

### 文件保护
- `~/.hermes/config.yaml`、`~/.zshrc`、`~/.codex/config.toml` 受 patch 工具保护，需用 terminal 命令或 write_file

### Obsidian 插件开发
- 插件代码在 Obsidian 插件目录和独立仓库同步维护
- 重要变更前先备份（main.js, styles.css 都有 .backup-before-* 文件）
- 插件目录本身含 .git，可以独立提交

### 数据文件约定
- `_data/` 目录存放插件数据，在 vault 根目录
- 格式遵循 Obsidian 标准：checkbox (- [ ] / - [x]) + 日期

### 主题风格
- Cockpit Dashboard 采用 tokyo-night 风格（与 Ghostty 终端一致）
- 偏好视觉化输出（HTML/CSS 卡片、渐变、emoji 图标）而非纯文本

### 代理与网络
- macOS 连不上 GitHub 时用 Shadowrocket（HTTP proxy 127.0.0.1:1082）
- Telegram 在中国被墙，需 proxy_url: http://127.0.0.1:1082
- `NODE_ENV=production` 会导致 npm install 跳过 devDependencies

### 开发工具
- Reasonix v1.2.0：日常技术任务优先使用
- Claude Code：保留作为 fallback（gpt 模型可能成功）
- Codex：保留使用

---

## 相关项目

| 项目 | 路径 | 说明 |
|------|------|------|
| Cockpit Dashboard | `~/Downloads/cockpit` | 独立 Git 仓库 + Obsidian 插件同步 |
| Cockpit Dashboard | `~/.obsidian/plugins/cockpit-dashboard/` | Obsidian 插件目录 |
| Cockpit 源码备份 | `~/Downloads/Documents/Obsidian/_plugins/dashboard/` | 另一个备份目录 |
| 终端配置备份 | `~/.zshrc.backup-ohmyzsh-2026-06-03` | oh-my-zsh 卸载前备份 |


