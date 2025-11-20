import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LoadingVisual from "../components/loading/LoadingVisual";

/**
 * Loading 页面
 * 职责：
 *  - 根据 target 参数（welcome|home）预加载背景、Live2D 元数据、用户资料与音乐/背景列表
 *  - 展示可爱 Loading 动画与进度，完成后无缝跳转目标页
 * 交互：
 *  - /api/user/profile/{id}、/api/usermusic/list、/api/usermusicbg/list
 *  - 组件：LoadingVisual（纯渲染动画）
 */

// Tiny helpers
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const withTimeout = async (p, ms, fallback = null) => {
  let t;
  try {
    return await Promise.race([
      p,
      new Promise((_, rej) => t = setTimeout(() => rej(new Error("timeout")), ms)),
    ]);
  } finally {
    clearTimeout(t);
  }
};

const loadImage = (url) => new Promise((resolve) => {
  if (!url) return resolve(false);
  const img = new Image();
  img.onload = () => resolve(true);
  img.onerror = () => resolve(false);
  img.decoding = "async";
  img.loading = "eager";
  img.src = url;
});

const loadVideoMeta = (url) => new Promise((resolve) => {
  if (!url) return resolve(false);
  const v = document.createElement("video");
  const done = () => { cleanup(); resolve(true); };
  const fail = () => { cleanup(); resolve(false); };
  const cleanup = () => {
    v.onloadedmetadata = null; v.oncanplaythrough = null; v.onerror = null;
    try { v.removeAttribute("src"); v.load(); } catch {}
  };
  v.preload = "metadata";
  v.muted = true; v.src = url;
  v.onloadedmetadata = done; v.oncanplaythrough = done; v.onerror = fail;
});

const fetchJson = async (url) => {
  try {
    const res = await withTimeout(fetch(url, { cache: "force-cache" }), 5000);
    if (!res || !res.ok) return null;
    return await res.json().catch(() => null);
  } catch { return null; }
};

const fetchText = async (url) => {
  try {
    const res = await withTimeout(fetch(url, { cache: "force-cache" }), 5000);
    if (!res || !res.ok) return null;
    await res.text();
    return true;
  } catch { return null; }
};

// Welcome 资源（与 Welcome.jsx 内一致）
const welcomeBackgrounds = [
  { type: "video", src: "/videos/bgvspring01.mp4", poster: "/images/bgvspring01.jpg" },
  { type: "video", src: "/videos/bgvspring02.mp4", poster: "/images/bgvspring02.jpg" },
  { type: "video", src: "/videos/bgvsummer01.mp4", poster: "/images/bgvsummer01.jpg" },
  { type: "video", src: "/videos/bgvsummer02.mp4", poster: "/images/bgvsummer02.jpg" },
  { type: "video", src: "/videos/bgvautumn01.mp4", poster: "/images/bgvautumn01.jpg" },
  { type: "video", src: "/videos/bgvautumn02.mp4", poster: "/images/bgvautumn02.jpg" },
  { type: "video", src: "/videos/bgvwinter01.mp4", poster: "/images/bgvwinter01.jpg" },
  { type: "video", src: "/videos/bgvwinter02.mp4", poster: "/images/bgvwinter02.jpg" },
];

// 预加载 Welcome：确保海报图全部就绪 + 首个视频可播放
async function preloadWelcome(update) {
  const posters = welcomeBackgrounds.map(b => b.poster).filter(Boolean);
  let done = 0; const total = posters.length + 1; // +1 为首个视频
  const bump = () => update(Math.min(100, Math.floor(++done / total * 100)));
  await Promise.all(posters.map(async (p) => { await withTimeout(loadImage(p), 4000).catch(() => null); bump(); }));
  await withTimeout(loadVideoMeta(welcomeBackgrounds[0].src), 6000).catch(() => null);
  bump();
  return true;
}

// 预加载 Live2D 核心脚本与元数据（不强制等到模型纹理全部下载，避免过慢）
async function preloadLive2D() {
  await Promise.all([
    fetchText("/live2d-widget-master/dist/autoload.js"),
    fetchJson("/live2d-widget-master/dist/waifu-tips.json"),
    fetchJson("/live2d-models/model_list.json"),
    fetchText("/live2d-widget-master/dist/cubism5/live2dcubismcore.min.js"),
  ]);
  return true;
}

// 预加载 Home：请求用户资料与资源首要子集
async function preloadHome(update) {
  const uid = (() => { try { return localStorage.getItem("userId"); } catch { return null; } })();
  const tasks = [];
  let total = 1; // 至少一个 Live2D 任务
  let done = 0; const bump = () => update(Math.min(100, Math.floor(++done / total * 100)));

  // Live2D（并行）
  tasks.push(preloadLive2D().finally(bump));

  if (uid) {
    // 用户资料
    total += 1;
    tasks.push((async () => {
      const me = await fetchJson(`/api/user/profile/${uid}`);
      // 头像/背景/二维码
      const urls = [];
      if (me?.avatarUrl) urls.push(me.avatarUrl);
      if (me?.backgroundUrl) urls.push(me.backgroundUrl);
      if (me?.qqQrUrl) urls.push(me.qqQrUrl);
      if (me?.wechatQrUrl) urls.push(me.wechatQrUrl);
      // 背景类型判定
      const imgLike = (u) => /\.(png|jpe?g|gif|webp|avif)$/i.test(u);
      const videoLike = (u) => /\.(mp4|webm|ogg)$/i.test(u);
      const loadOne = (u) => videoLike(u) ? withTimeout(loadVideoMeta(u), 6000) : withTimeout(loadImage(u), 4000);
      total += urls.length;
      await Promise.all(urls.map(u => loadOne(u).catch(() => null))).catch(() => null);
      done += urls.length; update(Math.min(100, Math.floor(done / total * 100)));
    })().finally(bump));

    // 音乐与背景列表
    total += 2;
    tasks.push((async () => {
      const list = await fetchJson(`/api/usermusic/list?userId=${uid}`) || [];
      const arr = Array.isArray(list?.data) ? list.data : (Array.isArray(list) ? list : []);
      // 预加载前两首的 metadata
      const firstTwo = arr.slice(0, 2).map(x => x.musicPath).filter(Boolean);
      total += firstTwo.length;
      await Promise.all(firstTwo.map(src => withTimeout(loadVideoMeta(src), 6000).catch(() => null)));
      done += firstTwo.length; update(Math.min(100, Math.floor(done / total * 100)));
    })().finally(bump));

    tasks.push((async () => {
      const list = await fetchJson(`/api/usermusicbg/list?userId=${uid}`) || [];
      const arr = Array.isArray(list?.data) ? list.data : (Array.isArray(list) ? list : []);
      // 预加载匹配第一首音乐的一个背景
      const first = arr[0]?.bgPath;
      if (first) {
        const isVideo = /\.(mp4|webm|ogg)$/i.test(first);
        await withTimeout(isVideo ? loadVideoMeta(first) : loadImage(first), isVideo ? 6000 : 4000).catch(() => null);
      }
    })().finally(bump));
  }

  await withTimeout(Promise.allSettled(tasks), 8000).catch(() => null);
  // 给视觉动画一点缓冲
  await sleep(5000);
  return true;
}

export default function Loading() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const target = useMemo(() => new URLSearchParams(search).get("target") || "welcome", [search]);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Loading");
  const didStartRef = useRef(false);

  useEffect(() => {
    if (didStartRef.current) return;
    didStartRef.current = true;
    const run = async () => {
      try {
        if (target === "home") {
          setMessage("加载个人资源");
          await preloadHome(setProgress);
        } else {
          setMessage("加载欢迎页资源");
          await preloadWelcome(setProgress);
        }
      } finally {
        // 进入目标页
        navigate(
          target === "home" ? "/home" :
          target === "mainpage" ? "/mainpage" :
          "/welcome",
          { replace: true }
        );
      }
    };
    run();
  }, [target, navigate]);

  return <LoadingVisual message={message} progress={progress} />;
}
