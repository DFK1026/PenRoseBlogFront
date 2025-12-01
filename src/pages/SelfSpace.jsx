import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import '../styles/selfspace/SelfSpace.css';
import SelfspaceProfileAccordion from '../components/selfspace/SelfspaceProfileAccordion/SelfspaceProfileAccordion.jsx';
import BannerNavbar from '../components/common/BannerNavbar.jsx';

// SelfSpace 页面：左侧 25vw 手风琴资料面板 + 右侧内容区域
export default function SelfSpace() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const urlUserId = params.get('userId');                 // 被查看用户ID（可能为空）
  const myId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;
  const isOwner = !urlUserId || String(urlUserId) === String(myId);
  const effectiveUserId = isOwner ? myId : urlUserId;     // 传给手风琴的实际 userId

  // 仅在“查看别人主页”时，拉取其资料用于上方信息条
  const [viewProfile, setViewProfile] = useState(null);
  useEffect(() => {
    if (!effectiveUserId || isOwner) { setViewProfile(null); return; }
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    fetch(`/api/user/profile/${effectiveUserId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(j => {
        if (j && (j.code === 200 || j.status === 200)) setViewProfile(j.data || null);
      })
      .catch(() => {});
  }, [effectiveUserId, isOwner]);

  return (
    <>
      <BannerNavbar />
      <div className="selfspace-page" data-page="selfspace">
        <aside className="selfspace-left-panel" aria-label="个人空间侧边栏">
          <div className="selfspace-left-panel-inner">
            {/* 非本人时：在手风琴上方展示一个简介条 */}
            {!isOwner && viewProfile && (
              <div className="selfspace-user-brief">
                <img
                  className="selfspace-user-brief-avatar"
                  src={viewProfile.avatarUrl || '/imgs/loginandwelcomepanel/1.png'}
                  alt="avatar"
                  onError={e => { e.currentTarget.src = '/imgs/loginandwelcomepanel/1.png'; }}
                />
                <div className="selfspace-user-brief-info">
                  <div className="nick">{viewProfile.nickname || viewProfile.username || `用户${effectiveUserId}`}</div>
                  <div className="uname">@{viewProfile.username || ''}</div>
                </div>
              </div>
            )}
            <SelfspaceProfileAccordion
              panelWidth="100%"
              panelHeight="100%"
              viewUserId={effectiveUserId}
              hideEditPanel={!isOwner}
            />
          </div>
        </aside>

        <main className="selfspace-right-panel" aria-label="个人空间内容区">
          {/* ProfileEditPanel 已集成到 SelfspaceProfileAccordion，无需单独渲染 */}
          <div style={{ height: '2000px', background: 'rgba(0,0,0,0.03)' }} />
        </main>
      </div>
    </>
  );
}
