import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import '../styles/selfspace/SelfSpace.css';
import SelfspaceProfileAccordion from '../components/selfspace/SelfspaceProfileAccordion/SelfspaceProfileAccordion.jsx';
import BannerNavbar from '../components/common/BannerNavbar.jsx';
import ArticleCard from '../components/common/ArticleCard';

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

  // 文章列表相关
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const [size] = useState(4); // 每页 4 篇
  const [sortMode, setSortMode] = useState('latest'); // 'latest' | 'hot'
  const currentUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;

  // 可选：记录总数（热度模式下由前端计算）
  const [totalCount, setTotalCount] = useState(null);
  const [lastFetchedCount, setLastFetchedCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    if (!effectiveUserId) { setPosts([]); setTotalCount(null); setLastFetchedCount(0); return; }

    // 始终全量拉取该用户所有文章，前端分页
    const fetchSize = 10000;
    const fetchPage = 0;

    fetch(`/api/blogpost?userId=${effectiveUserId}&page=${fetchPage}&size=${fetchSize}${currentUserId?`&currentUserId=${currentUserId}`:''}`)
      .then(r => r.json())
      .then(async j => {
        if (!mounted) return;
        if (j && (j.code === 200 || j.status === 200)) {
          let list = j.data && j.data.list ? j.data.list : (j.data || []);
          if (!Array.isArray(list) && Array.isArray(j.data)) list = j.data;
          // 只保留当前用户的文章
          list = list.filter(p => String(p.userId) === String(effectiveUserId));

          if (sortMode === 'hot' && list.length) {
            try {
              // 并行获取每篇的浏览量，然后按自定义热度 score 排序（与 Home 保持一致）
              const ids = list.map(p => (p.id || p.postId));
              const promises = ids.map(id =>
                fetch(`/api/blogview/${id}`).then(r => r.ok ? r.json() : null).catch(() => null)
              );
              const results = await Promise.all(promises);
              const viewMap = new Map();
              results.forEach((res, idx) => {
                const id = ids[idx];
                const v = (res && res.code === 200 && res.data) ? Number(res.data.viewCount || 0) : 0;
                viewMap.set(String(id), v);
              });
              // 评分策略：score = viewCount + likeCount * 30
              list = list.slice().sort((a, b) => {
                const va = (viewMap.get(String(a.id || a.postId)) || 0) + ((a.likeCount || a.likes || 0) * 30);
                const vb = (viewMap.get(String(b.id || b.postId)) || 0) + ((b.likeCount || b.likes || 0) * 30);
                return vb - va;
              });
            } catch (e) {
              console.error('[SelfSpace hot排序] 获取浏览量失败', e);
            }
          }
          // 前端分页
          setTotalCount(list.length);
          const start = page * size;
          const paged = list.slice(start, start + size);
          setPosts(paged);
          setLastFetchedCount(paged.length);
        } else {
          setPosts([]);
          setTotalCount(null);
          setLastFetchedCount(0);
        }
      })
      .catch(err => {
        console.error('[SelfSpace] 获取用户文章失败', err);
        if (mounted) { setPosts([]); setTotalCount(null); setLastFetchedCount(0); }
      });

    return () => { mounted = false; };
  }, [effectiveUserId, page, size, sortMode, currentUserId]);

  const canPrev = page > 0;
  const canNext = totalCount !== null
    ? ((page + 1) * size < totalCount)
    : (lastFetchedCount === size);

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
          <div className="selfspace-articles-wrap">
            <div className="selfspace-articles-top">
              <div className="selfspace-articles-title">
                <h2>TA 的文章</h2>
              </div>
              <div className="selfspace-sort-group" role="tablist" aria-label="文章排序">
                <button
                  className={`selfspace-sort-btn${sortMode === 'latest' ? ' active' : ''}`}
                  onClick={() => { setSortMode('latest'); setPage(0); }}
                  aria-pressed={sortMode === 'latest'}
                >
                  最新
                </button>
                <button
                  className={`selfspace-sort-btn${sortMode === 'hot' ? ' active' : ''}`}
                  onClick={() => { setSortMode('hot'); setPage(0); }}
                  aria-pressed={sortMode === 'hot'}
                >
                  最热
                </button>
              </div>
            </div>

            <div className="selfspace-articles-grid">
              {(!posts || posts.length === 0) ? (
                <div className="selfspace-articles-empty">暂无文章</div>
              ) : (
                posts.map(p => (
                  <ArticleCard key={p.id || p.postId} post={p} className="selfspace-article-card" />
                ))
              )}
            </div>

            <div className="selfspace-pagination">
              <button disabled={!canPrev} onClick={() => canPrev && setPage(Math.max(0, page - 1))}>上一页</button>
              <span>第 {page + 1} 页</span>
              <button disabled={!canNext} onClick={() => canNext && setPage(page + 1)}>下一页</button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
