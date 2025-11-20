import React, { useState, useRef, useEffect } from "react";
import { welcomeStyles, welcomeClassStyles } from "../components/welcomecomponents/styles/WelcomeStyles";
import { useNavigate } from "react-router-dom";
import FormPanel from "../components/welcomecomponents/FormPanel";
import SwitchPanel from "../components/welcomecomponents/SwitchPanel";
import BackgroundCarousel from "../components/welcomecomponents/BackgroundCarousel";
import PreviewCarousel from "../components/welcomecomponents/PreviewCarousel";

//资源
const backgrounds = [
  { type: "video", src: "/videos/bgvspring01.mp4", poster: "/images/bgv01.png" },
  { type: "video", src: "/videos/bgvspring02.mp4", poster: "/images/bgv02.png" },
  { type: "video", src: "/videos/bgvsummer01.mp4", poster: "/images/bgv03.png" },
  { type: "video", src: "/videos/bgvsummer02.mp4", poster: "/images/bgv04.png" },
  { type: "video", src: "/videos/bgvautumn01.mp4", poster: "/images/bgv05.png" },
  { type: "video", src: "/videos/bgvautumn02.mp4", poster: "/images/bgv06.png" },
  { type: "video", src: "/videos/bgvwinter01.mp4", poster: "/images/bgv07.png" },
  { type: "video", src: "/videos/bgvwinter02.mp4", poster: "/images/bgv08.png" },
];

export default function Welcome() {

  const navigate = useNavigate();

  const usernameRegex = /^[A-Za-z0-9_]{6,15}$/;

  /*
  validateInputs 函数用于校验用户名和密码输入是否合法。它接收两个参数（用户名 u 和密码 p），依次判断：
  用户名或密码是否为空；
  用户名长度是否在 6 到 15 位之间；
  用户名是否只包含字母、数字和下划线（通过正则表达式）；
  如果有任何一项不符合要求，返回 { ok: false, msg: "错误信息" }，否则返回 { ok: true }。
  该函数主要用于登录和注册表单提交前的前端校验。
   */
  const validateInputs = (u, p) => {
    if (!u || !p) return { ok: false, msg: "用户名和密码不能为空" };
    if (u.length < 6 || u.length > 15) return { ok: false, msg: "用户名长度必须为6到15位" };
    if (!usernameRegex.test(u)) return { ok: false, msg: "用户名只能包含字母、数字和下划线" };
    return { ok: true };
  };

  /*
  在组件首次挂载时，预加载（prefetch）front/src/pages/Home.jsx 页面模块，以提升后续跳转到首页的速度。
  它优先使用浏览器的 requestIdleCallback（空闲时执行）；
  如果不支持则用 setTimeout 延迟 1.2 秒执行；
  返回的清理函数会在组件卸载或依赖变化时取消预加载任务，避免资源浪费。
  */
  useEffect(() => {
    const prefetch = () => {
      import("./Home").catch(() => {});
    };

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 2000 });
      return () => window.cancelIdleCallback && window.cancelIdleCallback(id);
    }

    const t = setTimeout(prefetch, 1200);

    return () => clearTimeout(t);
  }, []);

  //自动轮播背景
  const [autoPlay, setAutoPlay] = useState(true);

  //自动轮播定时器引用
  const autoPlayTimer = useRef(null);

  //鼠标开始拖拽的横坐标，null表示未拖拽
  const [dragStartX, setDragStartX] = useState(null);

  //拖拽的横向位移增量，初始为0
  const [dragDelta, setDragDelta] = useState(0);

  //处理拖拽开始事件，记录起始横坐标
  const handleDragStart = (e) => {
    setDragStartX(e.clientY);
    setDragDelta(0);
  };

  //处理拖拽移动事件，计算横向位移增量
  const handleDragMove = (e) => {
    if (dragStartX !== null) {
      setDragDelta(e.clientY - dragStartX);
    }
  };

  //处理拖拽结束事件，根据位移增量触发背景切换
  const handleDragEnd = () => {
    if (dragStartX !== null) {
      const threshold = 40;
      if (dragDelta > threshold) {
        // drag down => next
        triggerBgChange(bgIndex + 1);
      } else if (dragDelta < -threshold) {
        // drag up => previous
        triggerBgChange(bgIndex - 1);
      }
    }
    setDragStartX(null);
    setDragDelta(0);
  };

  //用于根据鼠标在页面上的移动，动态调整背景图片或视频的显示位置，实现背景的视觉跟随效果
  const [bgOffset, setBgOffset] = useState({ x: 0, y: 0 });

  //在页面监听鼠标移动时，避免重复触发动画帧请求，并能在需要时取消动画帧（比如鼠标离开时）。这样可以优化性能，确保每次只处理一次动画帧更新
  const rafIdRef = useRef(null);

  //用于保存鼠标的最新坐标 { x, y }。它在页面监听鼠标移动事件时被更新，主要用于后续计算背景偏移，实现背景视觉跟随效果
  const lastMouseRef = useRef({ x: 0, y: 0 });

  //用于切换背景图片或视频
  const [bgIndex, setBgIndex] = useState(0);

  //用于渐变动画时的目标背景索引（实现淡入淡出效果）
  const [fadeIndex, setFadeIndex] = useState(bgIndex);

  //判断是否正在进行背景渐变动画（控制动画状态）
  const [isFading, setIsFading] = useState(false);

  /*
  用于在鼠标移动时，计算鼠标相对于窗口中心的偏移百分比；
  并通过 setBgOffset 更新背景的偏移量，实现背景视觉跟随鼠标的动态效果；
  它还用 requestAnimationFrame 优化性能，避免高频事件导致的重复渲染
  */
  const handleMouseMove = (e) => {
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const { innerWidth, innerHeight } = window;
      const { x, y } = lastMouseRef.current;
      const percentX = (x - innerWidth / 2) / (innerWidth / 2);
      const percentY = (y - innerHeight / 2) / (innerHeight / 2);
      const maxX = 40, maxY = 20;
      setBgOffset({
        x: Math.max(-maxX, Math.min(maxX, percentX * maxX)),
        y: Math.max(-maxY, Math.min(maxY, percentY * maxY)),
      });
    });
  };

  /*
  用于处理鼠标离开页面时的事件。
  它会取消之前通过 requestAnimationFrame 注册的动画帧请求（如果有），
  并将背景偏移量重置为 { x: 0, y: 0 }，让背景回到初始位置，
  避免鼠标离开后背景仍然处于偏移状态；
  这样可以优化性能并保证视觉效果一致
  */
  const handleMouseLeave = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setBgOffset({ x: 0, y: 0 });
  };


  //当前表单模式，值为 "login" 或 "register"，用于切换登录/注册界面
  const [mode, setMode] = useState("login");

  //制表单样式动画的延迟效果，切换时用于动画过渡
  const [formStyleDelayed, setFormStyleDelayed] = useState(true);

  //控制表单内容的延迟切换，配合动画实现内容渐变
  const [formContentDelayed, setFormContentDelayed] = useState("login");

  //保存输入的用户名
  const [username, setUsername] = useState("");

  //保存输入的密码
  const [password, setPassword] = useState("");

  //用于显示提示信息或错误信息
  const [msg, setMsg] = useState("");

  //表示当前是否处于加载（提交中）状态，防止重复提交
  const [loading, setLoading] = useState(false);

  /*
  handleModeChange 方法用于切换当前表单模式（登录或注册）。它会：
  更新表单模式（mode）为新值；
  清空提示信息（msg）；
  触发表单样式的动画过渡（先设为 false，175 毫秒后再设为 true 并切换表单内容），实现切换时的动画效果。
  */
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setMsg("");
    setFormStyleDelayed(false);
    setTimeout(() => {
      setFormStyleDelayed(true);
      setFormContentDelayed(newMode);
    }, 175);
  };

  /*
  triggerBgChange 方法用于切换背景图片或视频。
  它接收一个目标索引 targetIdx，计算下一个要显示的背景索引 nextIdx；
  如果当前已经是该背景则直接返回，否则，先设置渐变动画状态，500 毫秒后切换背景并结束动画，实现淡入淡出的视觉效果。
  */
  const triggerBgChange = (targetIdx) => {
    if (isFading) return;
    const len = backgrounds.length;
    const nextIdx = ((targetIdx % len) + len) % len;
    if (nextIdx === bgIndex) return;
    setFadeIndex(nextIdx);
    setIsFading(true);
    setTimeout(() => {
      setBgIndex(nextIdx);
      setIsFading(false);
    }, 500);
  };

  /*
  该方法是一个 React 的 useEffect 副作用钩子，用于控制背景自动轮播功能：
  当 autoPlay 为 true 时，启动一个定时器，每隔 3 秒自动切换背景（调用 triggerBgChange(bgIndex + 1)）。
  当 autoPlay 为 false 或组件卸载时，会清除定时器，防止内存泄漏和重复切换。
  依赖项为 autoPlay 和 bgIndex，确保状态变化时能正确重启或清理定时器。
  */
  useEffect(() => {
    if (autoPlay) {
      autoPlayTimer.current = setInterval(() => {
        triggerBgChange(bgIndex + 1);
      }, 3000);
    } else {
      if (autoPlayTimer.current) {
        clearInterval(autoPlayTimer.current);
        autoPlayTimer.current = null;
      }
    }
    return () => {
      if (autoPlayTimer.current) {
        clearInterval(autoPlayTimer.current);
        autoPlayTimer.current = null;
      }
    };
  }, [autoPlay, bgIndex]);


  //用于处理登录表单提交，包含输入校验、请求超时控制、错误处理、成功后获取用户信息并跳转页面等逻辑
  //定义一个异步函数 handleLogin，参数 e 是事件对象（通常是表单提交事件）
  const handleLogin = async (e) => {

    //阻止表单的默认提交行为，避免页面刷新
    e.preventDefault();

    //清空消息提示，通常用于清除上一次的错误或成功信息
    setMsg("");

    //调用 validateInputs 函数校验用户名和密码，返回校验结果对象 v
    const v = validateInputs(username, password);

    if (!v.ok) {//如果校验不通过（v.ok 为 false），设置错误消息并终止后续逻辑
      setMsg(v.msg);
      return;
    }

    //设置加载状态为 true，通常用于显示加载动画或禁用按钮
    setLoading(true);

    //处理异步请求和可能的异常
    try {

      //AbortController 实例，用于后续请求的超时控制
      const controller = new AbortController();

      //8 秒的定时器，到时自动调用 controller.abort() 终止请求
      const timeout = setTimeout(() => controller.abort(), 8000);

      //发起登录请求，使用 POST 方法，发送 JSON 格式的用户名和密码，并绑定 abort 信号
      const res = await fetch(`/api/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      //请求完成后清除定时器，避免误触发 abort
      clearTimeout(timeout);

      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          try {
            const data = await res.json();
            let detail = data.message || data.error || "请求失败";
            if (data.errors && typeof data.errors === "object") {
              const parts = Object.entries(data.errors).map(([k, v]) => `${k}: ${v}`);
              if (parts.length) detail = parts.join("\n");
            }
            if (data.detail && typeof data.detail === "string") {
              detail += `\n${data.detail}`;
            }
            setMsg(detail);
          } catch (_) {
            setMsg(`服务器错误: ${res.status}`);
          }
        } else {
          const text = await res.text();
          setMsg(text || `服务器错误: ${res.status}`);
        }
      } else {
        const text = await res.text();
        setMsg(text);
        if (text.includes("成功")) {
          const profileRes = await fetch(`/api/user/profile?username=${encodeURIComponent(username)}`);
          if (profileRes.ok) {
            const user = await profileRes.json();
            if (user && user.id) {
              localStorage.setItem('userId', user.id);
            }
          }
          setTimeout(() => {
            navigate("/loading?target=mainpage");
          }, 800);
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setMsg("请求超时，请重试");
      } else {
        setMsg("网络错误");
      }
    } finally {
      setLoading(false);
    }
  };

  //用于处理注册表单提交
  const handleRegister = async (e) => {
    e.preventDefault();
    setMsg("");
    const v = validateInputs(username, password);
    if (!v.ok) {
      setMsg(v.msg);
      return;
    }
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`/api/user/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          try {
            const data = await res.json();
            let detail = data.message || data.error || `服务器错误: ${res.status}`;
            if (data.errors && typeof data.errors === "object") {
              const parts = Object.entries(data.errors).map(([k, v]) => `${k}: ${v}`);
              if (parts.length) detail = parts.join("\n");
            }
            if (data.detail && typeof data.detail === "string") {
              detail += `\n${data.detail}`;
            }
            setMsg(detail);
          } catch (_) {
            setMsg(`服务器错误: ${res.status}`);
          }
        } else {
          const text = await res.text();
          setMsg(text || `服务器错误: ${res.status}`);
        }
      } else {
        const text = await res.text();
        setMsg(text);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setMsg("请求超时，请重试");
      } else {
        setMsg("网络错误");
      }
    } finally {
      setLoading(false);
    }
  };

  /*
  用于渲染登录/注册表单区域。
  它根据当前模式（登录或注册）、动画状态和输入内容，动态生成表单面板和切换按钮，
  并将相关样式和交互事件绑定到对应组件，
  实现登录和注册界面的切换、输入、提交等功能。
  */
  const renderForm = () => {
    const btnWidth = 320, formWidth = 480, totalWidth = btnWidth + formWidth, height = 420;
    const isLogin = mode === "login";
    const formBg = formStyleDelayed ? welcomeStyles.formBgActive : welcomeStyles.formBgInactive;
    const formShadow = formStyleDelayed ? welcomeStyles.formShadowActive : welcomeStyles.formShadowInactive;
    const isLoginContent = formContentDelayed === "login";
    return (
      <div className="form-slider-center" style={{ ...welcomeStyles.formSliderCenter, width: totalWidth, height }}>
        <div className="form-panel form-main" style={welcomeStyles.formPanelMain(formBg, formShadow, btnWidth, isLogin)}>
          {isLoginContent
            ? (
              <FormPanel
                type="login"
                username={username}
                password={password}
                loading={loading}
                msg={msg}
                onUsernameChange={e => setUsername(e.target.value)}
                onPasswordChange={e => setPassword(e.target.value)}
                onSubmit={handleLogin}
              />
            )
            : (
              <FormPanel
                type="register"
                username={username}
                password={password}
                loading={loading}
                msg={msg}
                onUsernameChange={e => setUsername(e.target.value)}
                onPasswordChange={e => setPassword(e.target.value)}
                onSubmit={handleRegister}
              />
            )}
        </div>
        <div className="form-panel form-btn" style={welcomeStyles.formPanelBtn(isLogin, formWidth)}>
          {isLogin
            ? <SwitchPanel type="toRegister" onClick={() => handleModeChange('register')} loading={loading} />
            : <SwitchPanel type="toLogin" onClick={() => handleModeChange('login')} loading={loading} />}
        </div>
        <style>{welcomeClassStyles}</style>
      </div>
    );
  };

  return (
    <div
      style={welcomeStyles.root}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <BackgroundCarousel
        backgrounds={backgrounds}
        bgIndex={bgIndex}
        fadeIndex={fadeIndex}
        isFading={isFading}
        offsetX={bgOffset.x}
        offsetY={bgOffset.y}
      />

      <div style={welcomeStyles.autochangeBtnContainer}>
        <button
          className="autochange-btn"
          style={welcomeStyles.autochangeBtn}
          title={autoPlay ? "暂停背景轮切" : "开启背景轮切"}
          onClick={() => setAutoPlay(v => !v)}
        >
          {autoPlay
            ? (
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="7" y="6" width="4" height="16" rx="2" fill="#fff"/>
                <rect x="17" y="6" width="4" height="16" rx="2" fill="#fff"/>
              </svg>
            )
            : (
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 6V22L22 14L8 6Z" fill="#bbb" stroke="#222" strokeWidth="1"/>
              </svg>
            )}
        </button>
        <div style={welcomeStyles.autochangeBtnGap}></div>
        <span style={welcomeStyles.autochangeText}>
          AUTOCHANGE
        </span>
      </div>

      <div
        style={welcomeStyles.previewContainerTopLeft}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={e => handleDragStart(e.touches[0])}
        onTouchMove={e => handleDragMove(e.touches[0])}
        onTouchEnd={handleDragEnd}
      >
        <PreviewCarousel
          backgrounds={backgrounds}
          bgIndex={bgIndex}
          fadeIndex={fadeIndex}
          isFading={isFading}
          dragDelta={dragDelta}
          orientation="vertical"
        />
      </div>

      {renderForm()}
    </div>
  );
}
