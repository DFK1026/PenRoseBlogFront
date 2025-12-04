import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/common/ArticleCard.css';
import resolveUrl from '../../utils/resolveUrl';

function truncateByUnits(text = '', limitUnits = 48) {
  let units = 0;
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const isAscii = code <= 0x007f;
    const add = isAscii ? 1 : 2;
    if (units + add > limitUnits) break;
    units += add;
    out += ch;
  }
  return out;
}

export default function ArticleCard({ post, className }) {
  const navigate = useNavigate();
  const handleClick = () => navigate(`/post/${post.id}`);
  const [views, setViews] = useState(null);

  const coverSrc = resolveUrl(post.coverImageUrl) || null;
  const avatar = post.authorAvatarUrl || post.avatarUrl;
  const author = post.authorNickname || post.authorName || post.author || post.username || '匿名';
  const created = post.createdAt || post.created || post.createTime;
  const likeCount = post.likeCount || post.likes || 0;
  const commentCount = post.commentCount || post.comments || 0;
  const id = post.id || post.postId;

  // 加载当前文章的浏览量
  useEffect(() => {
    let mounted = true;
    if (!id) { setViews(0); return; }
    fetch(`/api/blogview/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!mounted) return;
        if (j && j.code === 200 && j.data) setViews(Number(j.data.viewCount || 0));
        else setViews(0);
      })
      .catch(() => { if (mounted) setViews(0); });

    const onUpdate = (e) => {
      try {
        const d = e?.detail || {};
        if (String(d.blogPostId) === String(id) && d.viewCount != null) {
          setViews(Number(d.viewCount));
        }
      } catch {}
    };
    window.addEventListener('blogview-updated', onUpdate);
    return () => { mounted = false; window.removeEventListener('blogview-updated', onUpdate); };
  }, [id]);

  const rawContent = post.content || post.summary || '';
  const preview = truncateByUnits(
    // 去除简单 Markdown 标记后再截断
    String(rawContent).replace(/[#>*`~\-!\[\]\(\)]/g, ' ').replace(/\s+/g, ' ').trim(),
    48
  );

  const card = (
    <div className={['home-article-card', className].filter(Boolean).join(' ')}>
      <div className="home-article-content">
        <div className="home-article-title">{post.title}</div>
        <div className="home-article-preview">{preview}</div>
        <div className="home-article-footer">
          {avatar && <img src={avatar} alt="avatar" className="home-article-author-avatar" />}
          <span>{author}</span>
          {created && <span style={{ color:'#9aa3b2' }}>{new Date(created).toLocaleDateString()}</span>}
          {/* 阅读量展示：位于点赞评论左侧 */}
          <span className="home-article-views" title="阅读量">👁️ {views !== null ? views : '—'}</span>
          <div className="home-article-meta">👍 {likeCount}　💬 {commentCount}</div>
        </div>
      </div>
      {coverSrc ? <img src={coverSrc} alt="cover" className="home-article-cover" /> : <div />}
    </div>
  );

  // 修复整卡点击可进入文章详情
  return (
    <Link to={`/post/${post.id || post.postId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      {card}
    </Link>
  );
}
