import React, { useEffect, useRef, useState, useMemo } from 'react';
import '../../styles/common/BannerNavbar.css';
import PenroseLogo from './PenroseLogo';

/**
 * BannerNavbar: 集成导航与 BiliBanner 背景的复用组件
 * 功能：
 * 1. 读取 /banner/manifest.json 获取主题列表
 * 2. 根据外部传入 bannerId 起步，滚动隐藏与显示时轮换主题
 * 3. 背景层加载 data.json 构造多层 parallax，指针移动触发横向偏移
 * 4. 样式全部集中在 BiliBanner.css 中（使用 .banner-navbar 根类）
 * 5. 宽 100vw，高 15vh，背景填满该区域
 */
export default function BannerNavbar({ bannerId, strength = 1, children }) {
  const [navHidden, setNavHidden] = useState(false);
  const [manifest, setManifest] = useState([]);
  const [index, setIndex] = useState(0);
  const [layers, setLayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const lastScrollRef = useRef(0);
  const prevHiddenRef = useRef(false);
  const initializedRef = useRef(false);
  const containerRef = useRef(null);

  // 读取 manifest（主题清单）
  useEffect(() => {
    let dead = false;
    fetch('/banner/manifest.json?_=' + Date.now())
      .then(r => (r.ok ? r.json() : []))
      .then(list => { if (!dead) setManifest(Array.isArray(list) ? list : []); })
      .catch(() => { if (!dead) setManifest([]); });
    return () => { dead = true; };
  }, []);

  // 起步 index：外部 bannerId 对应位置，否则 0
  useEffect(() => {
    if (!manifest.length) return;
    if (bannerId) {
      const start = manifest.findIndex(x => x.id === bannerId);
      if (start >= 0 && start !== index) setIndex(start);
      else if (start === -1 && index !== 0) setIndex(0);
    } else if (index >= manifest.length) {
      setIndex(0);
    }
  }, [manifest, bannerId, index]);

  // 滚动显隐逻辑（与原 SiteNavbar 保持）
  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY || document.documentElement.scrollTop || 0;
      const last = lastScrollRef.current;
      const goingDown = current > last;
      const delta = Math.abs(current - last);
      if (current <= 0) setNavHidden(false);
      else if (goingDown && delta > 4 && current > 80) setNavHidden(true);
      else if (!goingDown && delta > 4) setNavHidden(false);
      lastScrollRef.current = current;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 监听隐藏 -> 显示：轮换主题
  useEffect(() => {
    const prev = prevHiddenRef.current;
    if (initializedRef.current && prev === true && navHidden === false && manifest.length > 0) {
      setIndex(i => (i + 1) % manifest.length);
    }
    prevHiddenRef.current = navHidden;
    if (!initializedRef.current) initializedRef.current = true;
  }, [navHidden, manifest.length]);

  const activeId = useMemo(() => (manifest.length ? manifest[index]?.id : bannerId), [manifest, index, bannerId]);

  // 加载 data.json -> 构造 layers（完全数据驱动）
  useEffect(() => {
    let dead = false;
    setLoading(true); setError(null); setLayers([]);
    if (!activeId) { setLoading(false); return; }
    fetch(`/banner/assets/${activeId}/data.json?_=${Date.now()}`)
      .then(r => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.json(); })
      .then(json => {
        if (dead) return;
        const init = Array.isArray(json) ? json.map(item => {
          const [m11 = 1, m12 = 0, m21 = 0, m22 = 1, tx = 0, ty = 0] = Array.isArray(item.transform) ? item.transform : [1,0,0,1,0,0];
          return {
            ...item,
            // 原始矩阵分量保留，便于后续扩展
            m11, m12, m21, m22,
            // 原始位移
            baseTx: tx, baseTy: ty,
            // 实时位移/旋转（像素/度）
            tx: tx, ty: ty, rot: 0,
            // 交互参数：a(横向视差)，deg(旋转因子)，g(纵向位移因子)
            accel: item.a ?? 0,
            deg: item.deg ?? 0,
            g: item.g ?? 0
          };
        }) : [];
        setLayers(init);
      })
      .catch(e => { if (!dead) setError(e.message || '加载失败'); })
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [activeId]);

  // Parallax 指针交互（完全由 data.json 的 a/deg/g 决定，无通用风格干预）
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !layers.length) return;
    let frame = null;
    let pointerX = 0;
    let pointerY = 0;
    let hovering = false;
    const onPointerMoveWindow = (e) => {
      const rect = el.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (inside) {
        hovering = true;
        pointerX = e.clientX - (rect.left + rect.width / 2);
        pointerY = e.clientY - (rect.top + rect.height / 2);
      } else {
        if (hovering) hovering = false;
        pointerX = 0;
        pointerY = 0;
      }
      if (!frame) frame = requestAnimationFrame(applyParallax);
    };
    const onPointerLeaveWindow = () => {
      hovering = false;
      pointerX = 0;
      pointerY = 0;
      if (!frame) frame = requestAnimationFrame(applyParallax);
    };
    function applyParallax() {
      frame = null;
      const rect = el.getBoundingClientRect();
      const containerH = rect.height || 1;
      setLayers(prev => prev.map(layer => {
        const lh = Number(layer.height) || containerH; // 使用资源原始高度近似为设计画布高度
        const scale = containerH / lh;                 // 让位移随高度等比缩放
        const tx = layer.baseTx * scale + (pointerX || 0) * (layer.accel || 0) * strength * scale;
        const ty = layer.baseTy * scale + (pointerY || 0) * (layer.g || 0) * strength * scale;
        const rot = (layer.deg || 0) ? (pointerX || 0) * layer.deg * strength : 0; // 单位：度
        return { ...layer, tx, ty, rot };
      }));
    }
    window.addEventListener('pointermove', onPointerMoveWindow, { passive: true });
    window.addEventListener('pointerleave', onPointerLeaveWindow, { passive: true });
    window.addEventListener('blur', onPointerLeaveWindow);
    // 初始渲染一次，按容器高度缩放到位
    if (!frame) frame = requestAnimationFrame(applyParallax);
    return () => {
      window.removeEventListener('pointermove', onPointerMoveWindow);
      window.removeEventListener('pointerleave', onPointerLeaveWindow);
      window.removeEventListener('blur', onPointerLeaveWindow);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [layers.length, strength]);

  // 资源路径重写
  const resolveSrc = (src) => {
    if (!src) return '';
    return src.replace(/^\.\/assets\/[^/]+\//, `/banner/assets/${activeId}/`);
  };

  return (
    <nav className={`banner-navbar${navHidden ? ' is-hidden' : ''}`} aria-label="主导航">
      <div ref={containerRef} className="bili-banner" aria-hidden="true">
        {loading && <div className="bili-banner-loading">Loading...</div>}
        {error && !loading && <div className="bili-banner-error">{error}</div>}
        {!loading && !error && layers.map((layer, i) => {
          const opacity = layer.opacity ? parseFloat(layer.opacity[0]) : 1;
          const tx = Number.isFinite(layer.tx) ? layer.tx : 0;
          const ty = Number.isFinite(layer.ty) ? layer.ty : 0;
          const rot = Number.isFinite(layer.rot) ? layer.rot : 0; // deg
          const style = {
            transform: `translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg)`,
            opacity,
          };
          return (
            <div className="bili-layer" style={style} key={i}>
              {layer.tagName === 'video' ? (
                <video className="bili-media" autoPlay loop muted playsInline>
                  <source src={resolveSrc(layer.src)} />
                </video>
              ) : (
                <img className="bili-media" src={resolveSrc(layer.src)} alt="banner layer" draggable={false} />
              )}
            </div>
          );
        })}
      </div>
      <div className="nav-inner">
        <div className="nav-brand" aria-label="站点标识">
          <PenroseLogo size={120} href="/" />
        </div>
        <div className="nav-actions">
          {children}
        </div>
      </div>
    </nav>
  );
}
