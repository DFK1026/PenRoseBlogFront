import { useEffect, useRef } from "react";

/**
 * WaifuWidget (Live2D 看板娘)
 * - 使用官方 live2d-widgets 的 autoload.js（优先本地，其次 CDN）
 * - 默认固定在页面左下角（库内置样式）
 * - 仅在挂载的页面显示，卸载时移除 DOM
 */
export default function WaifuWidget({
  enableDrag = true,
  logLevel = "error",
  tools = undefined, // 使用库的默认工具按钮
  waifuPath, // 可选：自定义 tips JSON 路径（建议指向 /live2d-widget-master/dist/waifu-tips.json）
  cubism5Path, // 只用 Cubism5 Core 路径（建议指向 /live2d-widget-master/dist/cubism5/live2dcubismcore.min.js）
  cdnPath, // 可选：自定义模型仓库 CDN 路径（建议指向 /live2d-models/）
}) {
  // 用 ref 记录脚本和初始化状态，避免多次插入和初始化
  const scriptsLoadedRef = useRef(false);
  const waifuInitedRef = useRef(false);
  const observerRef = useRef(null);
  const removeDragListenerRef = useRef(null);
  const dragTargetRef = useRef(null);

  useEffect(() => {
    // 1. 明确定义 config
    const config = {
      waifuPath: waifuPath || "/live2d-widget-master/dist/waifu-tips.json",
      cubism5Path: cubism5Path || "/live2d-widget-master/dist/cubism5/live2dcubismcore.min.js",
      cdnPath: cdnPath || "/live2d-models/",
      tools: tools,
      drag: enableDrag,
      logLevel: logLevel,
    };

    // 记忆拖拽位置
    const POS_KEY = "waifu-pos";
    const getSavedPos = () => {
      try {
        const pos = JSON.parse(localStorage.getItem(POS_KEY));
        if (pos && typeof pos.right === "number" && typeof pos.bottom === "number") return pos;
      } catch {}
      return { right: 24, bottom: 24 };
    };
    const savePos = (right, bottom) => {
      try { localStorage.setItem(POS_KEY, JSON.stringify({ right, bottom })); } catch {}
    };

    // 只插入一次脚本，彻底防止变量污染
    const ensureScriptOnce = async (url, id, globalCheck) => {
      if (document.getElementById(id) || (globalCheck && window[globalCheck])) return true;
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.id = id;
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error("js load error: " + url));
        document.body.appendChild(script);
      });
    };

    // 只插入一次 autoload.js 和 cubism5.js
    const ensureAllScripts = async () => {
      if (!scriptsLoadedRef.current) {
        await ensureScriptOnce("/live2d-widget-master/dist/autoload.js", "waifu-autoload-js", "initWidget");
        await ensureScriptOnce(config.cubism5Path, "waifu-cubism5-js", "Live2DCubismCore");
        scriptsLoadedRef.current = true;
      }
    };

    // 只初始化一次，且只允许页面上有一个 waifu DOM
    const initWaifu = () => {
      const waifuDoms = document.querySelectorAll('#waifu');
      if (waifuDoms.length > 1) {
        for (let i = 1; i < waifuDoms.length; i++) {
          waifuDoms[i].parentNode && waifuDoms[i].parentNode.removeChild(waifuDoms[i]);
        }
      }
      if (waifuInitedRef.current) return;
      if (typeof window.initWidget === "function") {
        waifuInitedRef.current = true;
        try { localStorage.removeItem("waifu-display"); } catch {}
        window.initWidget(config);
        observeInject();
        ensureOverrideStyles();
      }
    };

    // 确保样式可见
    const ensureOverrideStyles = () => {
      const id = "waifu-override-styles";
      if (document.getElementById(id)) return;
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        #waifu { display: block !important; opacity: 1 !important; pointer-events: auto !important; z-index: var(--z-widget, 800) !important; }
        #waifu.waifu-active { opacity: 1 !important; }
        #waifu.waifu-hidden { opacity: 0 !important; pointer-events: none !important; }
      `;
      document.head.appendChild(style);
    };

    // 清理所有 waifu 相关 DOM（不清理 script 标签和 window 变量）
    const cleanWaifuDOM = async () => {
      ["#waifu", ".waifu-tool", ".waifu-tool-wrap", ".waifu-tool-box"].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.parentNode && el.parentNode.removeChild(el);
        });
      });
      // 工具区去重
      const toolWraps = document.querySelectorAll('.waifu-tool-wrap');
      if (toolWraps.length > 1) {
        for (let i = 1; i < toolWraps.length; i++) {
          toolWraps[i].parentNode && toolWraps[i].parentNode.removeChild(toolWraps[i]);
        }
      }
      await new Promise(res => setTimeout(res, 100));
    };

    // 观察 waifu 注入，自动定位和拖拽，只允许工具区注入一次
    const observeInject = () => {
      try {
        if (observerRef.current) observerRef.current.disconnect();
        observerRef.current = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.type === "childList") {
              const el = document.getElementById("waifu");
              // 工具区去重：只允许页面上有一个 .waifu-tool-wrap
              const toolWraps = document.querySelectorAll('.waifu-tool-wrap');
              if (toolWraps.length > 1) {
                for (let i = 1; i < toolWraps.length; i++) {
                  toolWraps[i].parentNode && toolWraps[i].parentNode.removeChild(toolWraps[i]);
                }
              }
              if (el && !el.__waifu_drag_inited) {
                ensureOverrideStyles();
                el.style.display = "block";
                el.style.opacity = "1";
                el.style.pointerEvents = "auto";
                el.classList.add("waifu-active");
                el.classList.remove("waifu-hidden");
                el.style.position = "fixed";
                // 读取记忆位置
                const saved = getSavedPos();
                el.style.right = `${saved.right}px`;
                el.style.bottom = `${saved.bottom}px`;
                el.style.left = "auto";
                el.style.top = "auto";
                el.style.zIndex = String(getComputedStyle(document.documentElement).getPropertyValue('--z-widget')?.trim() || '800');
                el.style.background = "transparent";
                el.querySelectorAll('*').forEach(child => {
                  child.style.background = "transparent";
                });
                // 拖拽逻辑
                if (config.drag) {
                  let isDragging = false, startX = 0, startY = 0, startRight = 0, startBottom = 0;
                  dragTargetRef.current = el;
                  const onMouseDown = (e) => {
                    if (e.target.closest('.waifu-tool')) return; // 工具区不触发拖拽
                    e.preventDefault();
                    isDragging = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startRight = parseInt(window.getComputedStyle(dragTargetRef.current).right, 10) || 24;
                    startBottom = parseInt(window.getComputedStyle(dragTargetRef.current).bottom, 10) || 24;
                    document.body.style.userSelect = 'none';
                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                  };
                  const onMouseMove = (e) => {
                    if (!isDragging) return;
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    dragTargetRef.current.style.right = `${startRight - dx}px`;
                    dragTargetRef.current.style.bottom = `${startBottom - dy}px`;
                    dragTargetRef.current.style.left = "auto";
                    dragTargetRef.current.style.top = "auto";
                  };
                  const onMouseUp = () => {
                    if (!isDragging) return;
                    isDragging = false;
                    document.body.style.userSelect = '';
                    // 拖拽结束记忆位置
                    const right = parseInt(dragTargetRef.current.style.right, 10) || 24;
                    const bottom = parseInt(dragTargetRef.current.style.bottom, 10) || 24;
                    savePos(right, bottom);
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                  };
                  dragTargetRef.current.addEventListener('mousedown', onMouseDown);
                  removeDragListenerRef.current = () => {
                    dragTargetRef.current.removeEventListener('mousedown', onMouseDown);
                  };
                  el.__waifu_drag_inited = true;
                }
                // 只观察一次，首次注入后断开 observer，防止多次触发
                if (observerRef.current) {
                  observerRef.current.disconnect();
                  observerRef.current = null;
                }
                break;
              }
            }
          }
        });
        observerRef.current.observe(document.body, { childList: true, subtree: true });
      } catch (err) {
        console.error("waifu observer error", err);
      }
    };

    // 主流程：只插入一次脚本，只初始化一次
    (async () => {
      await ensureAllScripts();
      await cleanWaifuDOM();
      initWaifu();
    })();

    // 交互按钮只控制显示/隐藏，不重新初始化
    window.waifuShow = () => {
      const el = document.getElementById("waifu");
      if (el) {
        el.classList.add("waifu-active");
        el.classList.remove("waifu-hidden");
        el.style.display = "block";
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";
      }
    };
    window.waifuHide = () => {
      const el = document.getElementById("waifu");
      if (el) {
        el.classList.remove("waifu-active");
        el.classList.add("waifu-hidden");
        el.style.display = "none";
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      }
    };
    // 换模型/衣服时调用，只调用 initWidget，不重新插入脚本
    window.reloadWaifu = async (newConfig = {}) => {
      await cleanWaifuDOM();
      Object.assign(config, newConfig);
      if (typeof window.initWidget === "function") {
        window.initWidget(config);
        observeInject();
        ensureOverrideStyles();
      }
    };

    return () => {
      removeDragListenerRef.current && removeDragListenerRef.current();
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      cleanWaifuDOM(); // 只清理 waifu DOM，不移除 script 标签
    };
  }, [waifuPath, cubism5Path, cdnPath, tools, enableDrag, logLevel]);

  // 该组件不渲染任何可见内容（库会向 body 注入 DOM）
  return null;
}
