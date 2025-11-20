// src/components/homecomponents/styles/homestyle.js

const homestyle = {
  mainContainer: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    // 背景改由全局样式类（.app-page-bg）控制，这里不再设置背景色
  },
  welcomeArea: {
    width: "100%",
    height: "100vh",
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    position: "relative",
    // 保持透明，背景由父级页面整体背景或用户自定义媒体决定
  },
  profilePanelDrawer: {
    position: "absolute",
    left: "0",
    top: "0",
    bottom: "0",
    width: "clamp(320px, 33.33%, 480px)",
    minWidth: "320px",
    maxWidth: "480px",
    height: "100%",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "stretch",
    zIndex: 10,
    transition: "width 0.3s",
    padding: "0",
    borderRadius: "0",
    boxShadow: "none",
    background: "none"
  },
  profilePanelDrawerInner: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "stretch",
    padding: "0",
    borderRadius: "0"
  },
  // 右侧内容：直接绝对定位在欢迎区内
  // 右侧边栏：绝对定位在欢迎区右侧，占据整体宽度的 1/4
  rightSidebar: {
    position: "absolute",
    right: 0,
    top: 0,
    width: "33.333%", // 调整为欢迎区域的 1/3 宽度
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    // 让底部留言板区域贴近底部，顶部区域在上方，占据剩余空间
    justifyContent: "space-between",
    gap: "0",
    zIndex: 2,
    pointerEvents: "none" // 容器不拦截，内部面板可交互
  },
  rightSidebarTop: {
    width: "100%",
    height: "25%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 16px 0 16px",
    boxSizing: "border-box",
    pointerEvents: "none"
  },
  rightSidebarBottom: {
    width: "100%",
    // 将右下部分留言板区域高度调整为页面高度的一半
    height: "50%",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    padding: "0 16px 24px 16px",
    boxSizing: "border-box",
    pointerEvents: "auto" // 允许留言板交互
  },
  articleArea: {
    width: "100%",
    // 当没有任何内容时，与欢迎区一样高，确保跳转后能占满整屏
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    // 文章区域需要透明背景，以便云层在其上方显示
    background: "transparent",
    // 明确建立层叠上下文并降低层级（云层会设置更高的 z-index）
    position: "relative",
    zIndex: 1,
    overflow: "hidden",
    // 为云层底部渐变提供变量；此处与背景保持一致（透明）
    "--article-bg": "transparent"
  }
};

export default homestyle;