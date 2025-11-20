import React, { useEffect, useState } from "react";
// 修复路径：样式文件位于 ./styles/loading.css
import "./styles/loading.css";

export default function LoadingVisual({ message = "Loading", progress = 0 }) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDots(d => (d % 3) + 1), 500);
    return () => clearInterval(id);
  }, []);
  const label = `${message}${".".repeat(dots)}`;
  return (
    <div className="loadingpage" aria-live="polite" aria-busy>
      <div className="all">
        <div className="bowl">
          <div className="top-water"></div>
          <div className="water">
            <div className="inner"></div>
          </div>
        </div>
        <div className="center-box">
          <div className="fisherman">
            <div className="body"></div>
            <div className="right-arm"></div>
            <div className="right-leg"></div>
            <div className="rod">
              <div className="handle"></div>
              <div className="rope"></div>
            </div>
            <div className="butt"></div>
            <div className="left-arm"></div>
            <div className="left-leg"></div>
            <div className="head">
              <div className="face"></div>
              <div className="eyebrows"></div>
              <div className="eyes"></div>
              <div className="nose"></div>
              <div className="beard"></div>
              <div className="hat"></div>
            </div>
          </div>
          <div className="boat">
            <div className="motor">
              <div className="parts"></div>
              <div className="button"></div>
            </div>
            <div className="top"></div>
            <div className="boat-body"></div>
            <div className="waves"></div>
          </div>
          <div className="fish">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="#ef4723" aria-hidden>
              <path d="M20.29 5.3a1 1 0 0 0-1.12-.22l-3.2 1.37l-2.9-.97a1 1 0 0 0-1.08.35l-3.2 4.1l-3.2 1.28a1 1 0 0 0-.37 1.66l2.13 2.13a1 1 0 0 0 1.08.22l3.2-1.28l3.2 4.1a1 1 0 0 0 1.08.35l2.9-.97l3.2 1.38a1 1 0 0 0 1.12-.22c2.3-2.3 2.3-6.02 0-8.32c-2.3-2.3-6.02-2.3-8.32 0l-.4.4l-1.42-1.42l.4-.4a8.5 8.5 0 0 1 12.02 12.02z"/>
            </svg>
          </div>
        </div>
        <div className="title">{label}</div>
        <div className="progress">准备资源中… {Math.round(progress)}%</div>
      </div>
    </div>
  );
}
