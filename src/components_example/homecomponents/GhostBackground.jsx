import React, { useEffect, useRef } from "react";
import Ghost from "./styles/ghostbackground/GhostCore";
import "./styles/ghostbackground/ghostbackground.css";

/*
Home 文章区域背景幽灵组件：功能文件置于 homecomponents 根目录；
样式置于 homecomponents/styles/ghostbackground；
*/
export default function GhostBackground({ style, className }) {
  const overlayRef = useRef(null);
  const sceneRef = useRef(null);
  const ghostInstanceRef = useRef(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const scene = sceneRef.current;
    if (!overlay || !scene) return;

    const ghost = new Ghost(scene, { parent: overlay });
    ghostInstanceRef.current = ghost;
    ghost.reset();

    return () => {
      try { clearInterval(ghost.activityInterval); } catch {}
      try { if (ghost.scene && ghost.scene.remove) ghost.scene.remove(); } catch {}
      ghostInstanceRef.current = null;
    };
  }, []);

  return (
    <div ref={overlayRef} className={`ghost-overlay ${className || ""}`} style={style}>
      <div ref={sceneRef} className="scene-container" tabIndex={0}>
        {/* emerge-clip: 裁剪黑洞以下的部分，实现从黑洞冒出效果 */}
        <div className="emerge-clip">
          <div className="ghost-container">
            <div className="ghost">
              <div className="ghost-head">
                <div className="ghost-face">
                  <div className="eyes-row">
                    <div className="eye left" />
                    <div className="eye right" />
                  </div>
                  <div className="mouth-row">
                    <div className="cheek left" />
                    <div className="mouth">
                      <div className="mouth-top" />
                      <div className="mouth-bottom" />
                    </div>
                    <div className="cheek right" />
                  </div>
                </div>
              </div>
              <div className="ghost-body">
                <div className="ghost-hand hand-left" />
                <div className="ghost-hand hand-right" />
                <div className="ghost-skirt">
                  <div className="pleat down" />
                  <div className="pleat up" />
                  <div className="pleat down" />
                  <div className="pleat up" />
                  <div className="pleat down" />
                </div>
              </div>
            </div>
          </div>
          {/* 星星元素（随幽灵一起被裁剪） */}
          <div className="star star-1 round yellow"><div className="star-element" /></div>
          <div className="star star-2 pointy orange"><div className="star-element" /></div>
          <div className="star star-3 round blue"><div className="star-element" /></div>
          <div className="star star-4 pointy yellow"><div className="star-element" /></div>
          <div className="star star-5 round orange"><div className="star-element" /></div>
          <div className="star star-6 pointy blue"><div className="star-element" /></div>
        </div>
        {/* 黑洞（沿用 shadow 元素） */}
        <div className="shadow-container">
          <div className="shadow" />
          <div className="shadow-bottom" />
        </div>
      </div>
    </div>
  );
}
