import { promises as fs } from 'fs';
import path from 'path';

const root = path.resolve(process.cwd());
const modelsRoot = path.join(root, 'public', 'live2dmodels');
const outFile = path.join(modelsRoot, 'manifest.json');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.model3.json')) {
      results.push(full);
    }
  }
  return results;
}

function toPublicUrl(absFile) {
  const rel = path.relative(path.join(root, 'public'), absFile).split(path.sep).join('/');
  return '/' + rel;
}

(async () => {
  try {
    const exists = await fs.stat(modelsRoot).then(() => true).catch(() => false);
    if (!exists) {
      console.error('[live2d] 目录不存在:', modelsRoot);
      process.exit(1);
    }
    const files = await walk(modelsRoot);
    // 去重并排序（中文名稳定）
    const urls = Array.from(new Set(files.map(toPublicUrl))).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    const payload = { generatedAt: new Date().toISOString(), models: urls };
    await fs.writeFile(outFile, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`[live2d] Manifest 写入 ${outFile}，共 ${urls.length} 个模型`);
  } catch (err) {
    console.error('[live2d] 生成 manifest 失败:', err);
    process.exit(1);
  }
})();
