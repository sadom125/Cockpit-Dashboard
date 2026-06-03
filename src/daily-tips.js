const DAILY_TIPS = [
  '💡 Linux: `lsof -i :端口号` 快速查看哪个进程占用了端口',
  '💡 SQL: 大表加索引时用 `CREATE INDEX CONCURRENTLY`（PG）或 `ALTER TABLE ... ALGORITHM=INPLACE`（MySQL），避免锁表',
  '💡 Git: `git reflog` 可以找回被 reset/drop 的 commit，HEAD@{n} 定位',
  '💡 网络: `ss -tlnp` 比 netstat 更快，查看监听端口首选',
  '💡 Docker: `docker system prune -a --volumes` 一键清理悬空镜像和卷（慎用）',
  '💡 Nginx: `nginx -t` 测试配置语法，reload 前先跑一遍',
  '💡 低代码: 表单联动用 watch/effect 比 onChange 更可控，避免回调地狱',
  '💡 Oracle: `SELECT * FROM v$locked_object` 查锁表，`ALTER SYSTEM KILL SESSION` 解锁',
  '💡 内网穿透: frp 的 `transport.tls.enable = true` 加密流量，公网暴露必备',
  '💡 AI工具: Claude Code 的 CLAUDE.md 放项目根目录，每次会话自动加载上下文',
  '💡 运维: `journalctl -u 服务名 --since "1 hour ago"` 快速查最近日志',
  '💡 数据库: EXPLAIN ANALYZE 比 EXPLAIN 更准，会实际执行并返回真实耗时',
  '💡 Linux: `watch -n 1 命令` 每秒刷新执行，监控神器',
  '💡 Git: `git stash push -m "描述"` 给 stash 加注释，找起来不迷路',
  '💡 网络: `mtr 目标IP` 结合 ping + traceroute，定位网络抖动神器'
];
function getDailyTip() {
  const dayOfYear = window.moment().dayOfYear();
  return DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
}