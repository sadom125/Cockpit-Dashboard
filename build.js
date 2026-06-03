// build.js — 把 src/ 下的模块打包成 main.js
// 用法: node build.js

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const OUT_FILE = path.join(__dirname, 'main.js');
const CSS_FILE = path.join(__dirname, 'styles.css');

// 模块加载顺序（重要：依赖关系决定顺序）
const MODULES = [
  'constants.js',
  'utils.js',
  'todos.js',
  'calendar.js',
  'stats.js',
  'bookmarks.js',
  'search.js',
  'heatmap.js',
  'flash.js',
];

// 读取 CSS
const css = fs.readFileSync(CSS_FILE, 'utf8');

// 拼接所有模块
const parts = [];
for (const mod of MODULES) {
  const filePath = path.join(SRC_DIR, mod);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 缺少模块: ${mod}`);
    process.exit(1);
  }
  let code = fs.readFileSync(filePath, 'utf8');
  // 去掉 'use strict'（只保留最顶部的）
  code = code.replace(/^'use strict';\s*/gm, '');
  parts.push(`// ===== ${mod} =====\n${code.trim()}`);
}

const body = parts.join('\n\n');

// 生成 main.js
const output = `'use strict';
var obsidian = require('obsidian');

// ===== styles.css =====
const CSS = ${JSON.stringify(css)};

${body}

// ===== main.js (entry) =====
module.exports = CockpitPlugin;
`;

fs.writeFileSync(OUT_FILE, output);
console.log(`✅ 构建完成: ${OUT_FILE} (${output.length} bytes, ${output.split('\n').length} 行)`);
