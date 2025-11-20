const downButtonStyle = {
  // 透明背景 + 轻微毛玻璃
  background: "transparent",
  color: "#fff",
  border: "none",
  borderRadius: "50%",
  width: "48px",
  height: "48px",
  // 中性阴影，去除橙色
  boxShadow: "0 2px 12px rgba(0, 0, 0, 0.15)",
  backdropFilter: "blur(1px)",
  WebkitBackdropFilter: "blur(1px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "background 0.2s, box-shadow 0.2s",
  outline: "none",
  fontSize: "2rem",
  position: "absolute",
  left: "50%",
  bottom: "16px",
  transform: "translateX(-50%)",
  zIndex: 5
};

export default downButtonStyle;
