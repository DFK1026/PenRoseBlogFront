// profilepanel 样式全部分离，使用类名
// 绝大多数样式已在 profilepanel.css 中实现，仅保留必要的动态样式对象

export default {
  // 背景资源居中裁剪样式（图片、gif、视频）
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
    transition: 'filter 1.5s cubic-bezier(.18,1.2,.22,1), background 1.5s, min-height 0.9s cubic-bezier(.18,1.2,.22,1), transform 1.5s cubic-bezier(.18,1.2,.22,1)'
  },
  // 灰色占位样式（如标签为空时使用）
  grayPlaceholder: {
    background: '#eee',
    color: '#bbb',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 14,
    textAlign: 'center',
    minWidth: 48,
    minHeight: 24,
    display: 'inline-block',
  }
};
