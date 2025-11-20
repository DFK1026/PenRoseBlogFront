import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles/cardclock/flipclock.css";

// 单个数字翻转卡片
function FlipDigit({ value, prevValue, duration = 600 }) {
  const [front, setFront] = useState(prevValue);
  const [back, setBack] = useState(value);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);
  const lastValRef = useRef(prevValue);

  useEffect(() => {
    const v = String(value);
    const p = String(lastValRef.current);
    if (v === p) return;
    // 触发一次翻转动画
    setFront(p);
    setBack(v);
    setRunning(true);
    // 动画结束后，前面的数字也变为新值，并清除 running
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setRunning(false);
      setFront(v);
      lastValRef.current = v;
    }, duration);
    // 清理
    return () => clearTimeout(timerRef.current);
  }, [value, duration]);

  // 初始同步：首次渲染时显示正确的 front
  useEffect(() => {
    setFront(String(value));
    lastValRef.current = String(value);
  }, []);

  return (
    <div className={`flip ${running ? "running" : ""}`} aria-label={front}>
      <div className="digital front" data-number={front} />
      <div className="digital back" data-number={back} />
    </div>
  );
}

// 冒号分隔符
function Divider() {
  return <div className="divider">:</div>;
}

// 生成 HHMMSS 字符串与数组
function getTimeStr(date) {
  const pad = (n) => n.toString().padStart(2, "0");
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return h + m + s;
}

export default function FlipClock({
  // 尺寸控制：整体缩放（1 为默认）
  scale = 0.85,
  // 是否显示秒
  showSeconds = true,
  // 相对 AudioVisualizer 居中定位时，是否允许点击穿透
  pointerEvents = "none",
}) {
  const [nowStr, setNowStr] = useState(getTimeStr(new Date()));
  const prevStrRef = useRef(nowStr);

  useEffect(() => {
    // 对齐系统秒边界，避免累计漂移导致的抖动；使用递归 setTimeout 精准调度
    let cancelled = false;
    const schedule = () => {
      if (cancelled) return;
      const now = Date.now();
      const delay = 1000 - (now % 1000) + 5; // 轻微补偿，尽量避开边界竞争
      setTimeout(() => {
        if (cancelled) return;
        const s = getTimeStr(new Date());
        // 使用函数式更新拿到上一拍的值，可靠写入 prevStrRef，避免闭包读到陈旧 nowStr
        setNowStr((prev) => {
          prevStrRef.current = prev;
          return s;
        });
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
    };
  }, []);

  const digits = useMemo(() => nowStr.split(""), [nowStr]);
  const prevDigits = useMemo(() => prevStrRef.current.split(""), [nowStr]);

  // 结构：HH:MM[:SS]
  const blocks = (
    <>
      <FlipDigit value={digits[0]} prevValue={prevDigits[0]} />
      <FlipDigit value={digits[1]} prevValue={prevDigits[1]} />
      <Divider />
      <FlipDigit value={digits[2]} prevValue={prevDigits[2]} />
      <FlipDigit value={digits[3]} prevValue={prevDigits[3]} />
      {showSeconds && <Divider />}
      {showSeconds && <FlipDigit value={digits[4]} prevValue={prevDigits[4]} />}
      {showSeconds && <FlipDigit value={digits[5]} prevValue={prevDigits[5]} />}
    </>
  );

  return (
    <div
      className="flipclock-root"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) scale(${scale})`,
        zIndex: 4,
        pointerEvents,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="clock" aria-label="flip-clock">
        {blocks}
      </div>
    </div>
  );
}
