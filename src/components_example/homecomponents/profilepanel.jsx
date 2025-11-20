import React, { useState, useEffect, useRef } from "react";
import './styles/profilepanel/profilepanel.css';
import profilepanelStyle from './styles/profilepanel/profilepanelstyle';
import ProfileEdit from "./profileedit";
import MusicPlayer from "./musicplayer";

// 获取本地存储的用户id
function getLocalUserId() {
  try {
    return localStorage.getItem("userId");
  } catch {
    return null;
  }
}

// 占位灰色组件
const GrayPlaceholder = ({ text }) => (
  <div className="profilepanel-empty-panel">{text}</div>
);

export default function ProfilePanel({ username, panelWidth = "100%", panelHeight = "100%", expanded = false, onCollapse, userId: propUserId }) {
  // 编辑区消息内容
  const [editMsg, setEditMsg] = useState("");
  // 消息定时器
  const editMsgTimer = useRef(null);
  useEffect(() => {
    if (editMsg) {
      if (editMsgTimer.current) clearTimeout(editMsgTimer.current);
      editMsgTimer.current = setTimeout(() => { 
        setEditMsg("");
      }, 2000);
    }
    return () => {
      if (editMsgTimer.current) clearTimeout(editMsgTimer.current);
    };
  }, [editMsg]);
  // 编辑区表单内容
  const [editForm, setEditForm] = useState({});
  // 编辑区上传状态
  const [editUploading, setEditUploading] = useState(false);

  // 新增：音乐列表刷新计数（每次上传音乐或背景后自增，驱动播放器刷新）
  const [musicRefreshKey, setMusicRefreshKey] = useState(0);

  // 第三模块：集成音乐播放器
  // 第三模块：直接渲染音乐播放器，无需额外面板
  const renderMusicPlayer = () => (
    <MusicPlayer userId={userId} refreshKey={musicRefreshKey} />
  );
  // 标签相关
  const [userTags, setUserTags] = useState([]); // 展示用
  const [editTags, setEditTags] = useState([]); // 编辑用
  const [tagMsg, setTagMsg] = useState("");
  // 标签消息定时器
  const tagMsgTimer = useRef(null);
  useEffect(() => {
    if (tagMsg) {
      if (tagMsgTimer.current) clearTimeout(tagMsgTimer.current);
      tagMsgTimer.current = setTimeout(() => {
        setTagMsg("");
      }, 2000);
    }
    return () => {
      if (tagMsgTimer.current) clearTimeout(tagMsgTimer.current);
    };
  }, [tagMsg]);
  // 优先使用props传递的userId
  const [userId, setUserId] = useState(propUserId || null);
  // 图标悬停状态（新增QQ/微信二维码悬浮）
  const [qqIconHover, setQqIconHover] = useState(false);
  const [wechatIconHover, setWechatIconHover] = useState(false);

  // 获取标签（依赖 userId）
  useEffect(() => {
    if (!userId) {
      setUserTags([]);
      return;
    }
    fetch(`/api/user/tags/${userId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUserTags(data.map(t => t.tag));
        } else {
          setUserTags([]);
        }
      })
      .catch(() => setUserTags([]));
  }, [userId]);

  // 编辑区初始化标签
  useEffect(() => {
    setEditTags(userTags);
  }, [userTags]);

  // 编辑标签输入
  const handleTagChange = (idx, value) => {
    if (value.length > 15) return;
    setEditTags(tags => tags.map((t, i) => i === idx ? value : t));
  };
  // 新增标签
  const handleAddTag = () => {
    if (editTags.length >= 9) {
      setTagMsg("最多设置9个标签");
      return;
    }
    setEditTags(tags => [...tags, ""]);
  };
  // 删除标签
  const handleDeleteTag = idx => {
    setEditTags(tags => tags.filter((_, i) => i !== idx));
  };
  // 保存标签
  const handleSaveTags = async () => {
    setTagMsg("");
    if (!userId) {
      setTagMsg("未登录，无法保存标签");
      return;
    }
    const tags = editTags.map(t => t.trim()).filter(t => t.length > 0);
    if (tags.length > 9) {
      setTagMsg("最多设置9个标签");
      return;
    }
    if (tags.some(t => t.length > 15)) {
      setTagMsg("每个标签最多15个字符");
      return;
    }
    try {
      const res = await fetch(`/api/user/tags/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tags)
      });
      const msg = await res.text();
      setTagMsg(msg);
      // 刷新标签
      fetch(`/api/user/tags/${userId}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setUserTags(data.map(t => t.tag));
          } else {
            setUserTags([]);
          }
        });
    } catch {
      setTagMsg("标签保存失败");
    }
  };
  // 鼠标悬停展开，默认收起；当传入 expanded 为 true 时直接展开对应面板并显示内容
  const [hoverIdx, setHoverIdx] = useState(expanded ? 0 : 0);
  // 动态高度计算
  const containerRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(0);
  useEffect(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.offsetHeight);
    }
  }, [panelHeight]);
  // 动态弹性动画参数
  // 四模块展开比例 7:1:1:1
  const getPanelHeight = idx => {
    if (!containerHeight) return 100;
    if (hoverIdx === idx) {
      return containerHeight * 0.7;
    } else {
      return containerHeight * 0.1;
    }
  };
  // 用户信息
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // 编辑区 tab 状态
  const [editTabActiveIdx, setEditTabActiveIdx] = useState(0);

  // 获取用户id和信息
  useEffect(() => {
    // 如果props传递了userId，则直接用props的
    if (propUserId) {
      setUserId(propUserId);
    } else {
      let id = getLocalUserId();
      setUserId(id);
    }
  }, [propUserId]);

  useEffect(() => {
    setLoading(true);
    if (userId) {
      fetch(`/api/user/profile/${userId}`)
        .then(res => res.json())
        .then(data => {
          setUser(data);
          setLoading(false);
        })
        .catch(() => {
          setUser(null);
          setLoading(false);
        });
    } else if (username) {
      fetch(`/api/user/profile?username=${username}`)
        .then(res => res.json())
        .then(data => {
          setUser(data);
          setLoading(false);
        })
        .catch(() => {
          setUser(null);
          setLoading(false);
        });
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [userId, username]);

  // 页面加载时默认展开第一模块
  useEffect(() => {
    setHoverIdx(0);
  }, []);

  // 个人信息展示
  const avatar = user?.avatarUrl || "";
  // 优先使用本地预览图
  const background = editForm?.backgroundPreviewUrl || user?.backgroundUrl || null;

  // 当第一模块背景发生变化（包含本地预览或保存后的新图），通知 Home 立即同步欢迎区背景
  useEffect(() => {
    try {
      window.dispatchEvent(
        new CustomEvent("user-profile-updated", {
          detail: { userId, backgroundUrl: background }
        })
      );
    } catch {}
  }, [background, userId]);
  const nickname = user?.nickname || "请设置昵称";
  const signature = user?.signature || "请设置签名";
  const bio = user?.bio || "这个人很神秘，还没有填写自我介绍~";
  const qqId = user?.qqId || "请设置QQ号";
  const wechatId = user?.wechatId || "请设置微信号";
  const phoneNumber = user?.phoneNumber || "请设置手机号";
  const githubUrl = user?.githubUrl || "请设置GitHub";
  const qqQrUrl = user?.qqQrUrl || "";
  const wechatQrUrl = user?.wechatQrUrl || "";
  // 新增bilibili主页链接
  const bilibiliUrl = user?.bilibiliUrl || "请设置B站主页";

  // 图标悬停状态
  const [githubHover, setGithubHover] = useState(false);
  const [bilibiliHover, setBilibiliHover] = useState(false);

  // 第一模块：背景+头像+昵称+签名，支持鼠标动态背景偏移
  const [bgOffset, setBgOffset] = useState({x: 0, y: 0});
  const bgAreaRef = useRef(null);
  const handleBgMouseMove = e => {
    if (!bgAreaRef.current) return;
    const rect = bgAreaRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    // 增强偏移幅度，让动态效果更明显
    const maxX = rect.width * 0.20;
    const maxY = rect.height * 0.15;
    setBgOffset({
      x: Math.max(-maxX, Math.min(maxX, ((x / rect.width) - 0.5) * rect.width * 0.3)),
      y: Math.max(-maxY, Math.min(maxY, ((y / rect.height) - 0.5) * rect.height * 0.2))
    });
  };
  const handleBgMouseLeave = () => setBgOffset({x: 0, y: 0});
  const renderProfile = () => {
    const isProfileActive = hoverIdx === 0 || expanded;
    const panelHeight = getPanelHeight(0);
    const avatarSize = isProfileActive ? panelHeight / 4 : 80;
    // 判断背景类型
    const isVideo = background && (background.endsWith('.mp4') || background.endsWith('.webm') || background.endsWith('.ogg'));
    const isGif = background && background.endsWith('.gif');
    // 计算动态偏移百分比（-20%~+20%），仅用于静态图片
    const offsetPercent = {
      x: Math.max(-20, Math.min(20, (bgOffset.x / (containerHeight || 1)) * 40)),
      y: Math.max(-20, Math.min(20, (bgOffset.y / (containerHeight || 1)) * 40)),
    };
    return (
      <div
        className={`profilepanel-profile-bg-area${isProfileActive ? ' profilepanel-section-active' : ''}`}
        ref={bgAreaRef}
        onMouseMove={handleBgMouseMove}
        onMouseLeave={handleBgMouseLeave}
        style={{position: 'relative', width: '100%', height: '100%'}} // 父容器相对定位
      >
        {/* 背景层，绝对定位，填满整个区域 */}
        {background && (
          isVideo ? (
            <video
              className={`profilepanel-profile-bg${!isProfileActive ? ' profilepanel-profile-bg-collapsed' : ''}`}
              src={background}
              autoPlay
              loop
              muted
              playsInline
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: `${50 + offsetPercent.x}% ${50 + offsetPercent.y}%`,
                zIndex: 1,
                transition: profilepanelStyle.bgMedia.transition
              }}
            />
          ) : isGif ? (
            <img
              className={`profilepanel-profile-bg${!isProfileActive ? ' profilepanel-profile-bg-collapsed' : ''}`}
              src={background}
              alt="profile gif"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: `${50 + offsetPercent.x}% ${50 + offsetPercent.y}%`,
                zIndex: 1,
                transition: profilepanelStyle.bgMedia.transition
              }}
            />
          ) : (
            <div
              className={`profilepanel-profile-bg${!isProfileActive ? ' profilepanel-profile-bg-collapsed' : ''}`}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                background: `url(${background}) center center/cover no-repeat`,
                backgroundPosition: `${50 + offsetPercent.x}% ${50 + offsetPercent.y}%`,
                zIndex: 1,
                transition: profilepanelStyle.bgMedia.transition
              }}
            />
          )
        )}
        {/* 内容层，保证在背景之上 */}
        <div
          className={isProfileActive ? "profilepanel-profile-bottom profilepanel-section-active" : "profilepanel-profile-bottom-collapsed"}
          style={{position: 'relative', zIndex: 2}}
        >
          <div
            className={`profilepanel-avatar-circle profilepanel-avatar-circle-dynamic${isProfileActive ? ' profilepanel-section-active' : ''}`}
            style={{ width: avatarSize, height: avatarSize }}
          >
            {avatar ? (
              <img
                src={avatar}
                alt="avatar"
                className="profilepanel-avatar-img profilepanel-avatar-img-dynamic"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <GrayPlaceholder text="头像" />
            )}
          </div>
          <div className={`profilepanel-nickname-group${isProfileActive ? ' profilepanel-section-active' : ''}`}>
            <span className="profilepanel-nickname">{nickname}</span>
            <span className="profilepanel-signature">{signature}</span>
          </div>
        </div>
      </div>
    );
  };
  // 第二模块：上半部分自我介绍，下半部分左右分栏（左：qq/wechat/phone，右：二维码）
  const renderDetail = () => (
    <div className="profilepanel-detail-panel">
      <div className="profilepanel-detail-top">
        <div className="profilepanel-taglist">
          {userTags && userTags.length > 0 ? (
            userTags.map((tag, idx) => (
              <span key={idx} className="profilepanel-tag-item">{tag}</span>
            ))
          ) : (
            <span className="profilepanel-tag-placeholder">尚未设置标签</span>
          )}
        </div>
      </div>
      <div className="profilepanel-detail-bottom">
        <div className="profilepanel-bio">{bio}</div>
        {(qqIconHover && qqQrUrl) && (
          <div className="profilepanel-detail-qr-center">
            <img src={qqQrUrl} alt="QQ二维码" loading="lazy" decoding="async" />
          </div>
        )}
        {(wechatIconHover && wechatQrUrl) && (
          <div className="profilepanel-detail-qr-center">
            <img src={wechatQrUrl} alt="微信二维码" loading="lazy" decoding="async" />
          </div>
        )}
        <div className="profilepanel-detail-icons-bar">
          <div className="profilepanel-detail-bottom-icon-group">
            <span
              onMouseEnter={()=>setQqIconHover(true)}
              onMouseLeave={()=>setQqIconHover(false)}
              className="profilepanel-detail-bottom-icon"
            >
              <img src="/icons/profile/qq.svg" alt="QQ" loading="lazy" decoding="async" />
            </span>
          </div>
          <div className="profilepanel-detail-bottom-icon-group">
            <span
              onMouseEnter={()=>setWechatIconHover(true)}
              onMouseLeave={()=>setWechatIconHover(false)}
              className="profilepanel-detail-bottom-icon"
            >
              <img src="/icons/profile/wechat.svg" alt="微信" loading="lazy" decoding="async" />
            </span>
          </div>
          <div className="profilepanel-detail-bottom-icon-group">
            <span
              onMouseEnter={()=>setBilibiliHover(true)}
              onMouseLeave={()=>setBilibiliHover(false)}
              onClick={()=>bilibiliUrl && bilibiliUrl!=="请设置B站主页" && window.open(bilibiliUrl,'_blank','noopener,noreferrer')}
              className="profilepanel-detail-bottom-icon"
              style={{cursor:bilibiliUrl && bilibiliUrl!=="请设置B站主页"?'pointer':'not-allowed'}}
            >
              <img src={bilibiliHover?'/icons/profile/bilibili02.svg':'/icons/profile/bilibili01.svg'} alt="Bilibili" loading="lazy" decoding="async" />
            </span>
          </div>
          <div className="profilepanel-detail-bottom-icon-group">
            <span
              onMouseEnter={()=>setGithubHover(true)}
              onMouseLeave={()=>setGithubHover(false)}
              onClick={()=>githubUrl && githubUrl!=="请设置GitHub" && window.open(githubUrl,'_blank','noopener,noreferrer')}
              className="profilepanel-detail-bottom-icon"
              style={{cursor:githubUrl && githubUrl!=="请设置GitHub"?'pointer':'not-allowed'}}
            >
              <img src={githubHover?'/icons/profile/github02.svg':'/icons/profile/github01.svg'} alt="GitHub" loading="lazy" decoding="async" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // 通用表单变更
  const handleEditChange = e => {
    const { name, value } = e.target;
    setEditForm(f => ({ ...f, [name]: value }));
  };
  // 新增：上传用户音乐
  const uploadUserMusic = async (musicName, duration, file) => {
    if (!userId || !file || !musicName) {
      setEditMsg("参数缺失，无法上传音乐");
      return null;
    }
    setEditUploading(true);
    setEditMsg("");
    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("musicName", musicName);
    formData.append("duration", duration || 0);
    formData.append("file", file);
    try {
      const res = await fetch("/api/usermusic/upload", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("上传失败");
      const data = await res.json();
      setEditMsg("音乐上传成功");
      // 上传成功后刷新播放器列表
      setMusicRefreshKey(k => k + 1);
      // 上传成功后自动刷新用户信息
      fetch(`/api/user/profile/${userId}`)
        .then(res => res.json())
        .then(data => setUser(data));
      return data.id; // 返回musicId
    } catch (e) {
      setEditMsg("音乐上传失败");
      return null;
    } finally {
      setEditUploading(false);
    }
  };

  // 新增：上传用户音乐背景
  const uploadUserMusicBg = async (musicId, file) => {
    if (!userId) {
      setEditMsg("userId 缺失，无法上传背景");
      console.error("uploadUserMusicBg: userId missing", { userId, musicId, file });
      return;
    }
    if (!musicId) {
      setEditMsg("musicId 缺失，无法上传背景");
      console.error("uploadUserMusicBg: musicId missing", { userId, musicId, file });
      return;
    }
    if (!file) {
      setEditMsg("文件缺失，无法上传背景");
      console.error("uploadUserMusicBg: file missing", { userId, musicId, file });
      return;
    }
    setEditUploading(true);
    setEditMsg("");
    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("musicId", musicId);
    formData.append("file", file);
    for (let pair of formData.entries()) {
      console.log("FormData:", pair[0], pair[1]);
    }
    try {
      const res = await fetch("/api/usermusicbg/upload", {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const errText = await res.text();
        setEditMsg("背景上传失败: " + errText);
        console.error("uploadUserMusicBg: response error", errText);
        throw new Error("上传失败");
      }
      setEditMsg("背景上传成功");
      // 上传成功后刷新播放器列表（背景列表）
      setMusicRefreshKey(k => k + 1);
      // 上传成功后自动刷新用户信息
      fetch(`/api/user/profile/${userId}`)
        .then(res => res.json())
        .then(data => setUser(data));
    } catch (e) {
      setEditMsg("背景上传失败");
      console.error("uploadUserMusicBg: exception", e);
    } finally {
      setEditUploading(false);
    }
  };

  // 图片/二维码/音乐/背景上传统一入口
  const handleEditUpload = async (type, file, options = {}) => {
    if (!userId || !file) return;
    // 音乐上传，自动获取时长
    if (type === "musicbg") {
      const musicName = options.musicName || file.name;
      const audio = document.createElement('audio');
      audio.src = URL.createObjectURL(file);
      audio.preload = 'metadata';
      audio.onloadedmetadata = async () => {
        const duration = Math.floor(audio.duration);
        const musicId = await uploadUserMusic(musicName, duration, file);
        setEditForm(f => ({ ...f, musicId }));
      };
      audio.onerror = () => {
        setEditMsg('无法解析音频时长，默认0秒');
        uploadUserMusic(musicName, 0, file).then(musicId => {
          setEditForm(f => ({ ...f, musicId }));
        });
      };
      return;
    }
    // 背景资源上传
    if (type === "musicbgResource") {
      const musicId = editForm.musicId;
      if (!musicId) {
        setEditMsg("请先上传音乐，获取musicId");
        return;
      }
      await uploadUserMusicBg(musicId, file);
      return;
    }
    // 其他类型（头像、二维码等）
    setEditUploading(true);
    setEditMsg("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/user/upload/${userId}?type=${type}`, {
        method: "POST",
        body: formData
      });
      const url = await res.text();
      setEditMsg(`${type} 上传成功`);
      setUser(u => ({ ...u, [`${type === 'wechatqr' ? 'wechatQrUrl' : type === 'qqqr' ? 'qqQrUrl' : type + 'Url'}`]: url }));
    } catch {
      setEditMsg(`${type} 上传失败`);
    }
    setEditUploading(false);
  };
  // 提交编辑
  const handleEditSubmit = async e => {
    e.preventDefault();
    if (!userId) return;
    setEditUploading(true);
    setEditMsg("");
    try {
      const res = await fetch(`/api/user/profile/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...user, ...editForm })
      });
      const msg = await res.text();
      setEditMsg(msg);
      // 刷新用户信息
      fetch(`/api/user/profile/${userId}`)
        .then(res => res.json())
        .then(data => {
          setUser(data);
          // 再次广播最新资料（以服务器返回为准）
          try {
            window.dispatchEvent(
              new CustomEvent("user-profile-updated", {
                detail: { userId, backgroundUrl: data?.backgroundUrl || null }
              })
            );
          } catch {}
        });
    } catch {
      setEditMsg("保存失败");
    }
    setEditUploading(false);
  };

  // 编辑区输入框焦点状态
  const [editInputFocused, setEditInputFocused] = useState(false);
  // 鼠标进入panel时展开，离开时收起（编辑区输入框聚焦时不收起）
  const handleMouseEnter = idx => setHoverIdx(idx);
  // 鼠标离开时自动展开第一模块
  const handleMouseLeave = () => {
    if (editInputFocused || editTabActiveIdx === 3 || hoverIdx === 3) return;
    setHoverIdx(0);
    if (onCollapse) onCollapse();
  };

  // 编辑区渲染，直接使用 ProfileEdit 组件
  const renderEdit = () => (
    <ProfileEdit
      user={user}
      editForm={editForm}
      setEditForm={setEditForm}
      editUploading={editUploading}
      setEditUploading={setEditUploading}
      editMsg={editMsg}
      setEditMsg={setEditMsg}
      editTags={editTags}
      setEditTags={setEditTags}
      tagMsg={tagMsg}
      setTagMsg={setTagMsg}
      handleEditChange={handleEditChange}
      handleEditUpload={handleEditUpload}
      handleEditSubmit={handleEditSubmit}
      handleTagChange={handleTagChange}
      handleAddTag={handleAddTag}
      handleDeleteTag={handleDeleteTag}
      handleSaveTags={handleSaveTags}
      editInputFocused={editInputFocused}
      setEditInputFocused={setEditInputFocused}
      editTabActiveIdx={editTabActiveIdx}
      setEditTabActiveIdx={setEditTabActiveIdx}
    />
  );

  const panels = [
    { content: renderProfile() },
    { content: renderDetail() },
    { content: renderMusicPlayer() },
    { content: renderEdit() },
  ];

  return (
    <div
      className="profilepanel-container"
      style={{ width: panelWidth, height: panelHeight }}
      ref={containerRef}
      onMouseLeave={handleMouseLeave}
    >
      {panels.map((panel, idx) => {
        if (idx === 0) {
          return (
            <div
              key={idx}
              className={`profilepanel-section${hoverIdx === idx ? ' profilepanel-section-active' : ''}`}
              style={{
                height: getPanelHeight(idx),
                minHeight: getPanelHeight(idx)
              }}
              onMouseEnter={() => setHoverIdx(idx)}
            >
              <div
                className={`profilepanel-content${hoverIdx === idx ? ' profilepanel-content-active' : ' profilepanel-content-collapsed'}`}
              >
                {panel.content}
              </div>
            </div>
          );
        }
        const isActive = hoverIdx === idx;
        const direction = idx > hoverIdx ? 'down' : 'up';
        const sectionMod = idx === 1 ? ' profilepanel-section--detail' : (idx === 3 ? ' profilepanel-section--edit' : '');
        return (
          <div
            key={idx}
            className={`profilepanel-section profilepanel-scroll-section${isActive ? ' profilepanel-section-active' : ''}${sectionMod}`}
            style={{
              height: getPanelHeight(idx),
              minHeight: getPanelHeight(idx)
            }}
            onMouseEnter={() => setHoverIdx(idx)}
          >
            <div
              className={`profilepanel-content profilepanel-scroll-content${isActive ? ' profilepanel-scroll-active' : ' profilepanel-scroll-collapsed'} profilepanel-scroll-${direction}`}
            >
              {panel.content}
            </div>
          </div>
        );
      })}
      {loading && <div className="profilepanel-loading">加载中...</div>}
    </div>
  );
}
