import React, { useEffect, useRef, useState } from "react";

// 全局事件名：播放器准备好后会派发，detail: { audio: HTMLAudioElement }
const AUDIO_EVENT = "app:audio-element";
const RESUME_EVENT = "app:resume-audio-context";

// 防止为同一个 audio 重复创建 MediaElementSourceNode：使用弱映射缓存
const sourceNodeCache = new WeakMap();

// 单例 AudioContext/Analyser，避免跨上下文连接导致的 InvalidAccessError
let sharedCtx = null;
let sharedAnalyser = null;
let sharedAnalyserConnected = false; // 确保分析器只连接到 destination 一次

export default function AudioVisualizer({ containerRef }) {
  const canvasRef = useRef(null);
  const [diameter, setDiameter] = useState(200);
  const [enabled, setEnabled] = useState(false); // 是否已启用（由播放器播放触发）
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const freqArrayRef = useRef(null);
  const rafRef = useRef(null);
  const drawStarterRef = useRef(null); // 保存启动绘制循环的方法
  // 旋转控制：仅在播放时累加角度
  const isPlayingRef = useRef(false);
  const rotateAngleRef = useRef(0);
  const lastTsRef = useRef(0);

  // 粒子系统
  const particlesRef = useRef([]);

  // 计算直径：放大可视化外侧方形区域，减少裁切风险
  useEffect(() => {
    const compute = () => {
      const h = containerRef?.current?.offsetHeight || window.innerHeight || 600;
      // 从 h/3 调整到 h/2.6，并提高最小尺寸
      setDiameter(Math.max(160, Math.floor(h / 2.6)));
      // 同步画布尺寸
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const size = Math.max(160, Math.floor(h / 2.6));
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [containerRef]);

  // 初始化（或复用） AudioContext 和 Analyser（不主动创建，等待播放器触发）
  useEffect(() => {
    // 若已存在且在运行，则视为已启用
    if (sharedCtx && sharedCtx.state === "running") setEnabled(true);
    if (sharedAnalyser) {
      analyserRef.current = sharedAnalyser;
      freqArrayRef.current = new Uint8Array(sharedAnalyser.frequencyBinCount);
    }

    // 提供一个统一的恢复方法，供 RESUME_EVENT 或 onAudio 调用
    const ensureAudioChain = async () => {
      if (!sharedCtx) {
        sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (!sharedAnalyser) {
        sharedAnalyser = sharedCtx.createAnalyser();
        sharedAnalyser.fftSize = 1024;
        sharedAnalyser.smoothingTimeConstant = 0.85;
      }
      analyserRef.current = sharedAnalyser;
      freqArrayRef.current = new Uint8Array(sharedAnalyser.frequencyBinCount);
      // 将分析器接到扬声器，保证声音实际输出（创建 MediaElementSource 后，
      // 音频需通过音频图连接到 destination 才会发声）
      if (sharedCtx && sharedAnalyser && !sharedAnalyserConnected) {
        try {
          sharedAnalyser.connect(sharedCtx.destination);
          sharedAnalyserConnected = true;
        } catch {}
      }
      // 不在此处 resume，等待真正的播放手势或 RESUME_EVENT
      setEnabled(sharedCtx.state === "running");
    };

    // 由音乐播放器的播放按钮派发的事件触发：确保链路并尝试 resume
    const onResumeEvent = async () => {
      await ensureAudioChain();
      if (sharedCtx && sharedCtx.state === "suspended") {
        try { await sharedCtx.resume(); } catch {}
      }
      setEnabled(sharedCtx?.state === "running");
    };

    // 监听播放器事件，绑定音频源
    const onAudio = (e) => {
      const audio = e?.detail?.audio;
      if (!audio) return;
      // 懒创建并恢复
      ensureAudioChain().then(() => {
        if (!sharedCtx || !analyserRef.current) return;
      try {
        // 避免重复创建 source node
        let srcNode = sourceNodeCache.get(audio);
        if (!srcNode) {
          srcNode = sharedCtx.createMediaElementSource(audio);
          sourceNodeCache.set(audio, srcNode);
        }
  // 断开旧的引用再连接当前分析器；并确保有一路接到扬声器
    try { if (sourceRef.current) sourceRef.current.disconnect(); } catch {}
    try { srcNode.disconnect(); } catch {}
    // 连接：音频 -> 分析器 -> destination（分析器已在 ensureAudioChain 中接到 destination）
    srcNode.connect(analyserRef.current);
        sourceRef.current = srcNode;
  // 仅在实际为播放状态时尝试恢复
  if (!audio.paused && sharedCtx.state === "suspended") sharedCtx.resume();
  setEnabled(sharedCtx.state === "running");

        // 同步播放状态，用于控制旋转
        isPlayingRef.current = !audio.paused && !audio.ended;
        const onPlay = () => { isPlayingRef.current = true; };
        const onPause = () => { isPlayingRef.current = false; };
        const onEnded = () => { isPlayingRef.current = false; };
        // 先移除旧监听再绑定新监听
        try {
          audio.removeEventListener('play', onPlay);
          audio.removeEventListener('pause', onPause);
          audio.removeEventListener('ended', onEnded);
        } catch {}
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("AudioVisualizer attach error", err);
      }
      });
    };
    window.addEventListener(AUDIO_EVENT, onAudio);
    window.addEventListener(RESUME_EVENT, onResumeEvent);

    // 清理
    return () => {
      window.removeEventListener(AUDIO_EVENT, onAudio);
      window.removeEventListener(RESUME_EVENT, onResumeEvent);
      try { if (sourceRef.current) sourceRef.current.disconnect(); } catch {}
      // 不关闭 sharedCtx，保持单例贯穿全局
    };
  }, []);

  // 初始化粒子
  useEffect(() => {
    const initParticles = () => {
      const count = 140; // 粒子数量（增强存在感）
      const arr = new Array(count).fill(0).map(() => ({
        angle: Math.random() * Math.PI * 2,
        radiusOffset: (Math.random() - 0.5) * 10, // 半径微偏
        speed: 0.008 + Math.random() * 0.014,      // 更快一点
        size: 1.2 + Math.random() * 1.8,           // 更大一点
        life: 0.5 + Math.random() * 1.5
      }));
      particlesRef.current = arr;
    };
    initParticles();
  }, []);

  // 绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    let t = 0;

    const draw = (ts = 0) => {
      // 若页面隐藏则暂停绘制循环，待可见时再恢复
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(draw);
      if (!ctx2d) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  // 安全半径：扩大可用空间，减少裁切
  const safeRadius = Math.min(w, h) / 2 - 2 * dpr;
  const r = safeRadius - 10 * dpr; // 主环向内缩小更少，给柱体更多空间

  // 背景微弱径向渐变，营造层次
      const bgGrad = ctx2d.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      bgGrad.addColorStop(0, "rgba(255,255,255,0.06)");
      bgGrad.addColorStop(1, "rgba(0,0,0,0.15)");
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, r + 6 * dpr, 0, Math.PI * 2);
      ctx2d.fillStyle = bgGrad;
      ctx2d.fill();

      // 获取频谱数据（每帧从 ref 读取，适配懒初始化/切歌）
      const analyser = analyserRef.current;
      const freqArray = freqArrayRef.current;
      let energy = 0;
      if (analyser && freqArray) {
        analyser.getByteFrequencyData(freqArray);
        energy = freqArray.reduce((a, b) => a + b, 0) / (freqArray.length * 255);
      }

      // 外圈基线（黑白灰动态渐变 + 阴影）
      const ringGrad = ctx2d.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.8);
      ringGrad.addColorStop(0, `rgba(${200 - 80 * pulse}, ${200 - 80 * pulse}, ${200 - 80 * pulse}, 0.9)`);
      ringGrad.addColorStop(0.5, `rgba(255,255,255,${0.9 - 0.3 * pulse})`);
      ringGrad.addColorStop(1, `rgba(${120 - 40 * pulse}, ${120 - 40 * pulse}, ${120 - 40 * pulse}, 0.9)`);
      ctx2d.save();
      ctx2d.shadowColor = "rgba(0,0,0,0.35)";
      ctx2d.shadowBlur = 18 * dpr;
      ctx2d.lineWidth = 2 * dpr;
      ctx2d.strokeStyle = ringGrad;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, r, 0, Math.PI * 2);
      ctx2d.stroke();
      ctx2d.restore();

      // 旋转：仅播放中才累加角度（顺时针）
      const dt = lastTsRef.current ? Math.min(100, ts - lastTsRef.current) : 16;
      lastTsRef.current = ts;
      if (isPlayingRef.current) {
        // 0.12弧度/秒，随能量略增
        rotateAngleRef.current += (0.12 + energy * 0.25) * (dt / 1000);
      }

      // 柱状频谱沿圆周（降低最大振幅；顶部白、向下灰-黑；加入平滑避免“方形感”）
      const bars = 120;
      const step = (Math.PI * 2) / bars;
      ctx2d.save();
      ctx2d.translate(cx, cy);
      ctx2d.rotate(rotateAngleRef.current);
      ctx2d.translate(-cx, -cy);
      for (let i = 0; i < bars; i++) {
        const ang = i * step - Math.PI / 2; // 12点方向起
        // 将 120 根条映射到频谱数组长度，并取邻域窗口做平滑，避免四角/方形感
        let magnitude = 0.05;
        if (analyser && freqArray) {
          const idx = Math.floor(i / bars * freqArray.length);
          let sum = 0, count = 0;
          for (let k = -1; k <= 1; k++) { // 收窄平滑窗口，增强振幅可见度
            const j = idx + k;
            if (j >= 0 && j < freqArray.length) { sum += freqArray[j]; count++; }
          }
          magnitude = (sum / Math.max(1, count)) / 255;
        }
  // 提高振幅可见度：降低指数并增大系数
  const magBoost = Math.pow(magnitude, 1.0);
  let len = (18 + 120 * magBoost) * dpr; // 更高的基准与增益
  // 能量对整体增益更明显
  len *= (1 + energy * 0.55);

        // 三等分角度增强：在 0, 120°, 240° 附近振幅更大，其余位置略小
        const TWO_PI = Math.PI * 2;
        const anchors = [0, TWO_PI / 3 * 2, TWO_PI / 3 * 4 - TWO_PI]; // 0, 120°, 240° 等价（保持在 [-PI, PI)）
        const normAng = ((ang + Math.PI) % TWO_PI) - Math.PI; // 归一化到 [-PI, PI)
        const wrapDelta = (a, b) => {
          const d = Math.abs(a - b);
          return Math.min(d, TWO_PI - d);
        };
  const sigma = 0.26;           // 峰值宽度（弧度），更集中
  const baseScale = 0.88;       // 其他区域略小
  const peakExtra = 0.55;       // 峰值额外增益更明显
        let peak = 0;
        for (let k = 0; k < anchors.length; k++) {
          const d = wrapDelta(normAng, anchors[k]);
          const v = Math.exp(-0.5 * (d / sigma) * (d / sigma));
          if (v > peak) peak = v;
        }
        const angularScale = baseScale + peakExtra * peak; // [baseScale, baseScale+peakExtra]
        len *= angularScale;
  // 严格上限，杜绝顶到外缘导致的视觉“方形”
  const MAX_LEN = 120 * dpr;
  if (len > MAX_LEN) len = MAX_LEN;
  const inner = r - 6 * dpr;
  // 依据安全半径做硬性限制，保证顶端不越出画布
  const maxLenByRadius = Math.max(0, safeRadius - inner - 3 * dpr);
  if (len > maxLenByRadius) len = maxLenByRadius;
  const outer = inner + len;
        const x1 = cx + inner * Math.cos(ang);
        const y1 = cy + inner * Math.sin(ang);
        const x2 = cx + outer * Math.cos(ang);
        const y2 = cy + outer * Math.sin(ang);
        // 渐变：内端(靠近中心)更暗 -> 外端(顶部)最亮
        const lg = ctx2d.createLinearGradient(x1, y1, x2, y2);
        lg.addColorStop(0, "rgba(0,0,0,0.92)");      // 底端黑
        lg.addColorStop(0.5, "rgba(160,160,160,0.95)"); // 中段灰
        lg.addColorStop(1, "rgba(255,255,255,1.0)");    // 顶端白
        ctx2d.strokeStyle = lg;
        ctx2d.lineWidth = 3 * dpr;
        ctx2d.beginPath();
        ctx2d.moveTo(x1, y1);
        ctx2d.lineTo(x2, y2);
        ctx2d.stroke();

        // 顶端高光：增强层次与动态感
        ctx2d.save();
        ctx2d.shadowColor = "rgba(255,255,255,0.65)";
        ctx2d.shadowBlur = 8 * dpr * (0.3 + magBoost);
        ctx2d.beginPath();
        ctx2d.arc(x2, y2, (1.8 + 2.2 * magBoost) * dpr, 0, Math.PI * 2);
        ctx2d.fillStyle = "rgba(255,255,255,0.9)";
        ctx2d.fill();
        ctx2d.restore();
      }
      ctx2d.restore();

      // 粒子围绕圆环：速度随能量略增
      const particles = particlesRef.current || [];
      const speedScale = 0.6 + energy * 2.0; // 粒子速度也更随能量波动
      ctx2d.save();
      for (let p of particles) {
        p.angle += p.speed * speedScale;
        if (p.angle > Math.PI * 2) p.angle -= Math.PI * 2;
        // 随能量产生轻微外向抖动与更强的可见度
        const radialJitter = energy * 6 * Math.sin(t * 1.2 + p.angle * 3);
        const pr = r + p.radiusOffset + (Math.sin(t * 0.6 + p.angle * 2) * 3) + radialJitter;
        const px = cx + pr * Math.cos(p.angle);
        const py = cy + pr * Math.sin(p.angle);
        let alpha = 0.35 + 0.45 * Math.abs(Math.sin(p.angle + t));
        alpha = Math.min(1, alpha * (0.7 + energy * 0.9));
        const size = (p.size * (1 + energy * 0.8)) * dpr;
        ctx2d.save();
        ctx2d.shadowColor = `rgba(255,255,255,${0.35 + 0.45 * Math.min(1, energy * 1.2)})`;
        ctx2d.shadowBlur = 10 * dpr * (0.4 + energy * 1.6);
        ctx2d.beginPath();
        ctx2d.fillStyle = `rgba(240,240,240,${alpha})`;
        ctx2d.arc(px, py, size, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.restore();
      }
      ctx2d.restore();

      t += 0.016;
    };

    // 启动与恢复绘制循环的方法
    const start = () => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };
    drawStarterRef.current = start;
    start();

    const onVisibility = () => {
      if (!document.hidden) {
        // 页面可见时恢复绘制
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [diameter]);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: diameter,
        height: diameter,
        pointerEvents: "none", // 不阻挡页面交互
        filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.35))"
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
