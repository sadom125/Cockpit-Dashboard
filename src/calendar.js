// calendar.js — 日历看板模块
// 注意：日历渲染逻辑在 _buildAll 中，这里提供辅助函数

function buildCalendar(root, todos, getVault, onTodoToggle) {
  var calYear  = window.moment().year();
  var calMonth = window.moment().month();
  var selDay   = window.moment().date();
  var calRoot  = null;
  var gridEl   = null;
  const DOW_LABELS = ['一','二','三','四','五','六','日'];
  var now = window.moment();

  function buildTodoMap() {
    var m = {};
    (todos || []).forEach(function(t) {
      if (t.dueDate) {
        var key = t.dueDate.format('YYYY-MM-DD');
        if (!m[key]) m[key] = [];
        m[key].push({ text: t.text, done: t.done, priority: t.priority, raw: t });
      }
    });
    return m;
  }

  function ensureRoot() {
    if (!calRoot || !calRoot.parentNode) {
      calRoot = document.createElement('div');
      calRoot.className = PLUGIN_ID + '-cal-wrap';
      var ref = root.querySelector('.' + PLUGIN_ID + '-toolbar');
      if (ref && ref.parentNode) ref.parentNode.insertBefore(calRoot, ref.nextSibling);
      else root.prepend(calRoot);
    }
    calRoot.innerHTML = '';
  }

  function renderDetail(tm) {
    if (!calRoot || !calRoot.parentNode) return;
    var old = calRoot.parentNode.querySelector('.' + PLUGIN_ID + '-cal-detail');
    if (old) old.remove();
    var selDate  = window.moment([calYear, calMonth, selDay]);
    var selKey   = selDate.format('YYYY-MM-DD');
    var items    = tm[selKey] || [];
    var det      = document.createElement('div');
    det.className  = PLUGIN_ID + '-cal-detail';
    calRoot.parentNode.insertBefore(det, calRoot.nextSibling);
    var weekDay = ['周日','周一','周二','周三','周四','周五','周六'][selDate.day()];
    det.createDiv({ cls: PLUGIN_ID + '-cal-detail-title',
      text: selDate.format('M月D日') + ' ' + weekDay });
    if (!items.length) {
      det.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty', text: '这一天没有待办 🎉' });
    } else {
      items.forEach(function(td) {
        var citem = det.createDiv({ cls: PLUGIN_ID + '-cal-detail-item' });
        var chk   = citem.createDiv({ cls: PLUGIN_ID + '-cal-detail-check' + (td.done ? ' done' : ''),
                                     text: td.done ? '✓' : '' });
        var span  = citem.createSpan({ cls: PLUGIN_ID + '-cal-detail-text' + (td.done ? ' done' : ''),
          text: (td.done ? '🟢 ' : td.priority === 'high' ? '🔴 ' : td.priority === 'mid' ? '🟡 ' : '🟢 ') + td.text });
        var toggle = async function(e) {
          if (e) e.stopPropagation();
          td.raw.done = !td.raw.done;
          td.raw.doneDate = td.raw.done ? window.moment() : null;
          if (getVault) await saveTodos(getVault(), todos);
          renderAll();
          if (onTodoToggle) onTodoToggle();
        };
        chk.onclick  = toggle;
        span.onclick = toggle;
      });
    }
  }

  function renderAll() {
    var todoMap = buildTodoMap();
    ensureRoot();
    var header = calRoot.createDiv({ cls: PLUGIN_ID + '-cal-header' });
    header.createDiv({ cls: PLUGIN_ID + '-cal-title', text: calYear + '年' + (calMonth + 1) + '月' });
    var nav = header.createDiv({ cls: PLUGIN_ID + '-cal-nav' });
    var prevBtn  = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '‹' });
    var todayBtn = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '●', attr:{ title:'回到今天' } });
    var nextBtn  = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '›' });
    gridEl = calRoot.createDiv({ cls: PLUGIN_ID + '-cal-grid' });
    DOW_LABELS.forEach(function(d) { gridEl.createDiv({ cls: PLUGIN_ID + '-cal-dow', text: d }); });
    var firstDay    = window.moment([calYear, calMonth, 1]);
    var startDow    = firstDay.day();
    var offset      = startDow === 0 ? 6 : startDow - 1;
    var daysInMonth = firstDay.daysInMonth();
    var prevDays    = window.moment([calYear, calMonth, 1]).subtract(1,'month').daysInMonth();
    for (var i = offset - 1; i >= 0; i--)
      gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell dim', text: String(prevDays - i) });
    for (var d = 1; d <= daysInMonth; d++) {
      var cellDate = window.moment([calYear, calMonth, d]);
      var dateKey  = cellDate.format('YYYY-MM-DD');
      var dayTodos = todoMap[dateKey] || [];
      var isToday  = cellDate.isSame(now, 'day');
      var isSel    = d === selDay;
      var cls = PLUGIN_ID + '-cal-cell'
                + (isToday ? ' today' : '')
                + (dayTodos.length ? ' has-todos' : '')
                + (isSel   ? ' selected' : '');
      var cell = gridEl.createDiv({ cls });
      cell.createSpan({ text: String(d) });
      if (dayTodos.length) {
        var dots = cell.createDiv({ cls: PLUGIN_ID + '-cal-dots' });
        var pc = { high:'#ef4444', mid:'#f59e0b', low:'#22c55e' };
        dayTodos.slice(0,3).forEach(function(t) {
          var color = t.done ? '#22c55e' : (pc[t.priority] || '#818cf8');
          dots.createDiv({ cls: PLUGIN_ID+'-cal-dot', attr:{ style:'background:'+color } });
        });
      }
      cell.onclick = function() { selDay = d; renderDayDetailOnly(todoMap); };
    }
    var total = offset + daysInMonth;
    var needTrail = (7 - (total % 7)) % 7;
    var fill = Math.max(0, 42 - total - needTrail) + needTrail;
    for (var j = 1; j <= fill; j++)
      gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell dim', text: String(j) });
    var goMonth = function(dir) {
      gridEl.classList.remove('slide-in');
      gridEl.classList.add(dir > 0 ? 'slide-out-left' : 'slide-out-right');
      setTimeout(function() {
        calMonth += dir;
        if (calMonth < 0)  { calMonth = 11; calYear--; }
        if (calMonth > 11) { calMonth = 0;  calYear++; }
        selDay = Math.min(selDay, window.moment([calYear, calMonth, 1]).daysInMonth());
        renderAll();
        requestAnimationFrame(function() {
          var g = calRoot.querySelector('.' + PLUGIN_ID + '-cal-grid');
          if (g) { g.classList.remove('slide-out-left','slide-out-right'); g.classList.add('slide-in'); }
        });
      }, 200);
    };
    prevBtn.onclick  = function() { goMonth(-1); };
    nextBtn.onclick  = function() { goMonth(1); };
    todayBtn.onclick = function() { calYear = now.year(); calMonth = now.month(); selDay = now.date(); renderAll(); };
    renderDetail(todoMap);
  }

  function renderDayDetailOnly(tm) {
    if (gridEl) {
      var allCells = gridEl.querySelectorAll('.' + PLUGIN_ID + '-cal-cell');
      var cur = 0;
      allCells.forEach(function(c) {
        if (c.classList.contains('dim')) return;
        cur++;
        c.classList.toggle('selected', cur === selDay);
      });
    }
    renderDetail(tm);
  }

  renderAll();
  return renderAll;
}
