// 音乐播放器样式分离
const musicplayerStyle = {
  // 背景媒体通用样式（视频/图片/GIF）
  bgMedia: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
    objectFit: 'cover',
    objectPosition: 'center',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    transition: 'filter 1.5s cubic-bezier(.18,1.2,.22,1), background 1.5s, transform 1.5s cubic-bezier(.18,1.2,.22,1)'
  },
  marqueeWrapper: {
    width: '100%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    position: 'relative',
    height: '2.5rem',
  },
  marqueeText: {
    display: 'inline-block',
    paddingLeft: '100%',
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#fff',
    textShadow: '2px 2px 8px #00000055',
    animation: 'marquee 10s linear infinite',
  },
  progressBarArea: {
    width: '100%',
    maxWidth: '420px',
    margin: '0 auto 12px auto',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '32px',
    boxSizing: 'border-box'
  },
  volumeArea: {
    width: '100%',
    margin: '0 0 16px 0',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '32px'
  },
  playlistAreaPopup: {
    position: 'absolute',
    left: '50%',
    bottom: '16px',
    transform: 'translateX(-50%)',
    width: '96%',
    maxWidth: '420px',
    minHeight: '160px',
    maxHeight: '80vh',
    background: 'rgba(255,255,255,0.10)',
    borderRadius: '16px',
    boxShadow: '0 2px 16px #0002',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 10,
    padding: '18px 0 24px 0',
    overflowY: 'auto',
    transition: 'max-height 0.4s cubic-bezier(.4,0,.2,1), opacity 0.3s'
  },
  container: {
    width: "100%",
    maxWidth: "480px",
    minHeight: "320px",
    borderRadius: "24px",
    boxShadow: "0 4px 32px #0002",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    margin: "0 auto",
    position: "relative",
    overflow: "hidden"
  },
  topArea: {
    width: '100%',
    height: '14.3%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'none'
  },
  bottomArea: {
    flex: 1,
    position: 'relative',
    width: '100%',
    minHeight: 0
  },
  musicListIcon: {
    width: 22,
    height: 22
  },
  musicListTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '1.1rem'
  },
  noMusicTip: {
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 32
  },
  musicIcon: {
    width: 18,
    height: 18,
    marginRight: 6
  },
  infoArea: {
    width: "100%",
    textAlign: "center",
    marginBottom: "16px"
  },
  musicName: {
    fontSize: "1.5rem",
    fontWeight: "bold",
    color: "#fff",
    textShadow: "0 2px 8px #0008"
  },
  duration: {
    fontSize: "1rem",
    color: "#eee",
    marginTop: "4px"
  },
  controlsArea: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    marginBottom: "16px"
  },
  controlBtn: {
    width: "44px",
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.18)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 8px #0003",
    transition: "background 0.2s, box-shadow 0.2s",
    outline: "none",
    margin: "0 2px"
  },
  sliderArea: {
    width: "100%",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "16px"
  },
  progressSlider: {
    width: '100%',
    maxWidth: '400px',
    accentColor: "#ff9800",
    height: "4px",
    borderRadius: "2px"
  },
  volumeSlider: {
    width: "80px",
    accentColor: "#fff",
    height: "4px",
    borderRadius: "2px"
  },
  playlistArea: {
    width: "100%",
    position: "absolute",
    left: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "rgba(0,0,0,0.08)",
    borderRadius: "12px 12px 0 0",
    boxShadow: "0 -2px 16px #0002",
    overflow: "hidden",
    transition: "max-height 0.35s cubic-bezier(.4,0,.2,1), background 0.2s"
  },
  playlistAreaOpen: {
    maxHeight: "320px",
    padding: "12px 0 8px 0",
    gap: "8px"
  },
  playlistAreaClosed: {
    maxHeight: "48px",
    padding: "8px 0 0 0",
    gap: 0
  },
  playlistHeader: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    justifyContent: "center",
    cursor: "pointer",
    padding: "0 0 0 0"
  },
  playlistContent: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    marginTop: "8px"
  },
  playlistItem: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.10)",
    color: "#fff",
    cursor: "pointer",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "1rem",
    transition: "background 0.2s, color 0.2s"
  },
  playlistItemActive: {
    background: "rgba(255,255,255,0.25)",
    color: "#ff9800",
    fontWeight: "bold",
    boxShadow: "0 2px 8px #ff980033"
  }
};

export default musicplayerStyle;
