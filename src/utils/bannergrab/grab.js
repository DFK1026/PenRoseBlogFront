/*
 * @Author: ShawnPhang
 * @Date: 2023-09-30 21:58:50
 * @Description: 网页抓取
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2025-09-10 16:38:49
 */
/* eslint-disable no-undef */
// 使用 CommonJS 供 Node CLI 执行，前端 ESLint 会报 require 未定义，这里通过注释关闭。
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// 支持参数：
//   --name "主题名称"  （可选）
//   --id   "文件夹名/slug"（可选，默认使用当天日期 YYYY-MM-DD）
// 用法示例： node grab.js --name "海风之夜" --id haifeng-night
const argv = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    const b = process.argv[i + 1];
    if (a.startsWith("--")) { o[a.slice(2)] = b && !b.startsWith("--") ? (i++, b) : true; }
  }
  return o;
})();

console.log('正在下载资源中...');

let saveFolder = "";
const today = new Date();
const year = today.getFullYear();
const month = ("0" + (today.getMonth() + 1)).slice(-2); // 月份从 0 开始计数，所以需要加 1，并且保证两位数格式
const day = ("0" + today.getDate()).slice(-2); // 保证两位数格式
const date = year + "-" + month + "-" + day

// 计算输出文件夹（真实磁盘位置）与 data.json 中引用使用的相对路径
const bannerRoot = path.resolve(__dirname, '../../../public/banner');
const assetsRoot = path.join(bannerRoot, 'assets');
const id = (argv.id && String(argv.id)) || date; // 默认用日期作为 id
const themeName = (argv.name && String(argv.name)) || id;

const folderPath = path.join(assetsRoot, id);
if (fs.existsSync(folderPath)) {
  // 如果文件夹存在，则清空文件夹
  fs.readdirSync(folderPath).forEach((file) => {
    const filePath = path.join(folderPath, file);
    fs.unlinkSync(filePath); // 删除文件
  });
} else {
  // 如果文件夹不存在，则创建文件夹
  fs.mkdirSync(folderPath, { recursive: true });
}
saveFolder = folderPath;

const data = [];

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.setViewport({
    width: 1650,
    height: 800
  })

  try {
    await page.goto("https://www.bilibili.com/", {
      waitUntil: "domcontentloaded",
    });
    await sleep(1000);
    await page.goto("https://www.bilibili.com/", {
      waitUntil: "domcontentloaded",
    });

    await page.waitForSelector(".animated-banner");

    await sleep(2000);

    // 获取所有 ".layer" 元素
    let layerElements = await page.$$(".animated-banner .layer");
    // 获取并下载保存数据
    for (let i = 0; i < layerElements.length; i++) {
      const layerFirstChild = await page.evaluate(async (el) => {
        const pattern = /translate\(([-.\d]+px), ([-.\d]+px)\)/;
        const { width, height, src, style, tagName } = el.firstElementChild;
        const matches = style.transform.match(pattern);
        const transform = [1,0,0,1,...matches.slice(1).map(x => +x.replace('px', ''))]
        return { tagName: tagName.toLowerCase(), opacity: [style.opacity,style.opacity], transform, width, height, src, a: 0.01 };
      }, layerElements[i]);
    //   data.push(layerFirstChild);
      await download(layerFirstChild) // 下载并保存数据
    }
    // 完成后自动偏移banner
    let element = await page.$('.animated-banner')
    let { x, y } = await element.boundingBox()
    await page.mouse.move(x + 0, y + 50)
    await page.mouse.move(x + 1000, y, { steps: 1 })
    await sleep(1200);
    // 偏移后计算每个图层的相对位置，并得出加速度a
    layerElements = await page.$$(".animated-banner .layer"); // 重新获取
    for (let i = 0; i < layerElements.length; i++) {
      const skew = await page.evaluate(async (el) => {
        const pattern = /translate\(([-.\d]+px), ([-.\d]+px)\)/;
        const matches = el.firstElementChild.style.transform.match(pattern);
        return matches.slice(1).map(x => +x.replace('px', ''))[0]
      }, layerElements[i]);
      data[i].a = (skew - data[i].transform[4]) / 1000
    }
  
  } catch (error) {
    console.error("Error:", error);
  }

  async function download(item) {
    const fileArr = item.src.split("/");
    const fileName = fileArr[fileArr.length - 1];
    const filePath = path.join(saveFolder, fileName);

    const content = await page.evaluate(async (url) => {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      return { buffer: Array.from(new Uint8Array(buffer)) };
    }, item.src);
    //   const base64Data = Buffer.from(blobContent).toString('base64');
    //   fs.writeFileSync(filePath, base64Data, 'base64');
    const fileData = Buffer.from(content.buffer);
    fs.writeFileSync(filePath, fileData);
    // data.json 内的 src 使用相对标记，以便前端替换成 /banner/assets
    data.push({ ...item, src: `./assets/${id}/${fileName}` });
  }

  fs.writeFileSync(path.join(saveFolder, `data.json`), JSON.stringify(data, null, 2));
  
  console.log('正在写入本地文件...');

  await sleep(300)

  // 维护 manifest.json
  const manifestPath = path.join(bannerRoot, 'manifest.json');
  let manifest = [];
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { manifest = []; }
  if (!Array.isArray(manifest)) manifest = [];
  const idx = manifest.findIndex(m => m.id === id);
  const entry = { id, name: themeName, createdAt: date };
  if (idx >= 0) manifest[idx] = entry; else manifest.unshift(entry);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  await sleep(300)
  await browser.close();
  console.log(`完成，主题: ${themeName} (id: ${id})，请运行或刷新开发服务查看效果。`);
})();

function sleep(timeout) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}
