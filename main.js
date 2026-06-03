'use strict';
var obsidian = require('obsidian');

const VIEW_TYPE = 'cockpit-dashboard';
const PLUGIN_ID = 'cockpit-dashboard';
const TODO_FILE = '_data/todos.md';

const fs = require('fs');
const path = require('path');
var CSS = '';
try { CSS = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8'); } catch(e) { console.warn('Cockpit: styles.css not found', e); }

const E = { wave:'👋', search:'🔍', tag:'🏷️', graph:'🕸️', bolt:'⚡', folder:'📂', rule:'📋', gear:'⚙️', robot:'🤖', box:'📦', chart:'📊', pencil:'✏️', check:'✅', save:'💾', edit:'✏️', del:'✕', cal:'📅' };
const T = { cats:'📂 知识分类', todos:'✅ 待办事项', stats:'📊 统计进度', recent:'✏️ 最近更新' };
const COLORS = ['#818cf8','#f59e0b','#3b82f6','#22c55e','#ec4899','#14b8a6','#f97316','#6366f1'];
const ICONS  = ['📁','📂','🗂️','📋','📌','🏷️','🔖','📊'];

function fmtDate(d) {
  if (!d) return '';
  const now = window.moment();
  if (d.isSame(now,'day')) return '今天';
  if (d.clone().add(1,'day').isSame(now,'day')) return '昨天';
  if (d.isSame(now,'year')) return d.format('M月D日');
  return d.format('YYYY-M-D');
}
function parseDate(s) {
  if (!s) return null;
  const d = window.moment(s.trim(),'YYYY-MM-DD',true);
  return d.isValid() ? d : null;
}
function extractTags(text) {
  const tags = [];
  const re = /#([^\s#]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) tags.push(m[1]);
  // 提取 due:YYYY-MM-DD
  let dueDate = null;
  const dueM = text.match(/due:\s*(\d{4}-\d{2}-\d{2})/);
  if (dueM) dueDate = parseDate(dueM[1]);
  // 提取优先级标记 p:high / p:mid / p:low
  let priority = 'mid';
  const pM = text.match(/p:\s*(high|mid|low)/);
  if (pM) priority = pM[1];
  // 清理文本：去掉 #标签、due:、p: 标记
  const cleanText = text.replace(/#[^\s#]+/g,'').replace(/due:\s*\S+/g,'').replace(/p:\s*\S+/g,'').trim();
  return { cleanText, tags, dueDate, priority };
}

async function loadTodos(vault) {
  try {
    const f = vault.getAbstractFileByPath(TODO_FILE);
    if (!f) return null;
    const content = await vault.read(f);
    const todos = [];
    for (const line of content.split('\n')) {
      const m = line.match(/^-\s+\[([ x])\]\s+(.+?)(?:\s*\|\s*(.+))?\s*$/);
      if (m) {
        const meta = m[3]||'';
        const cm = meta.match(/created:\s*(\S+)/);
        const dm = meta.match(/done:\s*(\S+)/);
        const created = cm ? parseDate(cm[1]) : null;
        const doneDate = dm ? parseDate(dm[1]) : null;
        const rawText = m[2].trim();
        const { cleanText, tags, dueDate, priority } = extractTags(rawText);
        todos.push({ text:cleanText, tags, priority, dueDate, done: m[1]==='x', created, doneDate });
      }
    }
    return todos.length > 0 ? todos : null;
  } catch(e) { return null; }
}

// 同步 Hermes 功能待办到 Obsidian _data/todos.md
const HERMES_TODOS = [
  { text: '📅 日历/日程看板', done: true, tags: ['obsidian'], priority: 'high', dueDate: '2026-06-02' },
  { text: '📌 便签/钉板（Pinned Notes）', done: false, tags: ['obsidian'], priority: 'mid', dueDate: null },
  { text: '📊 本周统计仪表盘', done: false, tags: ['obsidian'], priority: 'mid', dueDate: null },
  { text: '🍅 番茄钟/专注计时器', done: false, tags: ['obsidian'], priority: 'low', dueDate: null },
];

async function syncHermesTodos(vault, existingTodos) {
  try {
    const today = window ? window.moment().format('YYYY-MM-DD') : new Date().toISOString().slice(0,10);
    let changed = false;
    for (const ht of HERMES_TODOS) {
      const exists = existingTodos.find(t => t.text === ht.text);
      if (!exists) {
        existingTodos.push({
          text: ht.text,
          tags: ht.tags,
          priority: ht.priority,
          dueDate: ht.dueDate ? window.moment(ht.dueDate, 'YYYY-MM-DD', true) : null,
          done: ht.done,
          created: window.moment(today, 'YYYY-MM-DD', true),
          doneDate: ht.done ? window.moment(today, 'YYYY-MM-DD', true) : null,
        });
        changed = true;
      } else if (exists.done !== ht.done) {
        exists.done = ht.done;
        exists.doneDate = ht.done ? window.moment(today, 'YYYY-MM-DD', true) : null;
        changed = true;
      }
    }
    if (changed) await saveTodos(vault, existingTodos);
  } catch(e) { console.warn('syncHermesTodos', e); }
}

async function saveTodos(vault, todos) {
  try {
    const dir = TODO_FILE.split('/')[0];
    if (!vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
    const prefix = '# 待办事项\n\n';
    const lines = todos.map(t => {
      const meta = [];
      if (t.created) meta.push('created: '+t.created.format('YYYY-MM-DD'));
      if (t.done && t.doneDate) meta.push('done: '+t.doneDate.format('YYYY-MM-DD'));
      let text = t.text;
      if (t.tags && t.tags.length > 0) text += ' ' + t.tags.map(tag => '#'+tag).join(' ');
      if (t.dueDate) text += ' due:'+t.dueDate.format('YYYY-MM-DD');
      if (t.priority && t.priority !== 'mid') text += ' p:'+t.priority;
      return meta.length ? '- ['+(t.done?'x':' ')+'] '+text+' | '+meta.join(' | ') : '- ['+(t.done?'x':' ')+'] '+text;
    });
    const file = vault.getAbstractFileByPath(TODO_FILE);
    if (file) await vault.modify(file, prefix+lines.join('\n')+'\n');
    else await vault.create(TODO_FILE, prefix+lines.join('\n')+'\n');
  } catch(e) { console.warn('saveTodos',e); }
}

const DEFAULT_TODOS = [
  { text:'完善 Dashboard 驾驶舱功能', tags:['工作'], priority:'high', dueDate:null, done:false, created:window.moment(), doneDate:null },
  { text:'整理 gbrain 代码片段分类', tags:['工作'], priority:'mid', dueDate:null, done:false, created:window.moment(), doneDate:null },
  { text:'Gateway 配置文档补充', tags:['运维'], priority:'mid', dueDate:window.moment().add(3,'days'), done:false, created:window.moment(), doneDate:null },
  { text:'Obsidian vault 创建和分类', tags:['工作'], priority:'low', dueDate:null, done:true, created:window.moment(), doneDate:window.moment() }
];

// ===== 收藏功能 =====
const BOOKMARK_FILE = '_data/bookmarks.md';
async function loadBookmarks(vault) {
  try {
    const f = vault.getAbstractFileByPath(BOOKMARK_FILE);
    if (!f) return new Set();
    const content = await vault.read(f);
    const set = new Set();
    content.split('\n').forEach(l => { const t=l.trim(); if(t && !t.startsWith('#')) set.add(t); });
    return set;
  } catch(e) { return new Set(); }
}
async function saveBookmarks(vault, bmSet) {
  try {
    const dir = BOOKMARK_FILE.split('/')[0];
    if (!vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
    const content = '# 收藏文件\n\n' + Array.from(bmSet).sort().join('\n') + '\n';
    const file = vault.getAbstractFileByPath(BOOKMARK_FILE);
    if (file) await vault.modify(file, content);
    else await vault.create(BOOKMARK_FILE, content);
  } catch(e) { console.warn('saveBookmarks',e); }
}

// ===== 每日运维小贴士（内置，按日期取模） =====
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

class CockpitView extends obsidian.ItemView {
  constructor(leaf) { super(leaf); this._todos = []; this._refreshTimer = null; this._bookmarks = new Set(); this._recentEl = null; this._allFiles = []; this._focusMinutes = 0; this._pomodoroTimer = null; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Cockpit'; }
  getIcon() { return 'layout-dashboard'; }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    const root = container.createDiv({ cls: PLUGIN_ID+'-root' });
    root.createEl('style', { text: CSS });

    const loaded = await loadTodos(this.app.vault);
    this._todos = loaded || DEFAULT_TODOS.map(t=>({...t}));
    this._bookmarks = await loadBookmarks(this.app.vault);

    // 同步 Hermes 功能待办到 Obsidian
    await syncHermesTodos(this.app.vault, this._todos);

    // 加载今日专注时长
    const today = window.moment().format('YYYY-MM-DD');
    let focusData = null;
    try {
      const f = this.app.vault.getAbstractFileByPath('_data/focus.md');
      if (f) {
        const content = await this.app.vault.read(f);
        const m = content.match(/date:\s*(\S+)\s*\nminutes:\s*(\d+)/);
        if (m && m[1] === today) {
          this._focusMinutes = parseInt(m[2]) || 0;
        }
      }
    } catch(e) {}
    if (!this._focusMinutes) this._focusMinutes = 0;

    await this._buildAll(root);

    // 每 2 小时静默刷新一次数据（问候语、时间、统计、最近文件、待办）
    this._refreshTimer = setInterval(async () => {
      try {
        const fresh = await loadTodos(this.app.vault);
        if (fresh) this._todos = fresh;
        const c = this.containerEl.children[1];
        c.empty();
        const r = c.createDiv({ cls: PLUGIN_ID+'-root' });
        r.createEl('style', { text: CSS });
        await this._buildAll(r);
      } catch(e) { console.warn('Cockpit auto-refresh failed', e); }
    }, 2 * 60 * 60 * 1000);
  }

  async _buildAll(root) {
    const now = window.moment();
    const hr = new Date().getHours();
    let gr = '早上好';
    if (hr>=12&&hr<14) gr='中午好';
    else if (hr>=14&&hr<18) gr='下午好';
    else if (hr>=18&&hr<22) gr='晚上好';
    else if (hr>=22||hr<6) gr='夜深了';
    const days = Math.max(0, now.diff(window.moment('2026-05-30'), 'days'));
    const allFiles = this.app.vault.getMarkdownFiles();

    // ===== 1. Hero =====
    root.createDiv({ cls: PLUGIN_ID+'-hero' }, el => {
      el.createDiv({ cls: PLUGIN_ID+'-greeting', text: E.wave+' '+gr+'，行！' });
      el.createDiv({ cls: PLUGIN_ID+'-sub', text: '今天是 '+now.format('YYYY年M月D日 dddd')+' · 知识库已陪伴你 '+days+' 天' });
    });

    // 双向同步引用
    let refreshTodosRef = null;
    let refreshCalendarRef = null;

    // ===== 1.5 每日小贴士 =====
    const tip = getDailyTip();
    root.createDiv({ cls: PLUGIN_ID+'-tip' }, el => {
      el.createDiv({ cls: PLUGIN_ID+'-tip-label', text: '💡 今日运维技巧' });
      el.createDiv({ cls: PLUGIN_ID+'-tip-text', text: tip });
    });

    // ===== 2. Toolbar =====
    const toolbar = root.createDiv({ cls: PLUGIN_ID+'-toolbar' });
    [{icon:'+',label:'新建笔记',action:'new',primary:true},{icon:E.search,label:'搜索',action:'search'},{icon:E.tag,label:'标签',action:'tag'},{icon:E.graph,label:'图谱',action:'graph'},{icon:E.bolt,label:'命令',action:'command'},{icon:'🤖',label:'Hermes',action:'hermes'}].forEach(b=>{
      const el=toolbar.createEl('button',{cls:PLUGIN_ID+'-toolbtn'+(b.primary?' primary':'')});
      el.createSpan({cls:PLUGIN_ID+'-icon',text:b.icon});
      el.createSpan({text:b.label});
      el.onclick=()=>this._doAction(b.action);
    });

    // ===== 2.5 迷你搜索区域（默认隐藏，点击搜索按钮展开） =====
    let searchExpanded = false;
    const searchWrap = root.createDiv({ cls: PLUGIN_ID+'-search-row', attr:{style:'display:none'} });
    const searchInput = searchWrap.createEl('input', { cls: PLUGIN_ID+'-search-input', attr:{placeholder:'输入关键词搜索笔记...', type:'text'} });
    const searchResults = root.createDiv({ cls: PLUGIN_ID+'-search-results' });
    searchInput.addEventListener('input', ()=>{
      const q = searchInput.value.trim().toLowerCase();
      searchResults.empty();
      if (!q) return;
      const matched = allFiles.filter(f=>f.basename.toLowerCase().includes(q)).slice(0,8);
      matched.forEach(f=>{
        const item = searchResults.createDiv({ cls: PLUGIN_ID+'-search-item' });
        item.createSpan({ cls: PLUGIN_ID+'-search-name', text: f.basename });
        item.createSpan({ cls: PLUGIN_ID+'-search-path', text: f.path });
        item.onclick = ()=>{ this.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:f.path}}); };
      });
    });
    // 重写搜索按钮行为
    toolbar.querySelector('button:nth-child(2)').onclick = ()=>{
      searchExpanded = !searchExpanded;
      searchWrap.style.display = searchExpanded ? 'flex' : 'none';
      if (searchExpanded) searchInput.focus();
      else { searchInput.value=''; searchResults.empty(); }
    };

    // ===== 3.5 日历看板 =====
    (() => {
      let calYear  = now.year();
      let calMonth = now.month();
      let selDay   = now.date();
      let calRoot  = null;
      let gridEl   = null;
      const DOW_LABELS = ['一','二','三','四','五','六','日'];

      const buildTodoMap = () => {
        const m = {};
        (this._todos || []).forEach(t => {
          if (t.dueDate) {
            const key = t.dueDate.format('YYYY-MM-DD');
            if (!m[key]) m[key] = [];
            m[key].push({ text: t.text, done: t.done, priority: t.priority, raw: t });
          }
        });
        return m;
      };

      // 日历插入锚点：搜索区域后面
      const ensureRoot = () => {
        if (!calRoot || !calRoot.parentNode) {
          calRoot = document.createElement('div');
          calRoot.className = PLUGIN_ID + '-cal-wrap';
          const ref = root.querySelector('.' + PLUGIN_ID + '-search-results');
          if (ref && ref.parentNode) ref.parentNode.insertBefore(calRoot, ref.nextSibling);
          else root.prepend(calRoot);
        }
        calRoot.innerHTML = '';
      };

      const renderDetail = (tm) => {
        const old = calRoot.parentNode.querySelector('.' + PLUGIN_ID + '-cal-detail');
        if (old) old.remove();
        const selDate  = window.moment([calYear, calMonth, selDay]);
        const selKey   = selDate.format('YYYY-MM-DD');
        const items    = tm[selKey] || [];
        const det      = document.createElement('div');
        det.className  = PLUGIN_ID + '-cal-detail';
        calRoot.parentNode.insertBefore(det, calRoot.nextSibling);
        const weekDay = ['周日','周一','周二','周三','周四','周五','周六'][selDate.day()];
        det.createDiv({ cls: PLUGIN_ID + '-cal-detail-title',
          text: selDate.format('M月D日') + ' ' + weekDay });
        if (!items.length) {
          det.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty', text: '这一天没有待办 🎉' });
        } else {
          items.forEach(td => {
            const item = det.createDiv({ cls: PLUGIN_ID + '-cal-detail-item' });
            const chk  = item.createDiv({ cls: PLUGIN_ID + '-cal-detail-check' + (td.done ? ' done' : ''),
                                         text: td.done ? '✓' : '' });
            const span = item.createSpan({ cls: PLUGIN_ID + '-cal-detail-text' + (td.done ? ' done' : ''),
              text: (td.done ? '🟢 ' : td.priority === 'high' ? '🔴 ' : td.priority === 'mid' ? '🟡 ' : '🟢 ') + td.text });
            const toggle = async (e) => {
              if (e) e.stopPropagation();
              td.raw.done = !td.raw.done;
              td.raw.doneDate = td.raw.done ? window.moment() : null;
              await saveTodos(this.app.vault, this._todos);
              renderAll();
              if (refreshTodosRef) refreshTodosRef();
            };
            chk.onclick  = toggle;
            span.onclick = toggle;
          });
        }
      };

      const renderAll = () => {
        const todoMap = buildTodoMap();
        ensureRoot();
        const header = calRoot.createDiv({ cls: PLUGIN_ID + '-cal-header' });
        header.createDiv({ cls: PLUGIN_ID + '-cal-title', text: calYear + '年' + (calMonth + 1) + '月' });
        const nav = header.createDiv({ cls: PLUGIN_ID + '-cal-nav' });
        const prevBtn  = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '‹' });
        const todayBtn = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '●', attr:{ title:'回到今天' } });
        const nextBtn  = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '›' });
        gridEl = calRoot.createDiv({ cls: PLUGIN_ID + '-cal-grid' });
        DOW_LABELS.forEach(d => gridEl.createDiv({ cls: PLUGIN_ID + '-cal-dow', text: d }));
        const firstDay    = window.moment([calYear, calMonth, 1]);
        const startDow    = firstDay.day();
        const offset      = startDow === 0 ? 6 : startDow - 1;
        const daysInMonth = firstDay.daysInMonth();
        const prevDays    = window.moment([calYear, calMonth, 1]).subtract(1,'month').daysInMonth();
        for (let i = offset - 1; i >= 0; i--)
          gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell dim', text: String(prevDays - i) });
        for (let d = 1; d <= daysInMonth; d++) {
          const cellDate = window.moment([calYear, calMonth, d]);
          const dateKey  = cellDate.format('YYYY-MM-DD');
          const dayTodos = todoMap[dateKey] || [];
          const isToday  = cellDate.isSame(now, 'day');
          const isSel    = d === selDay;
          const cls = PLUGIN_ID + '-cal-cell'
                    + (isToday ? ' today' : '')
                    + (dayTodos.length ? ' has-todos' : '')
                    + (isSel   ? ' selected' : '');
          const cell = gridEl.createDiv({ cls });
          cell.createSpan({ text: String(d) });
          if (dayTodos.length) {
            const dots = cell.createDiv({ cls: PLUGIN_ID + '-cal-dots' });
            const pc = { high:'#ef4444', mid:'#f59e0b', low:'#22c55e' };
            dayTodos.slice(0,3).forEach(t => {
              const color = t.done ? '#22c55e' : (pc[t.priority] || '#818cf8');
              dots.createDiv({ cls: PLUGIN_ID+'-cal-dot', attr:{ style:'background:'+color } });
            });
          }
          cell.onclick = () => { selDay = d; renderDayDetailOnly(todoMap); };
        }
        const total = offset + daysInMonth;
        const needTrail = (7 - (total % 7)) % 7;
        const fill = Math.max(0, 42 - total - needTrail) + needTrail;
        for (let i = 1; i <= fill; i++)
          gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell dim', text: String(i) });
        const goMonth = (dir) => {
          gridEl.classList.remove('slide-in');
          gridEl.classList.add(dir > 0 ? 'slide-out-left' : 'slide-out-right');
          setTimeout(() => {
            calMonth += dir;
            if (calMonth < 0)  { calMonth = 11; calYear--; }
            if (calMonth > 11) { calMonth = 0;  calYear++; }
            selDay = Math.min(selDay, window.moment([calYear, calMonth, 1]).daysInMonth());
            renderAll();
            requestAnimationFrame(() => {
              const g = calRoot.querySelector('.' + PLUGIN_ID + '-cal-grid');
              if (g) { g.classList.remove('slide-out-left','slide-out-right'); g.classList.add('slide-in'); }
            });
          }, 200);
        };
        prevBtn.onclick  = () => goMonth(-1);
        nextBtn.onclick  = () => goMonth(1);
        todayBtn.onclick = () => { calYear = now.year(); calMonth = now.month(); selDay = now.date(); renderAll(); };
        renderDetail(todoMap);
      };

      const renderDayDetailOnly = (tm) => {
        if (gridEl) {
          const allCells = gridEl.querySelectorAll('.' + PLUGIN_ID + '-cal-cell');
          let cur = 0;
          allCells.forEach(c => {
            if (c.classList.contains('dim')) return;
            cur++;
            c.classList.toggle('selected', cur === selDay);
          });
        }
        renderDetail(tm);
      };

      renderAll();
      refreshCalendarRef = renderAll;
    })();

    // ===== 3. Categories =====
    root.createDiv({ cls: PLUGIN_ID+'-section-title', text: T.cats });
    const catsEl = root.createDiv({ cls: PLUGIN_ID+'-cats' });
    const allFolders = this.app.vault.getAllLoadedFiles()
      .filter(f=>f.children && f.path!=='' && f.path!=='/' && !f.path.includes('/') && !f.path.startsWith('.') && !f.path.startsWith('_') && f.path!=='Templates');
    const folderCounts = {};
    allFiles.forEach(f=>{
      const p=f.path.split('/');
      if (p.length>=2) folderCounts[p[0]]=(folderCounts[p[0]]||0)+1;
    });
    allFolders.sort((a,b)=>a.path.localeCompare(b.path));
    allFolders.forEach((folder,idx)=>{
      const count = folderCounts[folder.path]||0;
      const name = folder.path.replace(/^\d+[-_]/,'')||folder.path;
      const card = catsEl.createDiv({ cls: PLUGIN_ID+'-cat' });
      card.style.setProperty('--cat-clr', COLORS[idx%COLORS.length]);
      card.createDiv({ cls: PLUGIN_ID+'-cat-icon', text: ICONS[idx%ICONS.length] });
      card.createDiv({ cls: PLUGIN_ID+'-cat-name', text: name });
      card.createDiv({ cls: PLUGIN_ID+'-cat-count', text: count+' 篇笔记' });
      card.onclick=()=>{
        const files = allFiles.filter(f=>f.path.startsWith(folder.path+'/'));
        const overview = files.find(f=>f.basename.includes('概览')||f.basename.includes('MOC')||f.basename.includes('概述'));
        if (overview) this.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:overview.path}});
      };
    });

  

    // ===== 4. Stats（可动态更新）=====
    root.createDiv({ cls: PLUGIN_ID+'-section-title', text: T.stats });
    const statsEl = root.createDiv({ cls: PLUGIN_ID+'-stats' });
    const noteCount = allFiles.filter(f=>f.basename!=='Home'&&f.basename!=='欢迎').length;
    const statConfig = [
      { label:E.pencil+' 笔记总数', max:50, color:'#818cf8', type:'static', value:noteCount },
      { label:E.check+' 待办总数', max:20, color:'#c084fc', type:'dynamic', field:'todoCount' },
      { label:E.check+' 已完成',   max:1,  color:'#22c55e', type:'dynamic', field:'doneCount' },
      { label:E.check+' 完成率',   max:100,color:'#34d399', type:'dynamic', field:'donePct', suffix:'%' },
      { label:'🍅 今日专注',      max:480,color:'#f97316', type:'dynamic', field:'focusMin', suffix:' min' }
    ];
    const statValEls = [], statFillEls = [];
    statConfig.forEach(cfg=>{
      const card = statsEl.createDiv({ cls: PLUGIN_ID+'-stat' });
      card.style.setProperty('--stat-clr', cfg.color);
      card.createDiv({ cls: PLUGIN_ID+'-stat-label', text: cfg.label });
      const valEl = card.createDiv({ cls: PLUGIN_ID+'-stat-val' });
      statValEls.push(valEl);
      if (cfg.max > 0) {
        const bar = card.createDiv({ cls: PLUGIN_ID+'-stat-bar' });
        const fill = bar.createDiv({ cls: PLUGIN_ID+'-stat-fill', attr:{style:'width:0%'} });
        statFillEls.push(fill);
      } else {
        statFillEls.push(null);
      }
    });
    const updateStats = ()=>{
      const doneCount = this._todos.filter(t=>t.done).length;
      const todoCount = this._todos.length;
      const donePct = todoCount > 0 ? Math.round(doneCount/todoCount*100) : 0;
      const focusMin = this._focusMinutes || 0;
      const values = [noteCount, todoCount, doneCount, donePct, focusMin];
      values.forEach((val,i)=>{
        statValEls[i].textContent = '' + val + (statConfig[i].suffix||'');
        if (statFillEls[i]) {
          const max = statConfig[i].max;
          const pct = Math.min(100, max > 0 ? Math.round(val/max*100) : 0);
          statFillEls[i].style.width = pct + '%';
        }
      });
    };
    this._updateStatsRef = updateStats.bind(this);
    updateStats();

    // ===== 5. TODOs =====
    const todoHeader = root.createDiv({ cls: PLUGIN_ID+'-todo-header' });
    todoHeader.createDiv({ cls: PLUGIN_ID+'-section-title', text: T.todos });
    const addBtn = todoHeader.createEl('button', { cls: PLUGIN_ID+'-todo-add', text:'+', attr:{title:'新增待办'} });
    const refreshBtn = todoHeader.createEl('button', { cls: PLUGIN_ID+'-todo-add', text:'↻', attr:{title:'刷新待办'} });
    const todosEl = root.createDiv({ cls: PLUGIN_ID+'-todos' });

    // 状态筛选（全部/待办/已办）—— 放在 header 行右侧
    let currentStatus = 'todo';
    const _ss = todoHeader.createDiv({ cls: PLUGIN_ID+'-status-tabs' });
    [{key:'all',label:'全部'},{key:'todo',label:'待办'},{key:'done',label:'已办'}].forEach(s => {
      const _b = _ss.createEl('button', { cls: PLUGIN_ID+'-status-btn'+(currentStatus===s.key?' active':''), text: s.label });
      _b.onclick = async () => { currentStatus = s.key; _ss.querySelectorAll('.'+PLUGIN_ID+'-status-btn').forEach(x=>x.classList.remove('active')); _b.classList.add('active'); await renderTodos(); };
    });

    // 动态收集所有标签
    let currentTag = 'all'; // 当前选中页签
    const getAllTags = ()=>{
      const tagSet = new Set();
      this._todos.forEach(t => { if (t.tags) t.tags.forEach(tag => tagSet.add(tag)); });
      return Array.from(tagSet).sort();
    };

    // 动态生成页签栏
    const renderTabs = (allTags, wrapEl)=>{
      wrapEl.empty();
      const tabsEl = wrapEl.createDiv({ cls: PLUGIN_ID+'-todo-tabs' });
      // 构造页签：全部 + 动态标签
      const tabs = [{ key:'all', label:'全部' }];
      allTags.forEach(tag => tabs.push({ key:'tag:'+tag, label:'#'+tag }));
      tabs.forEach(tab => {
        const tabBtn = tabsEl.createEl('button', {
          cls: PLUGIN_ID+'-todo-tab' + (currentTag===tab.key?' active':''),
          text: tab.label
        });
        tabBtn.onclick = async ()=>{
          currentTag = tab.key;
          await renderTodos();
        };
      });
    };

    // 渲染待办列表（从内存数据渲染）
    let renderTodos = async ()=>{
      todosEl.empty();
      await saveTodos(this.app.vault, this._todos);
      updateStats();

      // 如果没有页签容器，创建它（插在 todoHeader 之后）
      let tabsWrap = root.querySelector('.'+PLUGIN_ID+'-todo-tabs-wrap');
      if (!tabsWrap) {
        tabsWrap = document.createElement('div');
        tabsWrap.className = PLUGIN_ID+'-todo-tabs-wrap';
        todoHeader.after(tabsWrap);
      }
      const allTags = getAllTags();
      renderTabs(allTags, tabsWrap);

      // 根据当前选中页签过滤
      const filtered = currentTag === 'all'
        ? this._todos
        : this._todos.filter(t => t.tags && t.tags.includes(currentTag.replace('tag:','')));

      // 根据状态过滤（全部/待办/已办）
      let statusFiltered = filtered;
      if (currentStatus === 'todo') statusFiltered = statusFiltered.filter(t => !t.done);
      if (currentStatus === 'done') statusFiltered = statusFiltered.filter(t => t.done);

      // 排序：优先级 high>mid+low，同优先级内按创建时间倒序，已过期的置顶
      const prioOrder = { high:0, mid:1, low:2 };
      const now = window.moment();
      statusFiltered.sort((a,b)=>{
        // 已过期的未完成置顶
        const aOver = !a.done && a.dueDate && a.dueDate.isBefore(now, 'day') ? 0 : 1;
        const bOver = !b.done && b.dueDate && b.dueDate.isBefore(now, 'day') ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        // 按优先级
        const pa = prioOrder[a.priority||'mid'];
        const pb = prioOrder[b.priority||'mid'];
        if (pa !== pb) return pa - pb;
        // 按创建时间倒序
        return (b.created?.valueOf()||0) - (a.created?.valueOf()||0);
      });

      statusFiltered.forEach((t,i)=>{
        const realIdx = this._todos.indexOf(t);
        const done = t.done;
        const item = todosEl.createDiv({ cls: PLUGIN_ID+'-todo'+(done?' done':'') });

        // 优先级圆点
        const pdot = item.createDiv({ cls: PLUGIN_ID+'-todo-pdot p-'+(t.priority||'mid'), attr:{title:'优先级: '+(t.priority||'mid')} });

        // 复选框 - 切换完成状态，连带更新日期
        const chk = item.createDiv({ cls: PLUGIN_ID+'-todo-chk', text:done?'✓':'' });
        chk.onclick = async (e)=>{
          e.stopPropagation();
          this._todos[realIdx].done = !this._todos[realIdx].done;
          this._todos[realIdx].doneDate = this._todos[realIdx].done ? window.moment() : null;
          await renderTodos();
        };

        // 主内容区
        const main = item.createDiv({ cls: PLUGIN_ID+'-todo-main' });
        const txt = main.createDiv({ cls: PLUGIN_ID+'-todo-text', text:t.text });
        txt.onclick = async (e)=>{
          e.stopPropagation();
          this._todos[realIdx].done = !this._todos[realIdx].done;
          this._todos[realIdx].doneDate = this._todos[realIdx].done ? window.moment() : null;
          await renderTodos();
        };

        // 时间元信息 + 截止日期 + 标签胶囊
        const meta = main.createDiv({ cls: PLUGIN_ID+'-todo-meta' });
        if (t.created) meta.createDiv({cls:PLUGIN_ID+'-todo-meta-item'}).createSpan({text:E.cal+' '+fmtDate(t.created)});
        if (done && t.doneDate) meta.createDiv({cls:PLUGIN_ID+'-todo-meta-item'}).createSpan({text:E.check+' '+fmtDate(t.doneDate)});
        // 截止日期显示
        if (t.dueDate && !done) {
          const nowM = window.moment();
          let dueCls = 'due-future', dueLabel = fmtDate(t.dueDate);
          if (t.dueDate.isBefore(nowM, 'day')) { dueCls = 'due-overdue'; dueLabel = '⚠️ 已过期: '+fmtDate(t.dueDate); }
          else if (t.dueDate.isSame(nowM, 'day')) { dueCls = 'due-today'; dueLabel = '⏰ 今天到期'; }
          meta.createSpan({ cls: PLUGIN_ID+'-todo-due '+dueCls, text: dueLabel });
        }
        // 标签显示
        if (t.tags && t.tags.length > 0) {
          t.tags.forEach(tag => {
            const pill = meta.createSpan({ cls: PLUGIN_ID+'-todo-tag-pill', text:'#'+tag });
            pill.onclick = async (e) => {
              e.stopPropagation();
              currentTag = 'tag:'+tag;
              await renderTodos();
            };
          });
        }

        // 状态标签
        item.createDiv({ cls: PLUGIN_ID+'-todo-tag '+(done?'tag-done':'tag-todo'), text:done?'已完成':'进行中' });

        // 优先级选择器（hover 时显示）
        const prioWrap = item.createDiv({ cls: PLUGIN_ID+'-prio-picker' });
        ['high','mid','low'].forEach(p => {
          const dot = prioWrap.createDiv({ cls: PLUGIN_ID+'-prio-opt p-' + p + ((t.priority||'mid')===p?' sel':'') });
          dot.title = p==='high'?'高优先级':p==='mid'?'中优先级':'低优先级';
          dot.onclick = async (e)=>{
            e.stopPropagation();
            this._todos[realIdx].priority = p;
            await renderTodos();
          };
        });

        // 操作按钮
        const actions = item.createDiv({ cls: PLUGIN_ID+'-todo-actions' });

        // 编辑按钮
        const editBtn = actions.createDiv({ cls: PLUGIN_ID+'-todo-btn', text:E.edit, attr:{title:'编辑'} });
        editBtn.onclick = (e)=>{
          e.stopPropagation();
          const row = document.createElement('div');
          row.className = PLUGIN_ID+'-todo-input-row';
          const inp = document.createElement('input');
          inp.className = PLUGIN_ID+'-todo-input-field';
          inp.type = 'text';
          // 编辑时把标签、优先级、截止日期也带回去
          let editVal = t.text;
          if (t.tags && t.tags.length > 0) editVal += ' ' + t.tags.map(tg=>'#'+tg).join(' ');
          if (t.dueDate) editVal += ' due:'+t.dueDate.format('YYYY-MM-DD');
          if (t.priority && t.priority !== 'mid') editVal += ' p:'+t.priority;
          inp.value = editVal;
          const okB = document.createElement('button');
          okB.className = PLUGIN_ID+'-todo-input-ok';
          okB.textContent = '✓';
          const cancelB = document.createElement('button');
          cancelB.className = PLUGIN_ID+'-todo-input-cancel';
          cancelB.textContent = '✕';
          row.appendChild(inp); row.appendChild(okB); row.appendChild(cancelB);
          item.replaceWith(row);
          inp.focus(); inp.select();
          const save = async ()=>{
            const v = inp.value.trim();
            if (v) {
              const { cleanText, tags, dueDate, priority } = extractTags(v);
              this._todos[realIdx].text = cleanText;
              this._todos[realIdx].tags = tags;
              this._todos[realIdx].dueDate = dueDate;
              this._todos[realIdx].priority = priority;
              this._todos[realIdx].created = window.moment();
            }
            await renderTodos();
          };
          inp.addEventListener('keydown', ke=>{ if(ke.key==='Enter'){ke.preventDefault();save()} if(ke.key==='Escape'){ke.preventDefault();renderTodos()} });
          okB.onclick = save;
          cancelB.onclick = ()=>renderTodos();
        };

        // 删除按钮
        const delBtn = actions.createDiv({ cls: PLUGIN_ID+'-todo-btn del', text:E.del, attr:{title:'删除'} });
        delBtn.onclick = async (e)=>{ e.stopPropagation(); this._todos.splice(realIdx,1); await renderTodos(); };
      });
    };

    // 待办变化后同步刷新日历（深度计数器避免递归重复刷新）
    let _rtDepth = 0;
    const _rtOrig = renderTodos;
    renderTodos = async function() {
      _rtDepth++;
      try { await _rtOrig(); }
      finally {
        _rtDepth--;
        if (_rtDepth === 0 && refreshCalendarRef) refreshCalendarRef();
      }
    };

    // 日历勾选待办后同步刷新下方列表
    refreshTodosRef = renderTodos.bind(this);

    // 刷新按钮：从 MD 文件重新加载数据
    refreshBtn.onclick = async ()=>{
      const loaded = await loadTodos(this.app.vault);
      if (loaded) {
        this._todos = loaded;
      }
      await renderTodos();
    };

    await renderTodos();

    // 新增待办（支持 #标签）
    addBtn.onclick = async ()=>{
      if (todosEl.querySelector('.'+PLUGIN_ID+'-todo-input-row')) return;
      const row = document.createElement('div');
      row.className = PLUGIN_ID+'-todo-input-row';
      const inp = document.createElement('input');
      inp.className = PLUGIN_ID+'-todo-input-field';
      inp.type = 'text';
      inp.placeholder = '输入待办事项，可加 #标签 due:YYYY-MM-DD p:high，回车确认';
      const okB = document.createElement('button');
      okB.className = PLUGIN_ID+'-todo-input-ok';
      okB.textContent = '✓';
      const cancelB = document.createElement('button');
      cancelB.className = PLUGIN_ID+'-todo-input-cancel';
      cancelB.textContent = '✕';
      row.appendChild(inp); row.appendChild(okB); row.appendChild(cancelB);
      todosEl.prepend(row);
      inp.focus();
      const submit = async ()=>{
        const v = inp.value.trim();
        if (v) {
          const { cleanText, tags, dueDate, priority } = extractTags(v);
          this._todos.unshift({text:cleanText, tags, priority, dueDate, done:false, created:window.moment(), doneDate:null});
          await renderTodos();
        }
        else row.remove();
      };
      inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();submit()} if(e.key==='Escape'){e.preventDefault();row.remove()} });
      okB.onclick = submit;
      cancelB.onclick = ()=>row.remove();
    };

    // ===== 6. Recent =====
    root.createDiv({ cls: PLUGIN_ID+'-section-title', text: T.recent });
    this._recentEl = root.createDiv({ cls: PLUGIN_ID+'-recent' });
    this._allFiles = allFiles;
    this._allFiles.filter(f=>f.basename!=='Home').sort((a,b)=>b.stat.mtime-a.stat.mtime).slice(0,5).forEach(file=>{
      const item = this._recentEl.createDiv({ cls: PLUGIN_ID+'-recent-item', attr:{'data-path':file.path} });
      const isStarred = this._bookmarks.has(file.path);
      const starBtn = item.createSpan({ cls: PLUGIN_ID+'-bookmark-btn'+(isStarred?' starred':''), text: isStarred?'★':'☆', attr:{title:isStarred?'取消收藏':'收藏'} });
      starBtn.onclick = async (e)=>{
        e.stopPropagation();
        if (this._bookmarks.has(file.path)) this._bookmarks.delete(file.path);
        else this._bookmarks.add(file.path);
        await saveBookmarks(this.app.vault, this._bookmarks);
        // 更新按钮状态
        const nowStarred = this._bookmarks.has(file.path);
        starBtn.textContent = nowStarred ? '★' : '☆';
        starBtn.className = PLUGIN_ID+'-bookmark-btn'+(nowStarred?' starred':'');
        starBtn.title = nowStarred ? '取消收藏' : '收藏';
        // 异步刷新收藏 section + 重建最近更新星星
        await this._refreshBookmarkSection(root, this._allFiles);
        this._rebuildRecentStars();
      };
      const link = item.createEl('a',{cls:PLUGIN_ID+'-recent-link',text:file.basename,href:'#'});
      link.onclick=e=>{e.preventDefault();this.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:f.path}})};
      item.createDiv({ cls: PLUGIN_ID+'-recent-time', text: window.moment(file.stat.mtime).fromNow() });
    });

    // ===== 6.5 收藏文件 =====
    if (this._bookmarks.size > 0) {
      root.createDiv({ cls: PLUGIN_ID+'-section-title', text: '⭐ 收藏文件' });
      const bmEl = root.createDiv({ cls: PLUGIN_ID+'-recent' });
      this._bookmarks.forEach(path=>{
        const f = allFiles.find(ff=>ff.path===path);
        if (!f) return;
        const item = bmEl.createDiv({ cls: PLUGIN_ID+'-recent-item' });
        const starBtn = item.createSpan({ cls: PLUGIN_ID+'-bookmark-btn starred', text: '★', attr:{title:'取消收藏'} });
        starBtn.onclick = async (e)=>{
          e.stopPropagation();
          this._bookmarks.delete(path);
          await saveBookmarks(this.app.vault, this._bookmarks);
          try {
            await this._refreshBookmarkSection(root, this._allFiles);
            this._rebuildRecentStars();
          } catch(err) { console.error('[Cockpit] rebuild failed', err); }
        };
        const link = item.createEl('a',{cls:PLUGIN_ID+'-recent-link',text:f.basename,href:'#'});
        link.onclick=e=>{e.preventDefault();this.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:f.path}})};
        item.createDiv({ cls: PLUGIN_ID+'-recent-time', text: f.path });
      });
    }

    // ===== 6.8 闪念胶囊 =====
    root.createDiv({ cls: PLUGIN_ID+'-section-title', text: '⚡ 闪念胶囊' });
    const flashWrap = root.createDiv({ cls: PLUGIN_ID+'-flash-row' });
    const flashInput = flashWrap.createEl('input', { cls: PLUGIN_ID+'-flash-input', attr:{placeholder:'随手记一条想法...', type:'text'} });
    const flashOk = flashWrap.createEl('button', { cls: PLUGIN_ID+'-todo-input-ok', text:'✓' });
    const flashMsg = root.createDiv({ cls: PLUGIN_ID+'-flash-ok', attr:{style:'display:none'}, text:'✓ 已保存' });
    const saveFlash = async ()=>{
      const v = flashInput.value.trim();
      if (!v) return;
      const today = window.moment().format('YYYY-MM-DD');
      const timeStr = window.moment().format('HH:mm');
      const filePath = `_daily/${today}.md`;
      const prefix = `# ${today} 闪念\n\n`;
      const line = `- [${timeStr}] ${v}\n`;
      try {
        const f = this.app.vault.getAbstractFileByPath('_daily');
        if (!f) await this.app.createFolder('_daily');
        const ex = this.app.vault.getAbstractFileByPath(filePath);
        if (ex) {
          const old = await this.app.vault.read(ex);
          await this.app.vault.modify(ex, old + line);
        } else {
          await this.app.vault.create(filePath, prefix + line);
        }
        flashInput.value = '';
        flashMsg.style.display = 'block';
        setTimeout(()=>{ flashMsg.style.display = 'none'; }, 2000);
      } catch(e) { console.warn('flash save',e); }
    };
    flashInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();saveFlash();} });
    flashOk.onclick = saveFlash;

    // ===== 底部：编辑热力图 =====
    const hmTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: '📈 编辑热力图（近30天）' });
    const heatmapEl = root.createDiv({ cls: PLUGIN_ID+'-heatmap' });
    const today = window.moment();
    const dayCounts = {};
    allFiles.forEach(f=>{
      const d = window.moment(f.stat.mtime);
      const diff = today.diff(d, 'days');
      if (diff >= 0 && diff < 30) {
        const key = d.format('YYYY-MM-DD');
        dayCounts[key] = (dayCounts[key]||0) + 1;
      }
    });
    const maxCount = Math.max(1, ...Object.values(dayCounts));
    // 5 级色阶：无→低→中→高→极高
    const colors = ['rgba(129,140,248,0.12)','rgba(129,140,248,0.3)','rgba(129,140,248,0.5)','rgba(99,102,241,0.7)','rgba(79,70,229,0.9)'];
    const getColor = (count) => {
      if (count === 0) return 'var(--background-modifier-border)';
      if (count >= maxCount * 0.8) return colors[4];
      if (count >= maxCount * 0.5) return colors[3];
      if (count >= maxCount * 0.25) return colors[2];
      return colors[1];
    };
    for (let i = 29; i >= 0; i--) {
      const d = today.clone().subtract(i, 'days');
      const key = d.format('YYYY-MM-DD');
      const count = dayCounts[key] || 0;
      const cell = heatmapEl.createDiv({ cls: PLUGIN_ID+'-hm-cell' });
      cell.title = key + ': ' + count + ' 个文件';
      cell.style.background = getColor(count);
    }
    // 图例
    const legend = hmTitle.createDiv({ cls: PLUGIN_ID+'-hm-legend' });
    legend.createSpan({ cls: PLUGIN_ID+'-hm-legend-label', text: '少' });
    colors.forEach(c => {
      const dot = legend.createDiv({ cls: PLUGIN_ID+'-hm-legend-cell' });
      dot.style.background = c;
    });
    legend.createSpan({ cls: PLUGIN_ID+'-hm-legend-label', text: '多' });

    root.createDiv({ cls: PLUGIN_ID+'-footer', text: E.save+' h 持续维护 · 知识库是活的' });

    // ===== 番茄钟浮动组件 =====
    this._buildPomodoro(root);
  }

  // ========== 番茄钟 ==========
  _buildPomodoro(root) {
    const PID = PLUGIN_ID;
    const self = this;

    // 全局单例：如果已存在则复用，不重建
    const existing = document.querySelector('.' + PID + '-pomodoro');
    if (existing) {
      // 只更新 _updateStatsRef，确保统计能刷新
      this._pomodoroInstance = this._pomodoroInstance || {};
      return;
    }

    // 创建浮动容器
    const floatEl = document.createElement('div');
    floatEl.className = PID + '-pomodoro';
    floatEl.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999;width:180px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,0.18);font-family:-apple-system,BlinkMacSystemFont,sans-serif;overflow:hidden;transition:box-shadow 0.2s;';

    // 标题栏（拖拽区域）
    const header = floatEl.createDiv({ cls: PID + '-pomo-header' });
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:linear-gradient(135deg,#f97316,#ef4444);cursor:move;user-select:none;';
    const titleSpan = header.createSpan({ text: '🍅 番茄钟', attr: { style: 'font-size:0.82em;font-weight:700;color:white;' } });
    const toggleBtn = header.createSpan({ text: '−', attr: { style: 'font-size:1.1em;color:white;cursor:pointer;padding:0 4px;', title: '最小化' } });

    // 内容区
    const body = floatEl.createDiv({ cls: PID + '-pomo-body' });
    body.style.cssText = 'padding:12px;text-align:center;';

    // 状态文字
    const statusEl = body.createDiv({ text: '准备开始', attr: { style: 'font-size:0.72em;color:var(--text-muted);margin-bottom:6px;' } });

    // 倒计时显示
    const timerEl = body.createDiv({ text: '25:00', attr: { style: 'font-size:2.2em;font-weight:800;color:var(--text-normal);font-variant-numeric:tabular-nums;letter-spacing:2px;' } });

    // 进度条
    const progWrap = body.createDiv({ attr: { style: 'height:4px;background:var(--background-modifier-border);border-radius:2px;margin:8px 0;overflow:hidden;' } });
    const progFill = progWrap.createDiv({ attr: { style: 'height:100%;width:0%;background:linear-gradient(90deg,#f97316,#ef4444);border-radius:2px;transition:width 0.3s;' } });

    // 按钮行
    const btnRow = body.createDiv({ attr: { style: 'display:flex;gap:6px;justify-content:center;margin-top:4px;' } });
    const startBtn = btnRow.createEl('button', { text: '▶ 开始', attr: { style: 'padding:5px 14px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--interactive-accent);color:white;font-size:0.72em;font-weight:600;cursor:pointer;transition:all 0.15s;' } });
    const resetBtn = btnRow.createEl('button', { text: '↺ 重置', attr: { style: 'padding:5px 14px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--background-secondary);color:var(--text-muted);font-size:0.72em;font-weight:600;cursor:pointer;transition:all 0.15s;' } });

    // 今日专注时长
    const todayFocus = body.createDiv({ text: '今日专注: 0 min', attr: { style: 'font-size:0.68em;color:var(--text-muted);margin-top:8px;' } });

    // 番茄计数
    const countEl = body.createDiv({ text: '🍅 × 0', attr: { style: 'font-size:0.68em;color:var(--text-muted);margin-top:2px;' } });

    document.body.appendChild(floatEl);

    // 状态变量
    let totalSeconds = 25 * 60;
    let remaining = totalSeconds;
    let isRunning = false;
    let isBreak = false;
    let pomodoroCount = 0;
    let timerInterval = null;
    let minimized = false;

    // 拖拽
    let dragOffsetX = 0, dragOffsetY = 0, isDragging = false;
    header.addEventListener('mousedown', (e) => {
      if (e.target === toggleBtn) return;
      isDragging = true;
      const rect = floatEl.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      floatEl.style.transition = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      floatEl.style.left = (e.clientX - dragOffsetX) + 'px';
      floatEl.style.top = (e.clientY - dragOffsetY) + 'px';
      floatEl.style.right = 'auto';
      floatEl.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => { isDragging = false; floatEl.style.transition = 'box-shadow 0.2s'; });

    // 最小化
    toggleBtn.onclick = () => {
      minimized = !minimized;
      body.style.display = minimized ? 'none' : 'block';
      toggleBtn.textContent = minimized ? '+' : '−';
      toggleBtn.title = minimized ? '展开' : '最小化';
      floatEl.style.width = minimized ? '140px' : '180px';
      if (minimized) {
        titleSpan.textContent = '🍅 ' + fmtTime(remaining);
      } else {
        titleSpan.textContent = '🍅 番茄钟';
      }
    };

    // 格式化时间
    function fmtTime(s) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    }

    // 更新显示
    function updateDisplay() {
      timerEl.textContent = fmtTime(remaining);
      const pct = ((totalSeconds - remaining) / totalSeconds) * 100;
      progFill.style.width = pct + '%';
      todayFocus.textContent = '今日专注: ' + (self._focusMinutes || 0) + ' min';
      countEl.textContent = '🍅 × ' + pomodoroCount;
      if (minimized) {
        titleSpan.textContent = '🍅 ' + fmtTime(remaining);
      }
    }

    // 开始/暂停
    startBtn.onclick = () => {
      if (isRunning) {
        // 暂停
        clearInterval(timerInterval);
        isRunning = false;
        startBtn.textContent = '▶ 继续';
        statusEl.textContent = isBreak ? '休息暂停' : '专注暂停';
        statusEl.style.color = '#f59e0b';
      } else {
        // 开始
        isRunning = true;
        startBtn.textContent = '⏸ 暂停';
        statusEl.textContent = isBreak ? '休息中...' : '专注中...';
        statusEl.style.color = isBreak ? '#22c55e' : '#ef4444';
        timerInterval = setInterval(() => {
          remaining--;
          updateDisplay();
          if (remaining <= 0) {
            clearInterval(timerInterval);
            isRunning = false;
            if (!isBreak) {
              // 专注完成
              pomodoroCount++;
              self._focusMinutes = (self._focusMinutes || 0) + 25;
              // 持久化到文件
              (async () => {
                try {
                  const today = window.moment().format('YYYY-MM-DD');
                  const content = '# 专注记录\n\ndate: ' + today + '\nminutes: ' + self._focusMinutes + '\n';
                  const dir = '_data';
                  if (!self.app.vault.getAbstractFileByPath(dir)) await self.app.vault.createFolder(dir);
                  const f = self.app.vault.getAbstractFileByPath('_data/focus.md');
                  if (f) await self.app.vault.modify(f, content);
                  else await self.app.vault.create('_data/focus.md', content);
                } catch(e) { console.warn('save focus', e); }
              })();
              statusEl.textContent = '✅ 完成一个番茄！';
              statusEl.style.color = '#22c55e';
              startBtn.textContent = '▶ 开始休息';
              isBreak = true;
              totalSeconds = 5 * 60;
              remaining = totalSeconds;
              // 刷新统计
              if (self._updateStatsRef) self._updateStatsRef();
            } else {
              // 休息完成
              statusEl.textContent = '休息结束';
              statusEl.style.color = 'var(--text-muted)';
              startBtn.textContent = '▶ 开始';
              isBreak = false;
              totalSeconds = 25 * 60;
              remaining = totalSeconds;
            }
            updateDisplay();
          }
        }, 1000);
      }
    };

    // 重置
    resetBtn.onclick = () => {
      clearInterval(timerInterval);
      isRunning = false;
      isBreak = false;
      totalSeconds = 25 * 60;
      remaining = totalSeconds;
      startBtn.textContent = '▶ 开始';
      statusEl.textContent = '准备开始';
      statusEl.style.color = 'var(--text-muted)';
      updateDisplay();
    };

    // 保存引用
    this._pomodoroTimer = timerInterval;
    this._updateStatsRef = null; // 将在 _buildAll 中设置

    updateDisplay();
  }
  _rebuildRecentStars() {
    const recentEl = this._recentEl;
    if (!recentEl) return;
    let count = 0;
    for (let i = 0; i < recentEl.children.length; i++) {
      const item = recentEl.children[i];
      const dp = item.getAttribute('data-path');
      if (!dp) continue;
      const isStarred = this._bookmarks.has(dp);
      // 找星星按钮
      let starBtn = item.querySelector('[class*="bookmark-btn"]');
      if (!starBtn) continue;
      starBtn.textContent = isStarred ? '★' : '☆';
      starBtn.className = PLUGIN_ID + '-bookmark-btn' + (isStarred ? ' starred' : '');
      starBtn.title = isStarred ? '取消收藏' : '收藏';
      count++;
    }
  }

  // 异步刷新收藏 section（局部 DOM 更新，不重建整个页面）
  async _refreshBookmarkSection(root, allFiles) {
    // 找到收藏 section 的标题和容器
    let bmTitle = null, bmEl = null;
    root.querySelectorAll('.' + PLUGIN_ID + '-section-title').forEach(el => {
      if (el.textContent.includes('收藏文件')) bmTitle = el;
    });
    if (bmTitle) bmEl = bmTitle.nextElementSibling;

    if (this._bookmarks.size === 0) {
      // 没有收藏了，移除整个 section
      if (bmTitle) bmTitle.remove();
      if (bmEl) bmEl.remove();
      return;
    }

    // 收藏列表容器不存在则创建
    if (!bmEl || !bmEl.classList.contains(PLUGIN_ID + '-recent')) {
      // 旧的残留要先清
      if (bmTitle) bmTitle.remove();
      if (bmEl) bmEl.remove();
      bmTitle = root.createDiv({ cls: PLUGIN_ID + '-section-title', text: '⭐ 收藏文件' });
      bmEl = root.createDiv({ cls: PLUGIN_ID + '-recent' });
      // 插到"最近更新"section 后面
      let recentTitle = null;
      root.querySelectorAll('.' + PLUGIN_ID + '-section-title').forEach(el => {
        if (el.textContent.includes('最近更新')) recentTitle = el;
      });
      if (recentTitle && recentTitle.nextElementSibling) {
        recentTitle.nextElementSibling.after(bmEl);
        bmEl.before(bmTitle);
      }
    }

    // 重新渲染收藏列表
    bmEl.innerHTML = '';
    let hasVisible = false;
    for (const path of this._bookmarks) {
      const f = allFiles.find(ff => ff.path === path);
      if (!f) { this._bookmarks.delete(path); continue; } // 文件已删除，同步清理
      hasVisible = true;
      const item = bmEl.createDiv({ cls: PLUGIN_ID + '-recent-item' });
      const starBtn = item.createSpan({ cls: PLUGIN_ID + '-bookmark-btn starred', text: '★', attr: { title: '取消收藏' } });
      starBtn.onclick = async (e) => {
        e.stopPropagation();
        this._bookmarks.delete(path);
        await saveBookmarks(this.app.vault, this._bookmarks);
        await this._refreshBookmarkSection(root, allFiles);
        this._rebuildRecentStars();
      };
      const link = item.createEl('a', { cls: PLUGIN_ID + '-recent-link', text: f.basename, href: '#' });
      link.onclick = e => {
        e.preventDefault();
        this.app.workspace.getUnpinnedLeaf().setViewState({ type: 'markdown', state: { file: f.path } });
      };
      item.createDiv({ cls: PLUGIN_ID + '-recent-time', text: f.path });
    }
    if (!hasVisible) {
      bmTitle.remove(); bmEl.remove();
    }
  }

  _doAction(a) {
    if (a === 'hermes') {
      try {
        // 1. 打开终端面板
        this.app.commands.executeCommandById('terminal:open-terminal.integrated.root');
        // 2. 等终端就绪后模拟键盘输入
        const tryInject = () => {
          const termLeaves = this.app.workspace.getLeavesOfType('terminal');
          if (termLeaves.length === 0) return false;
          const termLeaf = termLeaves[termLeaves.length - 1];
          const termView = termLeaf?.view;
          if (!termView) return false;
          
          // 获取 xterm.js Terminal 实例 - 通过 _children 或 symbol 属性查找
          let xterm = null;
          // 直接在 termView 上找
          for (const key of Object.getOwnPropertyNames(termView)) {
            const val = termView[key];
            if (val && val._core && val._core._coreService) {
              xterm = val;
              break;
            }
          }
          // 检查 _children
          if (!xterm && termView._children) {
            for (const child of termView._children) {
              if (child._core && child._core._coreService) { xterm = child; break; }
              // 再深一层
              if (child._children) {
                for (const c2 of child._children) {
                  if (c2._core && c2._core._coreService) { xterm = c2; break; }
                }
              }
              // 检查 renderTerminal / _terminal
              for (const k of Object.getOwnPropertyNames(child)) {
                const v = child[k];
                if (v && v._core && v._core._coreService) { xterm = v; break; }
              }
            }
          }
          if (xterm) {
            xterm.write('hermes --tui\r');
            return true;
          }
          return false;
        };
        let attempts = 0;
        const timer = setInterval(() => {
          attempts++;
          if (tryInject() || attempts > 30) clearInterval(timer);
        }, 300);
      } catch(e) {
        console.warn('Hermes failed', e);
      }
      return;
    }
    switch(a) {
      case 'new': this.app.commands.executeCommandById('file-explorer:new-file'); break;
      case 'search': /* 搜索已内嵌到 Dashboard，点击 toolbar 按钮展开 */ break;
      case 'tag': this.app.workspace.rightSplit.expand(); break;
      case 'graph': this.app.commands.executeCommandById('graph:open'); break;
      case 'command': this.app.commands.executeCommandById('command-palette:open'); break;
    }
  }
  async onClose() {
    if (this._refreshTimer) { clearInterval(this._refreshTimer); this._refreshTimer = null; }
    // 番茄钟是全局单例，不随驾驶舱关闭而销毁
    // 只清理引用，不移除 DOM
    this._pomodoroTimer = null;
  }
}

class CockpitPlugin extends obsidian.Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, l=>new CockpitView(l));
    this.addRibbonIcon('layout-dashboard','Cockpit',()=>this._open());
    this.addCommand({id:'open-cockpit',name:'打开 Cockpit 驾驶舱',callback:()=>this._open()});
    this.app.workspace.onLayoutReady(()=>this._open());
  }
  async _open() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf('split','vertical'); await leaf.setViewState({type:VIEW_TYPE,active:true}); }
    this.app.workspace.revealLeaf(leaf);
  }
  async onunload() { this.app.workspace.detachLeavesOfType(VIEW_TYPE); }
}
module.exports = CockpitPlugin;