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