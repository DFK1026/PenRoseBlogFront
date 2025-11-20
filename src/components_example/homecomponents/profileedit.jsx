import React, { useState, useEffect } from "react";
import "./styles/profileedit/profileedit.css";
import profileeditstyle from "./styles/profileedit/profileeditstyle";

export default function ProfileEdit({
  user,
  editForm,
  setEditForm,
  editUploading,
  setEditUploading,
  editMsg,
  setEditMsg,
  editTags,
  setEditTags,
  tagMsg,
  setTagMsg,
  handleEditChange,
  handleEditUpload,
  handleEditSubmit,
  handleTagChange,
  handleAddTag,
  handleDeleteTag,
  handleSaveTags,
  editInputFocused,
  setEditInputFocused,
  editTabActiveIdx,
  setEditTabActiveIdx,
}) {
  // 图片预览
  const avatarPreview = editForm.avatarUrl || user?.avatarUrl || "";
  const bgPreview = editForm.backgroundUrl || user?.backgroundUrl || "";
  const qqQrPreview = editForm.qqQrUrl || user?.qqQrUrl || "";
  const wechatQrPreview = editForm.wechatQrUrl || user?.wechatQrUrl || "";


  // 当前选中的编辑区域索引
  const [activeSection, setActiveSection] = useState(0); // 0:标签 1:头像和背景 2:基本信息 3:详细信息 4:背景音乐 5:精选相册

  // 导航标签
  const navs = ["标签", "头像和背景", "基本信息", "详细信息", "背景音乐", "精选相册"];

  // 精选相册相关状态
  const [featuredPhotos, setFeaturedPhotos] = useState([]);
  const [featuredUploading, setFeaturedUploading] = useState(false);
  const [featuredMsg, setFeaturedMsg] = useState("");

  // 小工具：后端文件路径转静态资源路径
  const toPublicPath = (p) => (p || "").replace(
    "D:/Projects/mydear/localdatabase/sources/userlikephotoandgifs/",
    "/userlikephotoandgifs/"
  ).replace(/\\/g, "/");

  // 获取精选相册（按上传时间倒序，且仅保留前15个、仅图片）
  useEffect(() => {
    if (user?.id) {
      fetch(`/api/user-featured-photos/user/${user.id}`)
        .then(res => res.json())
        .then(data => {
          const list = Array.isArray(data) ? data : [];
          const onlyImages = list.filter(p => (p.fileType || "").startsWith("image"));
          onlyImages.sort((a,b) => new Date(b.uploadTime) - new Date(a.uploadTime));
          setFeaturedPhotos(onlyImages.slice(0, 15));
        })
        .catch(() => setFeaturedPhotos([]));
    }
  }, [user?.id]);

  // 仅允许图片（不支持 GIF/视频）
  const isAllowedFeaturedFile = (file) => {
    if (!file) return false;
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    // 明确限制仅 jpg/jpeg/png，排除 gif 与视频
    const byExt = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png');
    const byMime = type === 'image/jpeg' || type === 'image/jpg' || type === 'image/png';
    // 若浏览器提供了更宽泛的 image/* 也要排除 gif
    const isGif = type === 'image/gif' || name.endsWith('.gif');
    return !isGif && (byExt || byMime);
  };

  // 上传精选相册
  const handleFeaturedUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user?.id) return;
    // 前置校验：仅图片（jpg/jpeg/png），不支持 gif/视频
    if (!isAllowedFeaturedFile(file)) {
      setFeaturedMsg("仅支持 JPG/PNG 图片，不支持 GIF/视频");
      e.target.value = "";
      return;
    }
    setFeaturedUploading(true);
    setFeaturedMsg("");
    const formData = new FormData();
    formData.append("userId", user.id);
    formData.append("file", file);
    try {
      const res = await fetch("/api/user-featured-photos/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const msg = await res.text();
        setFeaturedMsg(msg || "上传失败");
      } else {
        const photo = await res.json();
        // 新上传的在最前，维持倒序 + 限制最多 15 张
        setFeaturedPhotos(prev => {
          const next = [photo, ...prev].filter(p => (p.fileType||"").startsWith("image"));
          next.sort((a,b) => new Date(b.uploadTime) - new Date(a.uploadTime));
          return next.slice(0, 15);
        });
        setFeaturedMsg("上传成功");
      }
    } catch (err) {
      setFeaturedMsg("上传失败");
    }
    setFeaturedUploading(false);
    e.target.value = "";
  };

  // 删除精选相册
  const handleDeleteFeatured = async (photoId) => {
    if (!window.confirm("确定要删除该图片吗？")) return;
    setFeaturedUploading(true);
    setFeaturedMsg("");
    try {
      const res = await fetch(`/api/user-featured-photos/${photoId}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await res.text();
        setFeaturedMsg(msg || "删除失败");
      } else {
        setFeaturedPhotos(prev => prev.filter(p => p.id !== photoId));
        setFeaturedMsg("删除成功");
      }
    } catch (err) {
      setFeaturedMsg("删除失败");
    }
    setFeaturedUploading(false);
  };

  return (
  <div className="profileedit-main-panel">
      {/* 左侧导航区 */}
      <div className="profileedit-nav-panel">
        {navs.map((nav, idx) => (
          <button
            key={nav}
            className={`profileedit-nav-btn${activeSection === idx ? ' active' : ''}`}
            onClick={() => setActiveSection(idx)}
            type="button"
          >{nav}</button>
        ))}
      </div>
      {/* 右侧编辑区，仅显示当前分区 */}
      <div className="profileedit-edit-panel">
        <form className="profileedit-form" onSubmit={handleEditSubmit}>
          {/* 新增：背景音乐编辑区 */}
          {activeSection === 4 && (
            <div className="profileedit-group" style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <div className="profileedit-group-title">背景音乐与资源</div>
              <div className="profileedit-upload-card" style={profileeditstyle.uploadCard}>
                <div className="profileedit-upload-title" style={profileeditstyle.uploadTitle}>上传背景音乐及资源</div>
                <div className="profileedit-upload-form" style={profileeditstyle.uploadForm}>
                  <input
                    type="file"
                    className="profileedit-upload-file-input"
                    style={profileeditstyle.uploadFileInput}
                    accept="audio/*"
                    disabled={editUploading}
                    onChange={e => handleEditUpload("musicbg", e.target.files[0])}
                  />
                  <input
                    type="file"
                    className="profileedit-upload-file-input"
                    style={profileeditstyle.uploadFileInput}
                    accept="image/*,video/*"
                    disabled={editUploading}
                    onChange={e => handleEditUpload("musicbgResource", e.target.files[0])}
                  />
                  <button
                    type="button"
                    className="profileedit-upload-btn"
                    style={editUploading ? { ...profileeditstyle.uploadBtn, ...profileeditstyle.uploadBtnDisabled } : profileeditstyle.uploadBtn}
                    disabled={editUploading}
                    onClick={() => {/* 可扩展为批量上传逻辑 */}}
                  >上传</button>
                </div>
                <div className="profileedit-upload-tip" style={profileeditstyle.uploadTip}>支持上传音乐、图片、GIF、视频作为背景</div>
              </div>
            </div>
          )}
          {/* 精选相册编辑区，独立显示在activeSection === 5 */}
          {activeSection === 5 && (
            <div className="profileedit-group profileedit-featured-group">
              {/* 不再重复展示“精选相册”标题 */}
              <div className="profileedit-featured-card">
                {/* 图片网格（3列，最多5行） */}
                <div className="profileedit-featured-grid">
                  {featuredPhotos.map(photo => (
                    <div key={photo.id} className="profileedit-featured-diamond">
                      {photo.fileType && photo.fileType.startsWith('image') ? (
                        <img src={toPublicPath(photo.filePath)} alt="精选" className="profileedit-featured-img-in" />
                      ) : null}
                      <button
                        type="button"
                        onClick={()=>handleDeleteFeatured(photo.id)}
                        className={`profileedit-featured-delete${featuredUploading ? ' disabled' : ''}`}
                        disabled={featuredUploading}
                        title="删除"
                      >×</button>
                    </div>
                  ))}
                  {/* 上传入口：未满 15 张时显示，出现在队尾 */}
                  {featuredPhotos.length < 15 && (
                    <label className={`profileedit-featured-upload${featuredUploading ? ' disabled' : ''}`} title="上传图片">
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        onChange={handleFeaturedUpload}
                        disabled={featuredUploading}
                      />
                      <div className="profileedit-featured-upload-inner" aria-hidden="true" />
                    </label>
                  )}
                </div>
                {/* 消息提示与计数 */}
                {featuredMsg && (
                  <div className={`profileedit-featured-msg${featuredMsg.includes('成功') ? ' success' : ' error'}`}>{featuredMsg}</div>
                )}
                {/* 删除“仅支持 JPG/PNG 图片，最多 15 张 …”字样，保留界面整洁 */}
                {/* <div className="profileedit-featured-tip">仅支持 JPG/PNG 图片，最多 15 张 <span className="profileedit-featured-count">{featuredPhotos.length}/15</span></div> */}
              </div>
            </div>
          )}
          {activeSection === 0 && (
            <div className="profileedit-group" style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <div className="profileedit-group-title">标签编辑</div>
              <div style={{marginBottom:8}}>
                {editTags.map((tag, idx) => (
                  <span key={idx} style={{ display: "inline-flex", alignItems: "center", marginRight: 8 }}>
                    <input
                      className="profileedit-tag-input"
                      style={profileeditstyle.tagInput}
                      type="text"
                      value={tag}
                      onChange={e => handleTagChange(idx, e.target.value)}
                      disabled={editUploading}
                      maxLength={15}
                    />
                    <button
                      type="button"
                      className="profileedit-tag-btn"
                      style={profileeditstyle.tagBtn}
                      onClick={() => handleDeleteTag(idx)}
                      disabled={editUploading}
                    >删除</button>
                  </span>
                ))}
                {editTags.length < 9 && (
                  <button
                    type="button"
                    className="profileedit-tag-btn"
                    style={profileeditstyle.tagBtn}
                    onClick={handleAddTag}
                    disabled={editUploading}
                  >新增标签</button>
                )}
                <button
                  type="button"
                  className="profileedit-tag-btn"
                  style={profileeditstyle.tagBtn}
                  onClick={handleSaveTags}
                  disabled={editUploading}
                >保存标签</button>
                {tagMsg && <div className="profileedit-tip" style={profileeditstyle.editTip}>{tagMsg}</div>}
              </div>
            </div>
          )}
          {activeSection === 1 && (
            <div className="profileedit-group" style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <div className="profileedit-group-title">头像和背景</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:16,alignItems:'center',marginBottom:8}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:'0.95rem',marginBottom:4}}>头像</div>
                  <input type="file" accept="image/*" onChange={e => handleEditUpload("avatar", e.target.files[0])} disabled={editUploading} />
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:'0.95rem',marginBottom:4}}>背景</div>
                  <input type="file" accept="image/*,video/*" onChange={e => handleEditUpload("background", e.target.files[0])} disabled={editUploading} />
                </div>
              </div>
            </div>
          )}
          {activeSection === 2 && (
            <div className="profileedit-group" style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <div className="profileedit-group-title">基本信息</div>
              <input
                className="profileedit-input"
                style={profileeditstyle.editInput}
                type="text"
                name="nickname"
                value={editForm.nickname || ""}
                onChange={handleEditChange}
                placeholder="昵称（最多10字符）"
                maxLength={10}
                disabled={editUploading}
                onFocus={() => setEditInputFocused(true)}
                onBlur={() => setEditInputFocused(false)}
              />
              <input
                className="profileedit-input"
                style={profileeditstyle.editInput}
                type="text"
                name="signature"
                value={editForm.signature || ""}
                onChange={handleEditChange}
                placeholder="个性签名（最多25字符）"
                maxLength={25}
                disabled={editUploading}
              />
              <textarea
                className="profileedit-input"
                style={profileeditstyle.editInput}
                name="bio"
                value={editForm.bio || ""}
                onChange={handleEditChange}
                placeholder="自我介绍（最多255字符）"
                maxLength={255}
                disabled={editUploading}
              />
            </div>
          )}
          {activeSection === 3 && (
            <div className="profileedit-group" style={{width:'100%',height:'100%',display:'flex',flexDirection:'row',justifyContent:'center',alignItems:'flex-start',gap:32}}>
              {/* 左侧：详细信息表单 */}
              <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:12}}>
                <div className="profileedit-group-title">详细信息</div>
                <input
                  className="profileedit-input"
                  style={profileeditstyle.editInput}
                  type="text"
                  name="wechatId"
                  value={editForm.wechatId || ""}
                  onChange={handleEditChange}
                  placeholder="微信号"
                  disabled={editUploading}
                />
                <input
                  className="profileedit-input"
                  style={profileeditstyle.editInput}
                  type="text"
                  name="qqId"
                  value={editForm.qqId || ""}
                  onChange={handleEditChange}
                  placeholder="QQ号"
                  disabled={editUploading}
                />
                <input
                  className="profileedit-input"
                  style={profileeditstyle.editInput}
                  type="text"
                  name="phoneNumber"
                  value={editForm.phoneNumber || ""}
                  onChange={handleEditChange}
                  placeholder="手机号"
                  disabled={editUploading}
                />
                <div style={{display:'flex',flexWrap:'wrap',gap:16,alignItems:'center',marginBottom:8}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:'0.95rem',marginBottom:4}}>QQ二维码</div>
                    <input type="file" accept="image/*" onChange={e => handleEditUpload("qqqr", e.target.files[0])} disabled={editUploading} />
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:'0.95rem',marginBottom:4}}>微信二维码</div>
                    <input type="file" accept="image/*" onChange={e => handleEditUpload("wechatqr", e.target.files[0])} disabled={editUploading} />
                  </div>
                </div>
                <input
                  className="profileedit-input"
                  style={profileeditstyle.editInput}
                  type="text"
                  name="githubUrl"
                  value={editForm.githubUrl || ""}
                  onChange={handleEditChange}
                  placeholder="GitHub主页"
                  disabled={editUploading}
                />
                <input
                  className="profileedit-input"
                  style={profileeditstyle.editInput}
                  type="text"
                  name="bilibiliUrl"
                  value={editForm.bilibiliUrl || ""}
                  onChange={handleEditChange}
                  placeholder="B站主页"
                  disabled={editUploading}
                />
              </div>
            </div>
          )}
          {editMsg && <div className="profileedit-tip" style={profileeditstyle.editTip}>{editMsg}</div>}
        </form>
        {/* 精选相册：底部居中“选择文件”按钮（sticky） */}
        {activeSection === 5 && (
          null
        )}
        {/* 保存按钮移到主面板底部；精选相册页不显示 */}
        {activeSection !== 5 && (
          <div className="profileedit-btn-panel">
            <button
              className="profileedit-btn"
              style={editUploading ? { ...profileeditstyle.editBtn, ...profileeditstyle.editBtnDisabled } : profileeditstyle.editBtn}
              type="button"
              disabled={editUploading}
              onClick={handleEditSubmit}
            >保存个人信息</button>
          </div>
        )}
      </div>
    </div>

  );
}
