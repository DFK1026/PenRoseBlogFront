// 导航栏样式对象
const mainPageNavStyles = {
  nav: {
    width: "100%",
    height: "60px",
    background: "rgba(30, 30, 30, 0.7)",
    backdropFilter: "blur(8px)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 32px",
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 1000,
  },
  left: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    height: "100%",
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: 600,
    userSelect: "none",
    letterSpacing: 1,
  },
  iconWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    height: "100%",
  },
  right: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  homeIcon: {
    background: "none",
    border: "none",
    outline: "none",
    cursor: "pointer",
    padding: 0,
    height: 40,
    display: "flex",
    alignItems: "center",
    transition: "opacity 0.2s",
  },
  homeIconActive: {
    cursor: "default",
    opacity: 1,
    filter: "none",
  },
  homeIconInactive: {
    opacity: 0.85,
    filter: "grayscale(40%)",
  },
  iconImg: {
    width: 32,
    height: 32,
  },
};

export default mainPageNavStyles;
