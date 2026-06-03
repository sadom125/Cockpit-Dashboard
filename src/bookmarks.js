// bookmarks.js — 收藏功能
// 依赖：window.Cockpit (PLUGIN_ID, E, loadBookmarks, saveBookmarks)

(function(){
  const PID = window.Cockpit.PLUGIN_ID;
  const BOOKMARK_FILE = window.Cockpit.BOOKMARK_FILE;

  window.Cockpit.loadBookmarks = async function(vault) {
    try {
      const f = vault.getAbstractFileByPath(BOOKMARK_FILE);
      if (!f) return new Set();
      const content = await vault.read(f);
      const set = new Set();
      content.split('\n').forEach(l => { const t=l.trim(); if(t && !t.startsWith('#')) set.add(t); });
      return set;
    } catch(e) { return new Set(); }
  };

  window.Cockpit.saveBookmarks = async function(vault, bmSet) {
    try {
      const dir = BOOKMARK_FILE.split('/')[0];
      if (!vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
      const content = '# 收藏文件\n\n' + Array.from(bmSet).sort().join('\n') + '\n';
      const file = vault.getAbstractFileByPath(BOOKMARK_FILE);
      if (file) await vault.modify(file, content);
      else await vault.create(BOOKMARK_FILE, content);
    } catch(e) { console.warn('saveBookmarks',e); }
  };

  // 渲染收藏 section（局部更新，不重建整个页面）
  window.Cockpit.refreshBookmarkSection = async function(root, allFiles, bookmarks, vault) {
    let bmTitle = null, bmEl = null;
    root.querySelectorAll('.' + PID + '-section-title').forEach(el => {
      if (el.textContent.includes('收藏文件')) bmTitle = el;
    });
    if (bmTitle) bmEl = bmTitle.nextElementSibling;

    if (bookmarks.size === 0) {
      if (bmTitle) bmTitle.remove();
      if (bmEl) bmEl.remove();
      return;
    }

    if (!bmEl || !bmEl.classList.contains(PID + '-recent')) {
      if (bmTitle) bmTitle.remove();
      if (bmEl) bmEl.remove();
      bmTitle = root.createDiv({ cls: PID + '-section-title', text: '⭐ 收藏文件' });
      bmEl = root.createDiv({ cls: PID + '-recent' });
      let recentTitle = null;
      root.querySelectorAll('.' + PID + '-section-title').forEach(el => {
        if (el.textContent.includes('最近更新')) recentTitle = el;
      });
      if (recentTitle && recentTitle.nextElementSibling) {
        recentTitle.nextElementSibling.after(bmEl);
        bmEl.before(bmTitle);
      }
    }

    bmEl.innerHTML = '';
    let hasVisible = false;
    for (const path of bookmarks) {
      const f = allFiles.find(ff => ff.path === path);
      if (!f) { bookmarks.delete(path); continue; }
      hasVisible = true;
      const item = bmEl.createDiv({ cls: PID + '-recent-item' });
      const starBtn = item.createSpan({ cls: PID + '-bookmark-btn starred', text: '★', attr: { title: '取消收藏' } });
      starBtn.onclick = async (e) => {
        e.stopPropagation();
        bookmarks.delete(path);
        await window.Cockpit.saveBookmarks(vault, bookmarks);
        await window.Cockpit.refreshBookmarkSection(root, allFiles, bookmarks, vault);
      };
      const link = item.createEl('a', { cls: PID + '-recent-link', text: f.basename, href: '#' });
      link.onclick = e => {
        e.preventDefault();
        // 需要 app 引用，通过 opts 传入
        if (window.Cockpit._appRef) window.Cockpit._appRef.workspace.getUnpinnedLeaf().setViewState({ type: 'markdown', state: { file: f.path } });
      };
      item.createDiv({ cls: PID + '-recent-time', text: f.path });
    }
    if (!hasVisible) { bmTitle.remove(); bmEl.remove(); }
  };
})();
