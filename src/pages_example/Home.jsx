import React, { useRef, useState, useEffect, Suspense, lazy } from "react";
import homestyle from "../components/homecomponents/styles/homestyle";
import DownButton from "../components/homecomponents/DownButton";
import ProfilePanel from "../components/homecomponents/profilepanel";
import GhostBackground from "../components/homecomponents/GhostBackground";
// import TopNavbar from "../components/homecomponents/TopNavbar";
const WaifuWidget = lazy(() => import("../components/homecomponents/WaifuWidget"));
import WaifuButton from "../components/homecomponents/WaifuButton";

/**
 * Home 页面
 * 职责：展示用户欢迎区（背景/可视化/时钟/Live2D）与侧边资料面板/留言板；与 ProfilePanel 事件联动。
 * 交互：/api/user/profile/{id}、MessagePanel 的 /api/message/**、音乐/背景列表在 MusicPlayer 内部处理。
 */

export default function Home() {
  const articleRef = useRef(null);
  const welcomeRef = useRef(null);

  // 滚动到文章区域
  const scrollToArticle = () => {
    if (articleRef.current) {
      articleRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const userId = localStorage.getItem("userId");

  // 欢迎区域背景，跟随用户在 Profile Panel 第一模块设置的背景
  const [userBgUrl, setUserBgUrl] = useState(null);
  const [bgType, setBgType] = useState("none"); // none | image | gif | video

  useEffect(() => {
    let alive = true;
    async function fetchUserBg() {
      try {
        if (!userId) {
          if (alive) {
            setUserBgUrl(null);
            setBgType("none");
          }
          return;
        }
        const res = await fetch(`/api/user/profile/${userId}`);
        if (!res.ok) {
          if (alive) {
            setUserBgUrl(null);
            setBgType("none");
          }
          return;
        }
        const data = await res.json();
        const bg = data?.backgroundUrl || null;
        if (!alive) return;
        if (bg) {
          const lower = bg.toLowerCase();
          const isVideo = [".mp4", ".webm", ".ogg"].some(ext => lower.endsWith(ext));
          const isGif = lower.endsWith(".gif");
          setUserBgUrl(bg);
          setBgType(isVideo ? "video" : isGif ? "gif" : "image");
        } else {
          setUserBgUrl(null);
          setBgType("none");
        }
      } catch (e) {
        if (alive) {
          setUserBgUrl(null);
          setBgType("none");
        }
      }
    }
    fetchUserBg();
    return () => { alive = false; };
  }, [userId]);

  // 监听 ProfilePanel 发出的用户资料更新事件，立即同步欢迎区背景
  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail || {};
      if (!detail || (detail.userId && String(detail.userId) !== String(userId))) return;
      const bg = detail.backgroundUrl || null;
      if (bg) {
        const lower = bg.toLowerCase();
        const isVideo = [".mp4", ".webm", ".ogg"].some(ext => lower.endsWith(ext));
        const isGif = lower.endsWith(".gif");
        setUserBgUrl(bg);
        setBgType(isVideo ? "video" : isGif ? "gif" : "image");
      } else {
        setUserBgUrl(null);
        setBgType("none");
      }
    };
    window.addEventListener("user-profile-updated", handler);
    return () => window.removeEventListener("user-profile-updated", handler);
  }, [userId]);

  // 欢迎区域不使用占位渐变：无用户背景时保持透明，让全页灰白渐变透出

  // 组装欢迎区域样式：图片/GIF 用背景图，视频通过叠加的 <video> 覆盖
  const welcomeAreaStyle = {
    ...homestyle.welcomeArea,
    background: bgType === "image" || bgType === "gif"
      ? `url(${userBgUrl}) center center/cover no-repeat`
      : "transparent",
    position: "relative"
  };

  const [showWaifu, setShowWaifu] = useState(false);
  const [waifuBtnState, setWaifuBtnState] = useState("default"); // default | hover | active | close

  return (
    <div className="app-page-bg" style={{
      ...homestyle.mainContainer,
      background: "linear-gradient(to bottom, #000, #fff)"
    }}>
      <div ref={welcomeRef} className="w-full h-screen" style={{ ...welcomeAreaStyle, position: "relative" }}>
        {/* 背景视频层（如为视频） */}
        {bgType === "video" && userBgUrl && (
          <video
            src={userBgUrl}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
              pointerEvents: "none"
            }}
          />
        )}
        {/* 中央音频可视化层（不遮挡交互） */}
        <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
          <Suspense fallback={null}>
            {/* <AudioVisualizer containerRef={welcomeRef} /> */}
            {/* <FlipClock scale={0.85} showSeconds={true} /> */}
          </Suspense>
        </div>
        {/* 玻璃化容器已移除：直接在欢迎区域内布置左侧抽屉与右侧侧栏 */}
        {/* 左侧ProfilePanel */}
        <div style={{ ...homestyle.profilePanelDrawer, zIndex: 2 }}>
          <div style={homestyle.profilePanelDrawerInner}>
            <ProfilePanel userId={userId} panelWidth="100%" panelHeight="100%" />
          </div>
        </div>
        {/* 右侧欢迎内容：顶部预留 + 下方留言板 */}
        <div style={{ ...homestyle.rightSidebar, zIndex: 2 }}>
          <div style={homestyle.rightSidebarTop}>{/* 右侧���部 1/4 预留区 */}</div>
          <div style={homestyle.rightSidebarBottom}>
            {/* <MessagePanel targetUserId={userId ? Number(userId) : undefined} style={{ height: "100%", width: "100%" }} /> */}
          </div>
        </div>
        {/* Live2D 看板娘（底部左侧，库自带 CSS 控制位置） */}
        <Suspense fallback={null}>
          {showWaifu && (
            <WaifuWidget
              enableDrag={true}
              logLevel="error"
              cdnPath="/live2d-models/"
              waifuPath="/live2d-widget-master/dist/waifu-tips.json"
              cubism5Path="/live2d-widget-master/dist/cubism5/live2dcubismcore.min.js"
              tools={["switch-model", "switch-texture", "photo"]}
            />
          )}
        </Suspense>
        {/* 看板娘召唤/收起按钮，分离为独立组件 */}
        <WaifuButton
          showWaifu={showWaifu}
          onToggle={() => {
            if (showWaifu) {
              setShowWaifu(false);
              setWaifuBtnState("default");
            } else {
              setShowWaifu(true);
              setWaifuBtnState("active");
            }
          }}
          btnState={waifuBtnState}
          setBtnState={setWaifuBtnState}
        />
        {/* 固定在整个欢迎区底部居中 */}
        <DownButton onClick={scrollToArticle} />
      </div>
      <div
        ref={articleRef}
        className="w-full flex flex-col items-center justify-start"
        style={{
          ...homestyle.articleArea,
          background: "transparent",
          backgroundColor: "transparent"
        }}
      >
        {/* 文章区域的可交互幽灵背景 */}
        <GhostBackground style={{ zIndex: 0 }} />
        {/* 在这里按需添加文章内容，内容层级默认在幽灵之上 */}
      </div>
    </div>
  );
}
