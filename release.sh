# ===== 网络通后（开代理或换网），在项目目录下运行 =====

# 1. 推送 tag 到 GitHub
cd "/Users/hang/Downloads/Documents/Obsidian/.obsidian/plugins/cockpit-dashboard"
git push origin v1.0.1

# 2. 创建 GitHub Release（会自动上传文件）
gh release create v1.0.1 \
  --title "v1.0.1" \
  --notes "Cockpit Dashboard 驾驶舱插件

功能：问候语(可自定义名称) | 待办管理 | 日历看板 | 番茄钟 | 驾驶舱H5启动 | 搜索 | 收藏 | 统计卡片 | 闪念胶囊 | Hermes" \
  main.js manifest.json styles.css
