import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import MarkdownIt from 'markdown-it';
import { useParams } from 'react-router-dom';
import BannerNavbar from '../components/common/BannerNavbar';
import '../styles/article/ArticleDetail.css';
import resolveUrl from '../utils/resolveUrl';

export default function ArticleDetail(){
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  // 评论分页
  const [commentsPage, setCommentsPage] = useState(1);
  const commentsPerPage = 8;
  // repliesMap: { [commentId]: [reply,...] }
  const [repliesMap, setRepliesMap] = useState({});
  // 楼中楼分页 map：{ [commentId]: pageNumber }
  const [repliesPageMap, setRepliesPageMap] = useState({});
  const repliesPerPage = 6;
  // 热门回复缓存：{ [commentId]: [reply,...] }
  const [hotRepliesMap, setHotRepliesMap] = useState({});
  // which comment's replies panel is open
  const [openReplies, setOpenReplies] = useState({});
  // per-comment reply input text
  const [replyTextMap, setReplyTextMap] = useState({});
  // 存放待提交回复的目标用户 id（按父评论 id 索引）
  const [replyMentionMap, setReplyMentionMap] = useState({});
  const [commentText, setCommentText] = useState('');
  // 父评论排序方式：'hot' 或 'time'
  const [commentsSortMode, setCommentsSortMode] = useState('time');
  const userId = localStorage.getItem('userId');
  const recordedRef = useRef(false); // 防止同一组件实例重复并发记录

  useEffect(()=>{
    fetch(`/api/blogpost/${id}${userId?`?currentUserId=${userId}`:''}`)
      .then(r=>r.json()).then(async j=>{
        console.log('[文章详情] 后端返回数据:', j);
        if(j && j.code===200) {
          setPost(j.data);

          // 记录一次浏览（后端接口：POST /api/blogview/record）
          // 防重复策略：
          // 1) sessionStorage 记录本 session 最近一次记录时间（key: view_record_{id}）；
          //    若距离上次记录小于 SHORT_WINDOW_MS 则跳过（避免 StrictMode / 快速 remount 导致的双发）。
          // 2) recordedRef 防止同一实例内并发重复请求。
          // 允许用户在稍后再次访问时继续计数（不是永久幂等）。
          try {
            const SHORT_WINDOW_MS = 1000; // 短时窗口，5s 内重复访问视为同一次（可调整）
            const key = `view_record_${id}`;
            const now = Date.now();
            const last = Number(sessionStorage.getItem(key) || 0);
            if (last && (now - last) < SHORT_WINDOW_MS) {
              console.debug('[浏览] 短时内已记录，跳过重复记录', id);
            } else if (!recordedRef.current) {
              recordedRef.current = true;
              // 先写 sessionStorage 避免在 StrictMode 下第二次 mount 也通过时间判断
              sessionStorage.setItem(key, String(now));
              const payload = { blogPostId: Number(id) };
              if (userId) payload.userId = Number(userId);
              const rec = await fetch('/api/blogview/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              const jr = await rec.json().catch(()=>null);
              if (jr && jr.code === 200 && jr.data) {
                const vc = Number(jr.data.viewCount || 0);
                setPost(prev => prev ? ({ ...prev, viewCount: vc }) : prev);
                try { window.dispatchEvent(new CustomEvent('blogview-updated', { detail: { blogPostId: String(id), viewCount: vc } })); } catch {}
              }
              // 小延迟后释放并发锁，允许后续独立访问再记录
              setTimeout(()=>{ recordedRef.current = false; }, 800);
            } else {
              console.debug('[浏览] 已在记录中，跳过本次重复触发', id);
            }
          } catch (e) {
            recordedRef.current = false;
            console.error('[记录浏览失败]', e);
          }
        }
      })
      .catch(console.error);
    // load comments (使用后端约定接口)
    loadComments();
  },[id, userId]);

  async function loadComments(page,size){
    // 后端接口：GET /api/comment/list/{blogPostId}
    // 请求所有评论（无上限）：通过设置较大 size 参数请求后端返回全部评论
    const params = new URLSearchParams();
    if (userId) params.set('currentUserId', userId);
    // 请求一个足够大的 size，以便后端返回全部评论（若后端支持 size）
    params.set('size', '10000');
    const url = `/api/comment/list/${id}?${params.toString()}`;
    try{
      const res = await fetch(url);
      const j = await res.json().catch(()=>null);
      if(j && j.code===200){
        // 后端可能直接返回数组或 { data: [...] }，兼容两种
        const list = Array.isArray(j.data) ? j.data : (Array.isArray(j) ? j : (j.data && Array.isArray(j.data.list) ? j.data.list : []));
        setComments(list || []);

        // 补充：并行请求每条父评论的回复统计（从 /api/comment-reply/list/{commentId} 中取 total 或 list.length）
        try {
          const ids = (list || []).map(c => c.id).filter(Boolean);
          if (ids.length) {
            const promises = ids.map(cid =>
              fetch(`/api/comment-reply/list/${cid}${userId?`?currentUserId=${userId}`:''}`).then(r => r.ok ? r.json().catch(()=>null) : null).catch(()=>null)
            );
            const results = await Promise.all(promises);
            // 构建 map 并回写 replyCount 到 comments
            const countMap = new Map();
            // 同时构建首次加载时的热门回复缓存（确保页面初次渲染就有预览）
            const hotMap = {};
            results.forEach((res, idx) => {
              const cid = ids[idx];
              if (res && res.code === 200) {
                // 兼容 data / data.list / data.data 三种结构
                let arr = [];
                if (Array.isArray(res.data)) arr = res.data;
                else if (res.data && Array.isArray(res.data.list)) arr = res.data.list;
                else if (res.data && Array.isArray(res.data.data)) arr = res.data.data;
                // replyCount
                if (Array.isArray(arr)) countMap.set(String(cid), arr.length);
                else if (res.data && typeof res.data.total === 'number') countMap.set(String(cid), res.data.total);
                // 计算该父评论的热门回复：仅基于父评论的点赞数
                // 规则：若 parent.likeCount < 2 则不显示预览；否则阈值 = Math.floor(parent.likeCount / 2)
                try {
                  const parent = (list || []).find(c => String(c.id) === String(cid)) || {};
                  const parentLike = Number(parent.likeCount || 0);
                  if (parentLike >= 2) {
                    const threshold = Math.floor(parentLike / 2);
                    const normalized = (arr || []).map(r => ({ ...(r||{}), likeCount: Number(r.likeCount || r.likes || 0), createdAt: r.createdAt || r.createTime }));
                    // 优先按点赞数降序，其次按时间升序（早的在前）
                    const hot = (normalized || [])
                      .filter(rr => Number(rr.likeCount || 0) >= threshold)
                      .sort((a,b) => {
                        const la = Number(b.likeCount || 0) - Number(a.likeCount || 0);
                        if (la !== 0) return la;
                        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                      })
                      .slice(0,3);
                    if (hot && hot.length) hotMap[String(cid)] = hot;
                  }
                } catch(e){ /* ignore */ }
              }
            });
            if (countMap.size) {
              setComments(prev => (prev || []).map(cm => {
                const v = countMap.get(String(cm.id));
                if (typeof v === 'number') return { ...cm, replyCount: v };
                return cm;
              }));
            }
            // 合并并写入 hotRepliesMap，保证首次加载就可以显示预览
            if (Object.keys(hotMap).length) {
              setHotRepliesMap(prev => ({ ...prev, ...hotMap }));
            }
          }
        } catch(e) {
          console.warn('[loadComments] 获取回复统计失败', e);
        }
        return list || [];
      }
      return [];
    }catch(e){
      console.error(e);
      return [];
    }
  }

  // 拉取某条父评论的楼中楼回复列表
  async function loadReplies(commentId) {
    if (!commentId) return;
    try {
      const res = await fetch(`/api/comment-reply/list/${commentId}${userId?`?currentUserId=${userId}`:''}`);
      const j = await res.json().catch(()=>null);
      if (j && j.code === 200) {
        // 兼容后端返回结构：data 可能是数组或 { list: [...] }
        let arr = [];
        let total = null;
        if (Array.isArray(j.data)) { arr = j.data; }
        else if (j.data && Array.isArray(j.data.list)) { arr = j.data.list; total = (typeof j.data.total === 'number' ? j.data.total : arr.length); }
        else if (j.data && Array.isArray(j.data.data)) { arr = j.data.data; }
        // 规范化：确保每条回复都有 likedByCurrentUser 字段（布尔）以供渲染“取消点赞”
        const normalized = (arr || []).map(r => ({ ...(r || {}), likedByCurrentUser: Boolean(r && (r.likedByCurrentUser || r.liked)), replyCount: r.replyCount || 0 }));
        // 按时间升序（时间早的在上，新的在下）
        const list = (normalized || []).slice().sort((a,b)=>{
          return new Date(a.createdAt || a.createTime).getTime() - new Date(b.createdAt || b.createTime).getTime();
        });
        setRepliesMap(prev => ({ ...prev, [commentId]: list }));

        // 计算热门回复：热度 = likeCount + replyCount，若热度 >= 父评论热度的一半则为热门，最多取 3 条
        try {
          // 与 loadComments 保持一致：仅基于父评论的点赞数判断
          const parent = (comments || []).find(cm => String(cm.id) === String(commentId)) || {};
          const parentLike = Number(parent.likeCount || 0);
          if (parentLike >= 2) {
            const threshold = Math.floor(parentLike / 2);
            const normalized = (list || []).map(r => ({ ...(r||{}), likeCount: Number(r.likeCount || r.likes || 0), createdAt: r.createdAt || r.createTime }));
            const hot = (normalized || [])
              .filter(rr => Number(rr.likeCount || 0) >= threshold)
              .sort((a,b) => {
                const la = Number(b.likeCount || 0) - Number(a.likeCount || 0);
                if (la !== 0) return la;
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              })
              .slice(0,3);
            if (hot && hot.length) {
              setHotRepliesMap(prev => ({ ...prev, [commentId]: hot }));
            } else {
              // 无符合项则移除该父评论的 hot 条目（保持一致性）
              setHotRepliesMap(prev => { const n = { ...prev }; delete n[commentId]; return n; });
            }
          } else {
            // 父评论点赞过少时确保没有预览
            setHotRepliesMap(prev => { const n = { ...prev }; delete n[commentId]; return n; });
          }
        } catch(e){
          console.warn('[loadReplies] compute hot replies failed', e);
        }

        // 同步更新 comments 中该条的 replyCount（优先用后端 total 字段，否则用数组长度）
        setComments(prev => prev.map(cm => {
          if (String(cm.id) === String(commentId)) {
            return { ...cm, replyCount: (typeof total === 'number' ? total : (list.length || 0)) };
          }
          return cm;
        }));
      }
    } catch(e) { console.error('[loadReplies]', e); }
  }

  // 点击预览：展开父评论楼中楼（若未加载则先加载），随后滚动到指定回复位置
  async function openCommentReplyAndScroll(commentId, replyId){
    // 展开面板
    setOpenReplies(prev => ({ ...prev, [commentId]: true }));
    // 若尚未加载则拉取
    if (!repliesMap[commentId]) {
      try { await loadReplies(commentId); } catch(e){ console.error('[openCommentReplyAndScroll] loadReplies failed', e); }
    }
    // 清除已有高亮（避免残留）
    try { document.querySelectorAll('.hot-highlight').forEach(el=>el.classList.remove('hot-highlight')); } catch(e){}
    // 等待渲染后滚动并高亮目标回复
    setTimeout(()=>{
      const el = document.getElementById(`reply-${replyId}`);
      if(el){
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 加灰底提示并在若干时间后移除
        el.classList.add('hot-highlight');
        setTimeout(()=>{ try{ el.classList.remove('hot-highlight'); }catch(e){} }, 2600);
      }
    }, 120);
  }

  // 切换展开/收起楼中楼（第一次展开时加载）
  function toggleRepliesPanel(commentId) {
    setOpenReplies(prev => {
      const next = { ...prev, [commentId]: !prev[commentId] };
      // if opening and we don't have replies loaded, load them
      if (next[commentId] && !repliesMap[commentId]) {
        loadReplies(commentId);
      }
      return next;
    });
  }

  // 点击楼中楼的“回复”按钮：在侧栏输入框预填 @nickname 并聚焦，记录目标用户 id
  function startReplyToReply(commentId, targetUserId, targetNickname){
    // 展开该评论的楼中楼区域并打开侧栏输入框
    setOpenReplies(prev=>({ ...prev, [commentId]: true }));
    setReplyTextMap(prev => ({ ...prev, [commentId]: `@${targetNickname} ` }));
    setReplyMentionMap(prev => ({ ...prev, [commentId]: Number(targetUserId) || prev[commentId] }));
    // 聚焦 textarea（延迟让 React 渲染）
    setTimeout(()=>{
      const ta = document.querySelector(`#comment-${commentId} .reply-form-side textarea`);
      if(ta) ta.focus();
    }, 80);
  }

  // 提交楼中楼回复
  async function handleSubmitReply(e, commentId) {
    e.preventDefault();
    if (!userId) { alert('请先登录'); return; }
    const content = (replyTextMap[commentId] || '').trim();
    if (!content) { alert('请输入回复内容'); return; }
    try {
      // 若有目标用户 id，则一并传给后端（后端若不支持可忽略）
      const body = { commentId: Number(commentId), userId: Number(userId), content };
      const replyToUserId = replyMentionMap[commentId];
      if (replyToUserId) body.replyToUserId = Number(replyToUserId);
       const res = await fetch('/api/comment-reply', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
       const j = await res.json().catch(()=>null);
       if (j && j.code === 200) {
         const newReplyId = j.data && (j.data.id || j.data.replyId);
         setReplyTextMap(prev => ({ ...prev, [commentId]: '' }));
        // 提交后清除本地的 mention 映射（已发送）
        setReplyMentionMap(prev => { const n = { ...prev }; delete n[commentId]; return n; });
         // 刷新该父评论的回复列表
         await loadReplies(commentId);
         // 滚动到刚发的楼中楼（优先用后端返回 id，否则滚动到回复列表最后一项）
         setTimeout(()=>{
           if(newReplyId){
             const el = document.getElementById(`reply-${newReplyId}`);
             if(el){ el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
           }
           const last = document.querySelector(`#comment-${commentId} .reply-list .reply-item:last-child`);
           if(last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
         }, 80);
       } else {
         alert('回复失败');
       }
     } catch(e){ console.error(e); alert('网络错误'); }
   }

  // 点赞/取消点赞：父评论
  async function toggleCommentLike(commentId) {
    if (!userId) { alert('请先登录'); return; }
    try {
      const res = await fetch(`/api/comment/${commentId}/like?userId=${userId}`, { method: 'POST' });
      const j = await res.json().catch(()=>null);
      if (j && j.code===200) {
        // 刷新父评论列表
        loadComments(0,10);
      }
    } catch(e){ console.error(e); }
  }

  // 点赞/取消点赞：楼中楼回复
  async function toggleReplyLike(replyId, parentCommentId) {
    if (!userId) { alert('请先登录'); return; }
    try {
      const res = await fetch(`/api/comment-reply/${replyId}/like?userId=${userId}`, { method: 'POST' });
      const j = await res.json().catch(()=>null);
      if (j && j.code===200) {
        // 刷新该父评论的回复列表
        await loadReplies(parentCommentId);
      }
    } catch(e){ console.error(e); }
  }

  const handleSubmitComment = async (e) =>{
    e.preventDefault();
    if(!userId){ alert('请先登录'); return; }
    const body = { blogPostId: Number(id), userId: Number(userId), content: commentText };
    try{
      const res = await fetch('/api/blogpost/comment', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await res.json().catch(()=>null);
      if(j && j.code===200){
        const newCommentId = j.data && (j.data.id || j.data.commentId);
        setCommentText('');
        await loadComments();
        // 滚动到新评论（优先用后端返回 id），否则滚动到首条评论
        setTimeout(()=>{
          if(newCommentId){
            const el = document.getElementById(`comment-${newCommentId}`);
            if(el){ el.scrollIntoView({ behavior:'smooth', block:'center' }); return; }
          }
          const first = document.querySelector('.comments-list .comment-item');
          if(first) first.scrollIntoView({ behavior:'smooth', block:'center' });
        }, 80);
        return;
      }
       else alert('评论失败');
    }catch(e){ console.error(e); alert('网络错误'); }
  };

  const toggleLike = async () =>{
    if(!userId){ alert('请先登录'); return; }
    try{
      const res = await fetch(`/api/blogpost/${id}/like?userId=${userId}`, { method: 'POST' });
      const j = await res.json();
      if(j && j.code===200){
        // refresh post
        const r2 = await fetch(`/api/blogpost/${id}?currentUserId=${userId}`);
        const j2 = await r2.json(); if(j2 && j2.code===200) setPost(j2.data);
      }
    }catch(e){ console.error(e); }
  };

  useEffect(() => {
    // 页面滚动时触发导航栏收起/显示
    const handleScroll = () => {
      const current = window.scrollY || document.documentElement.scrollTop || 0;
      if (current > 50) {
        document.documentElement.classList.add('banner-is-hidden');
      } else {
        document.documentElement.classList.remove('banner-is-hidden');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // 初始化一次
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.documentElement.classList.remove('banner-is-hidden');
    };
  }, []);

  // helper: 获取当前页要显示的父评论列表（客户端分页 + 排序）
  const totalComments = (comments || []).length;
  const commentsTotalPages = Math.max(1, Math.ceil(totalComments / commentsPerPage));
  // 按选择排序：按热度（like desc, reply desc, time desc）或按时间（newest first）
  const sortedComments = (comments || []).slice().sort((a,b)=>{
    if (commentsSortMode === 'hot') {
      const la = Number(b.likeCount || 0) - Number(a.likeCount || 0);
      if (la !== 0) return la;
      const ra = Number(b.replyCount || 0) - Number(a.replyCount || 0);
      if (ra !== 0) return ra;
      // 时间靠后（更新）优先
      return new Date(b.createdAt || b.createTime).getTime() - new Date(a.createdAt || a.createTime).getTime();
    }
    // 默认按时间：新消息在上（降序）
    return new Date(b.createdAt || b.createTime).getTime() - new Date(a.createdAt || a.createTime).getTime();
  });
  const displayedComments = sortedComments.slice((commentsPage - 1) * commentsPerPage, commentsPage * commentsPerPage);
 
   function goCommentsPage(next){
     const p = Math.min(Math.max(1, next), commentsTotalPages);
     setCommentsPage(p);
     // 可按需平滑滚动到评论区顶部
     setTimeout(()=>{ const el = document.querySelector('.article-comments'); if(el) el.scrollIntoView({behavior:'smooth', block:'start'}); }, 60);
   }
   // 切换排序时重置到第一页
   function setCommentsSort(mode){
     setCommentsSortMode(mode);
     setCommentsPage(1);
   }
  
  // helper: 获取某父评论当前页要显示的楼中楼
  function getDisplayedReplies(commentId){
    const page = repliesPageMap[commentId] || 1;
    const arr = repliesMap[commentId] || [];
    const total = arr.length;
    const totalPages = Math.max(1, Math.ceil(total / repliesPerPage));
    const p = Math.min(Math.max(1, page), totalPages);
    const slice = arr.slice((p - 1) * repliesPerPage, p * repliesPerPage);
    return { slice, page: p, totalPages, total };
  }

  function goRepliesPage(commentId, next){
    const arr = repliesMap[commentId] || [];
    const totalPages = Math.max(1, Math.ceil(arr.length / repliesPerPage));
    const p = Math.min(Math.max(1, next), totalPages);
    setRepliesPageMap(prev => ({ ...prev, [commentId]: p }));
    // 使回复区可见并滚动到回复列表顶部
    setOpenReplies(prev=>({ ...prev, [commentId]: true }));
    setTimeout(()=>{ const el = document.querySelector(`#comment-${commentId} .reply-list`); if(el) el.scrollIntoView({behavior:'smooth', block:'center'}); }, 80);
  }
  
  const md = new MarkdownIt();
  if(!post) return (<div><BannerNavbar /> <div style={{padding:24}}>加载中...</div></div>);
  
  return (
    <div className="article-detail-page">
      <BannerNavbar />
      <div className="article-detail-container">
        <article className="article-main">
          {/* 封面不再在详情页显示 */}
          <h1>{post.title}</h1>
          <div className="article-meta" style={{display:'flex',alignItems:'center',gap:8}}>
            {post.authorAvatarUrl ? (
              <Link to={`/selfspace?userId=${post.authorId || post.userId || post.authorUserId || ''}`} title={post.authorNickname || '用户主页'}>
                <img src={resolveUrl(post.authorAvatarUrl)} alt="avatar" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}} />
              </Link>
            ) : null}
            <span>{post.authorNickname ? post.authorNickname : '匿名'}</span>
            <span style={{color:'#bbb',marginLeft:8}}>{new Date(post.createdAt).toLocaleString()}</span>
          </div>
          <div className="article-content" dangerouslySetInnerHTML={{__html: md.render(post.content || '')}} />

          {/* 点赞与评论放在文章正文底部 */}
          <div className="article-actions">
            <button onClick={toggleLike}>{post.likedByCurrentUser ? '取消点赞' : '点赞'} ({post.likeCount||0})</button>
          </div>

          <section className="article-comments">
            <h3>评论</h3>
            <form onSubmit={handleSubmitComment}>
              {userId ? (
                <>
                  <label htmlFor="commentText" className="comment-hint">在此发表评论（支持基本文本）</label>
                  <textarea
                    id="commentText"
                    aria-label="发表评论"
                    placeholder="写下你的想法，文明评论~"
                    value={commentText}
                    onChange={e=>setCommentText(e.target.value)}
                    required
                  />
                  <div style={{marginTop:8}}><button type="submit">评论</button></div>
                </>
              ) : (
                <div className="comment-login-prompt" style={{padding:8}}>
                  请先 <a href="/welcome">登录</a> 后发表评论。
                </div>
              )}
            </form>
            {/* 父评论排序控制 */}
            <div className="sort-controls" style={{marginTop:12, marginBottom:8, display:'flex', gap:12, alignItems:'center'}}>
              <button className={`sort-button ${commentsSortMode==='hot' ? 'active' : ''}`} onClick={()=>setCommentsSort('hot')}>按热度</button>
              <button className={`sort-button ${commentsSortMode==='time' ? 'active' : ''}`} onClick={()=>setCommentsSort('time')}>按时间</button>
            </div>
             <div className="comments-list">
               {displayedComments.map(c => (
                 <div key={c.id} id={`comment-${c.id}`} className="comment-item">
                  <div className="comment-avatar">
                    <Link to={`/selfspace?userId=${c.userId || c.authorId || c.uid || ''}`} title={c.nickname || '用户主页'}>
                      <img src={resolveUrl(c.avatarUrl)} alt="avatar" />
                    </Link>
                  </div>
                  <div className="comment-body">
                    <div className="comment-main">
                      <div className="comment-header">
                        <div className="comment-meta-top">
                          <span className="comment-author">{c.nickname}</span>
                          <span className="comment-time"> · {new Date(c.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="comment-content">{c.content}</div>

                      {/* 热门回复预览：仅在楼中楼未展开时显示（显示在该父评论与下一条父评论之间） */}
                      {!openReplies[c.id] && hotRepliesMap[c.id] && hotRepliesMap[c.id].length > 0 && (
                        <div className="hot-preview">
                          <div className="hot-preview-title">热门回复预览</div>
                          <div className="hot-preview-list">
                            {hotRepliesMap[c.id].slice(0,3).map(hr => (
                              <a
                                key={hr.id}
                                href={`#reply-${hr.id}`}
                                className="hot-item"
                                onClick={(e)=>{ e.preventDefault(); openCommentReplyAndScroll(c.id, hr.id); }}
                              >
                                 <img src={resolveUrl(hr.avatarUrl)} alt={hr.nickname} className="hot-item-avatar" />
                                 <div className="hot-item-body">
                                   <div className="hot-item-nick">{hr.nickname}</div>
                                   <div className="hot-item-snippet">{(hr.content||'').slice(0,60)}</div>
                                 </div>
                                 <div className="hot-item-meta">👍{hr.likeCount||0}</div>
                               </a>
                             ))}
                          </div>
                        </div>
                      )}

                      {/* 楼中楼区域（下方） */}
                      {openReplies[c.id] && (
                        <div className="reply-section">
                          <div className="reply-list">
                            {/* 分页后的楼中楼显示 */}
                            { getDisplayedReplies(c.id).slice.map(r => {
                               const m = (r.content || '').match(/^@([^\s]+)\s+/);
                               let mentionTargetId = r.replyToUserId || r.replyToId || null;
                               if(!mentionTargetId && m){
                                 const nick = m[1];
                                 const foundInReplies = (repliesMap[c.id] || []).find(rr => rr.nickname === nick);
                                 if(foundInReplies) mentionTargetId = foundInReplies.userId;
                                 else {
                                   const foundInComments = (comments || []).find(cm => cm.nickname === nick);
                                   if(foundInComments) mentionTargetId = foundInComments.userId;
                                 }
                               }
                               return (
                                 <div key={r.id} id={`reply-${r.id}`} className="reply-item">
                                   <div className="reply-avatar">
                                     <Link to={`/selfspace?userId=${r.userId || r.authorId || r.uid || ''}`} title={r.nickname || '用户主页'}>
                                       <img src={resolveUrl(r.avatarUrl)} alt="avatar" />
                                     </Link>
                                   </div>
                                   <div className="reply-body">
                                     <div className="reply-header">
                                       <div className="reply-meta-top">{r.nickname} · {new Date(r.createdAt).toLocaleString()}</div>
                                       <div className="reply-actions-below">
                                         <button className="comment-action-btn" onClick={() => toggleReplyLike(r.id, c.id)}>
                                           {(r.likedByCurrentUser || r.liked) ? '取消点赞' : '点赞'} ({r.likeCount||0})
                                         </button>
                                         <button className="comment-action-btn" onClick={() => startReplyToReply(c.id, r.userId, r.nickname)} style={{marginLeft:6}}>
                                           回复
                                         </button>
                                       </div>
                                     </div>
                                     {m ? (
                                       <div className="reply-content">
                                         {mentionTargetId ? (
                                           <Link to={`/selfspace?userId=${mentionTargetId}`} className="mention-link">@{m[1]}</Link>
                                         ) : (
                                           <span className="mention-link">@{m[1]}</span>
                                         )}
                                         <span> {r.content.slice(m[0].length)}</span>
                                       </div>
                                     ) : (
                                       <div className="reply-content">{r.content}</div>
                                     )}
                                   </div>
                                 </div>
                               );
                             })}
                             { (!repliesMap[c.id] || repliesMap[c.id].length === 0) && <div className="reply-empty">暂无回复</div> }
                             {/* 楼中楼分页控件（若多页才显示） */}
                            { (repliesMap[c.id] || []).length > repliesPerPage && (() => {
                              const rp = getDisplayedReplies(c.id);
                              return (
                                <div className="replies-pager pager">
                                  <button className="pager-button" onClick={() => goRepliesPage(c.id, rp.page - 1)} disabled={rp.page <= 1}>上一页</button>
                                  <span className="pager-current">第 {rp.page} 页</span>
                                  <button className="pager-button" onClick={() => goRepliesPage(c.id, rp.page + 1)} disabled={rp.page >= rp.totalPages}>下一页</button>
                                </div>
                              );
                            })() }
                           </div>
                         </div>
                       )}
                    </div>
                    {/* 右侧放置回复输入框（当展开并且登录时显示） */}
                    <div className="comment-side">
                      <div className="comment-actions-below">
                        <button className="comment-action-btn" onClick={() => toggleCommentLike(c.id)}>
                          {(c.likedByCurrentUser || c.liked) ? '取消点赞' : '点赞'} ({c.likeCount||0})
                        </button>
                        <button className="comment-action-btn" onClick={() => toggleRepliesPanel(c.id)}>
                          {openReplies[c.id] ? '收起' : '回复'} ({ (c.replyCount != null ? c.replyCount : (repliesMap[c.id]||[]).length) || 0 })
                        </button>
                      </div>
                      {userId && openReplies[c.id] && (
                        <form className="reply-form-side" onSubmit={(e)=>handleSubmitReply(e, c.id)}>
                          <textarea
                            placeholder="回复…"
                            value={replyTextMap[c.id] || ''}
                            onChange={e => setReplyTextMap(prev => ({ ...prev, [c.id]: e.target.value }))}
                            required
                          />
                          <div><button type="submit">回复</button></div>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {/* 父评论分页控件（若多页才显示） */}
              { totalComments > commentsPerPage && (
                <div className="comments-pager pager" style={{marginTop:12}}>
                  <button className="pager-button" onClick={() => goCommentsPage(commentsPage - 1)} disabled={commentsPage <= 1}>上一页</button>
                  <span className="pager-current">第 {commentsPage} 页</span>
                  <button className="pager-button" onClick={() => goCommentsPage(commentsPage + 1)} disabled={commentsPage >= commentsTotalPages}>下一页</button>
                </div>
              )}
             </div>
           </section>
         </article>
       </div>
     </div>
   );
 }
