import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MarkdownIt from 'markdown-it';
import { useParams } from 'react-router-dom';
import BannerNavbar from '../components/common/BannerNavbar';
import '../styles/article/ArticleDetail.css';
import resolveUrl from '../utils/resolveUrl';

export default function ArticleDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
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

    // NEW: 转发相关状态
    const [shareUrl, setShareUrl] = useState('');
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [copying, setCopying] = useState(false);

    // NEW: 选择好友转发弹窗
    const [showForwardFriends, setShowForwardFriends] = useState(false);
    const [friends, setFriends] = useState([]);
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [friendsError, setFriendsError] = useState(null);

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;

    const buildHeaders = () => {
        const h = {};
        if (token) h['Authorization'] = `Bearer ${token}`;
        if (userId) h['X-User-Id'] = userId;
        return h;
    };

    // ---------------- 加载文章 & 记录浏览 ----------------
    useEffect(() => {
        fetch(`/api/blogpost/${id}${userId ? `?currentUserId=${userId}` : ''}`)
            .then(r => r.json()).then(async j => {
            console.log('[文章详情] 后端返回数据:', j);
            if (j && j.code === 200) {
                setPost(j.data);

                // 记录一次浏览
                try {
                    const SHORT_WINDOW_MS = 1000;
                    const key = `view_record_${id}`;
                    const now = Date.now();
                    const last = Number(sessionStorage.getItem(key) || 0);
                    if (last && (now - last) < SHORT_WINDOW_MS) {
                        console.debug('[浏览] 短时内已记录，跳过重复记录', id);
                    } else if (!recordedRef.current) {
                        recordedRef.current = true;
                        sessionStorage.setItem(key, String(now));
                        const payload = { blogPostId: Number(id) };
                        if (userId) payload.userId = Number(userId);
                        const rec = await fetch('/api/blogview/record', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        const jr = await rec.json().catch(() => null);
                        if (jr && jr.code === 200 && jr.data) {
                            const vc = Number(jr.data.viewCount || 0);
                            setPost(prev => prev ? ({ ...prev, viewCount: vc }) : prev);
                            try {
                                window.dispatchEvent(new CustomEvent('blogview-updated', {
                                    detail: { blogPostId: String(id), viewCount: vc }
                                }));
                            } catch { }
                        }
                        setTimeout(() => { recordedRef.current = false; }, 800);
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
        // load comments
        loadComments();
    }, [id, userId]);

    // ---------------- 评论相关（原有代码，未删） ----------------
    async function loadComments(page, size) {
        const params = new URLSearchParams();
        if (userId) params.set('currentUserId', userId);
        params.set('size', '10000');
        const url = `/api/comment/list/${id}?${params.toString()}`;
        try {
            const res = await fetch(url);
            const j = await res.json().catch(() => null);
            if (j && j.code === 200) {
                const list = Array.isArray(j.data)
                    ? j.data
                    : (Array.isArray(j) ? j : (j.data && Array.isArray(j.data.list) ? j.data.list : []));
                setComments(list || []);

                // 省略：楼中楼统计和热门回复预览计算（保留原逻辑）...
                try {
                    const ids = (list || []).map(c => c.id).filter(Boolean);
                    if (ids.length) {
                        const promises = ids.map(cid => {
                            const params = new URLSearchParams();
                            params.set('size', '10000');
                            if (userId) params.set('currentUserId', userId);
                            const url = `/api/comment-reply/list/${cid}?${params.toString()}`;
                            return fetch(url).then(r => r.ok ? r.json().catch(() => null) : null).catch(() => null);
                        });
                        const results = await Promise.all(promises);
                        const countMap = new Map();
                        const hotMap = {};
                        results.forEach((res, idx) => {
                            const cid = ids[idx];
                            if (res && res.code === 200) {
                                let arr = [];
                                if (Array.isArray(res.data)) arr = res.data;
                                else if (res.data && Array.isArray(res.data.list)) arr = res.data.list;
                                else if (res.data && Array.isArray(res.data.data)) arr = res.data.data;
                                if (Array.isArray(arr)) countMap.set(String(cid), arr.length);
                                else if (res.data && typeof res.data.total === 'number') countMap.set(String(cid), res.data.total);

                                try {
                                    const parent = (list || []).find(c => String(c.id) === String(cid)) || {};
                                    const parentLike = Number(parent.likeCount || 0);
                                    if (parentLike >= 2) {
                                        const threshold = Math.floor(parentLike / 2);
                                        const normalized = (arr || []).map(r => ({
                                            ...(r || {}),
                                            likeCount: Number(r.likeCount || r.likes || 0),
                                            createdAt: r.createdAt || r.createTime
                                        }));
                                        const hot = (normalized || [])
                                            .filter(rr => Number(rr.likeCount || 0) >= threshold)
                                            .sort((a, b) => {
                                                const la = Number(b.likeCount || 0) - Number(a.likeCount || 0);
                                                if (la !== 0) return la;
                                                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                                            })
                                            .slice(0, 3);
                                        if (hot && hot.length) hotMap[String(cid)] = hot;
                                    }
                                } catch (e) { }
                            }
                        });
                        if (countMap.size) {
                            setComments(prev => (prev || []).map(cm => {
                                const v = countMap.get(String(cm.id));
                                if (typeof v === 'number') return { ...cm, replyCount: v };
                                return cm;
                            }));
                        }
                        if (Object.keys(hotMap).length) {
                            setHotRepliesMap(prev => ({ ...prev, ...hotMap }));
                        }
                    }
                } catch (e) {
                    console.warn('[loadComments] 获取回复统计失败', e);
                }
                return list || [];
            }
            return [];
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    async function loadReplies(commentId) {
        if (!commentId) return;
        try {
            const params = new URLSearchParams();
            params.set('size', '10000');
            if (userId) params.set('currentUserId', userId);
            const res = await fetch(`/api/comment-reply/list/${commentId}?${params.toString()}`);
            const j = await res.json().catch(() => null);
            if (j && j.code === 200) {
                let arr = [];
                let total = null;
                if (Array.isArray(j.data)) { arr = j.data; }
                else if (j.data && Array.isArray(j.data.list)) { arr = j.data.list; total = (typeof j.data.total === 'number' ? j.data.total : arr.length); }
                else if (j.data && Array.isArray(j.data.data)) { arr = j.data.data; }
                const normalized = (arr || []).map(r => ({
                    ...(r || {}),
                    likedByCurrentUser: Boolean(r && (r.likedByCurrentUser || r.liked)),
                    replyCount: r.replyCount || 0
                }));
                const list = (normalized || []).slice().sort((a, b) =>
                    new Date(a.createdAt || a.createTime).getTime() - new Date(b.createdAt || b.createTime).getTime()
                );
                setRepliesMap(prev => ({ ...prev, [commentId]: list }));

                try {
                    const parent = (comments || []).find(cm => String(cm.id) === String(commentId)) || {};
                    const parentLike = Number(parent.likeCount || 0);
                    if (parentLike >= 2) {
                        const threshold = Math.floor(parentLike / 2);
                        const normalized2 = (list || []).map(r => ({
                            ...(r || {}),
                            likeCount: Number(r.likeCount || r.likes || 0),
                            createdAt: r.createdAt || r.createTime
                        }));
                        const hot = (normalized2 || [])
                            .filter(rr => Number(rr.likeCount || 0) >= threshold)
                            .sort((a, b) => {
                                const la = Number(b.likeCount || 0) - Number(a.likeCount || 0);
                                if (la !== 0) return la;
                                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                            })
                            .slice(0, 3);
                        if (hot && hot.length) {
                            setHotRepliesMap(prev => ({ ...prev, [commentId]: hot }));
                        } else {
                            setHotRepliesMap(prev => { const n = { ...prev }; delete n[commentId]; return n; });
                        }
                    } else {
                        setHotRepliesMap(prev => { const n = { ...prev }; delete n[commentId]; return n; });
                    }
                } catch (e) {
                    console.warn('[loadReplies] compute hot replies failed', e);
                }

                setComments(prev => prev.map(cm => {
                    if (String(cm.id) === String(commentId)) {
                        return { ...cm, replyCount: (typeof total === 'number' ? total : (list.length || 0)) };
                    }
                    return cm;
                }));

                return list;
            }
        } catch (e) { console.error('[loadReplies]', e); }
        return [];
    }

    async function openCommentReplyAndScroll(commentId, replyId) {
        try {
            let list = repliesMap[commentId];
            if (!Array.isArray(list) || list.length === 0) {
                list = await loadReplies(commentId) || [];
            }
            const idx = (list || []).findIndex(r => String(r.id) === String(replyId));
            const pageForReply = (idx >= 0) ? (Math.floor(idx / repliesPerPage) + 1) : 1;
            setRepliesPageMap(prev => ({ ...prev, [commentId]: pageForReply }));
            setOpenReplies(prev => ({ ...prev, [commentId]: true }));

            try { document.querySelectorAll('.hot-highlight').forEach(el => el.classList.remove('hot-highlight')); } catch (e) { }

            setTimeout(() => {
                const el = document.getElementById(`reply-${replyId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('hot-highlight');
                    setTimeout(() => { try { el.classList.remove('hot-highlight'); } catch (e) { } }, 2600);
                } else {
                    setTimeout(() => {
                        const el2 = document.getElementById(`reply-${replyId}`);
                        if (el2) {
                            el2.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el2.classList.add('hot-highlight');
                            setTimeout(() => { try { el2.classList.remove('hot-highlight'); } catch (e) { } }, 2600);
                        }
                    }, 180);
                }
            }, 120);
        } catch (e) {
            console.error('[openCommentReplyAndScroll] error', e);
            setOpenReplies(prev => ({ ...prev, [commentId]: true }));
            setTimeout(() => {
                const el = document.getElementById(`reply-${replyId}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
        }
    }

    function toggleRepliesPanel(commentId) {
        setOpenReplies(prev => {
            const next = { ...prev, [commentId]: !prev[commentId] };
            if (next[commentId] && !repliesMap[commentId]) {
                loadReplies(commentId);
            }
            return next;
        });
    }

    function startReplyToReply(commentId, targetUserId, targetNickname) {
        setOpenReplies(prev => ({ ...prev, [commentId]: true }));
        setReplyTextMap(prev => ({ ...prev, [commentId]: `@${targetNickname} ` }));
        setReplyMentionMap(prev => ({ ...prev, [commentId]: Number(targetUserId) || prev[commentId] }));
        setTimeout(() => {
            const ta = document.querySelector(`#comment-${commentId} .reply-form-side textarea`);
            if (ta) ta.focus();
        }, 80);
    }

    async function handleSubmitReply(e, commentId) {
        e.preventDefault();
        if (!userId) { alert('请先登录'); return; }
        const content = (replyTextMap[commentId] || '').trim();
        if (!content) { alert('请输入回复内容'); return; }
        try {
            const body = { commentId: Number(commentId), userId: Number(userId), content };
            const replyToUserId = replyMentionMap[commentId];
            if (replyToUserId) body.replyToUserId = Number(replyToUserId);
            const res = await fetch('/api/comment-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const j = await res.json().catch(() => null);
            if (j && j.code === 200) {
                const newReplyId = j.data && (j.data.id || j.data.replyId);
                setReplyTextMap(prev => ({ ...prev, [commentId]: '' }));
                setReplyMentionMap(prev => { const n = { ...prev }; delete n[commentId]; return n; });

                const list = await loadReplies(commentId) || repliesMap[commentId] || [];
                let idx = -1;
                if (newReplyId) {
                    idx = (list || []).findIndex(r => String(r.id) === String(newReplyId));
                }
                if (idx < 0) {
                    idx = Math.max(0, (list || []).length - 1);
                }
                const pageForNew = Math.max(1, Math.ceil((idx + 1) / repliesPerPage));
                setRepliesPageMap(prev => ({ ...prev, [commentId]: pageForNew }));
                setOpenReplies(prev => ({ ...prev, [commentId]: true }));

                setTimeout(() => {
                    const targetId = newReplyId || (list && list[idx] && list[idx].id);
                    if (targetId) {
                        const el = document.getElementById(`reply-${targetId}`);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('hot-highlight');
                            setTimeout(() => { try { el.classList.remove('hot-highlight'); } catch (e) { } }, 2600);
                            return;
                        }
                    }
                    const last = document.querySelector(`#comment-${commentId} .reply-list .reply-item:last-child`);
                    if (last) {
                        last.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        last.classList.add('hot-highlight');
                        setTimeout(() => { try { last.classList.remove('hot-highlight'); } catch (e) { } }, 2600);
                    }
                }, 120);
            } else {
                alert('回复失败');
            }
        } catch (e) { console.error(e); alert('网络错误'); }
    }

    async function toggleCommentLike(commentId) {
        if (!userId) { alert('请先登录'); return; }
        try {
            const res = await fetch(`/api/comment/${commentId}/like?userId=${userId}`, { method: 'POST' });
            const j = await res.json().catch(() => null);
            if (j && j.code === 200) {
                loadComments(0, 10);
            }
        } catch (e) { console.error(e); }
    }

    async function toggleReplyLike(replyId, parentCommentId) {
        if (!userId) { alert('请先登录'); return; }
        try {
            const res = await fetch(`/api/comment-reply/${replyId}/like?userId=${userId}`, { method: 'POST' });
            const j = await res.json().catch(() => null);
            if (j && j.code === 200) {
                await loadReplies(parentCommentId);
            }
        } catch (e) { console.error(e); }
    }

    const handleSubmitComment = async (e) => {
        e.preventDefault();
        if (!userId) { alert('请先登录'); return; }
        const body = { blogPostId: Number(id), userId: Number(userId), content: commentText };
        try {
            const res = await fetch('/api/blogpost/comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const j = await res.json().catch(() => null);
            if (j && j.code === 200) {
                const newCommentId = j.data && (j.data.id || j.data.commentId);
                setCommentText('');
                try { setCommentsSort('time'); } catch (e) { setCommentsSortMode('time'); setCommentsPage(1); }
                await loadComments();
                setTimeout(() => {
                    if (newCommentId) {
                        const el = document.getElementById(`comment-${newCommentId}`);
                        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
                    }
                    const first = document.querySelector('.comments-list .comment-item');
                    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 80);
                return;
            }
            else alert('评论失败');
        } catch (e) { console.error(e); alert('网络错误'); }
    };

    const toggleLike = async () => {
        if (!userId) { alert('请先登录'); return; }
        try {
            const res = await fetch(`/api/blogpost/${id}/like?userId=${userId}`, { method: 'POST' });
            const j = await res.json();
            if (j && j.code === 200) {
                const r2 = await fetch(`/api/blogpost/${id}?currentUserId=${userId}`);
                const j2 = await r2.json(); if (j2 && j2.code === 200) setPost(j2.data);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        const handleScroll = () => {
            const current = window.scrollY || document.documentElement.scrollTop || 0;
            if (current > 50) {
                document.documentElement.classList.add('banner-is-hidden');
            } else {
                document.documentElement.classList.remove('banner-is-hidden');
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => {
            window.removeEventListener('scroll', handleScroll);
            document.documentElement.classList.remove('banner-is-hidden');
        };
    }, []);

    const totalComments = (comments || []).length;
    const commentsTotalPages = Math.max(1, Math.ceil(totalComments / commentsPerPage));
    const sortedComments = (comments || []).slice().sort((a, b) => {
        if (commentsSortMode === 'hot') {
            const la = Number(b.likeCount || 0) - Number(a.likeCount || 0);
            if (la !== 0) return la;
            const ra = Number(b.replyCount || 0) - Number(a.replyCount || 0);
            if (ra !== 0) return ra;
            return new Date(b.createdAt || b.createTime).getTime() - new Date(a.createdAt || a.createTime).getTime();
        }
        return new Date(b.createdAt || b.createTime).getTime() - new Date(a.createdAt || a.createTime).getTime();
    });
    const displayedComments = sortedComments.slice((commentsPage - 1) * commentsPerPage, commentsPage * commentsPerPage);

    function goCommentsPage(next) {
        const p = Math.min(Math.max(1, next), commentsTotalPages);
        setCommentsPage(p);
        setTimeout(() => {
            const el = document.querySelector('.article-comments');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
    }
    function setCommentsSort(mode) {
        setCommentsSortMode(mode);
        setCommentsPage(1);
    }

    function getDisplayedReplies(commentId) {
        const page = repliesPageMap[commentId] || 1;
        const arr = repliesMap[commentId] || [];
        const total = arr.length;
        const totalPages = Math.max(1, Math.ceil(total / repliesPerPage));
        const p = Math.min(Math.max(1, page), totalPages);
        const slice = arr.slice((p - 1) * repliesPerPage, p * repliesPerPage);
        return { slice, page: p, totalPages, total };
    }

    function goRepliesPage(commentId, next) {
        const arr = repliesMap[commentId] || [];
        const totalPages = Math.max(1, Math.ceil(arr.length / repliesPerPage));
        const p = Math.min(Math.max(1, next), totalPages);
        setRepliesPageMap(prev => ({ ...prev, [commentId]: p }));
        setOpenReplies(prev => ({ ...prev, [commentId]: true }));
        setTimeout(() => {
            const el = document.querySelector(`#comment-${commentId} .reply-list`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
    }

    const md = new MarkdownIt();
    if (!post) return (<div><BannerNavbar /> <div style={{ padding: 24 }}>加载中...</div></div>);

    // ---------------- 转发相关前端逻辑 ----------------

    // 从后端获取当前文章用于“私信预览”的分享 URL
    const ensureShareUrl = async () => {
        if (shareUrl) return shareUrl;
        try {
            const res = await fetch(`/api/blogpost/${id}/share-url`);
            const j = await res.json().catch(() => null);
            if (j && j.code === 200 && j.data) {
                setShareUrl(j.data);
                return j.data;
            }
        } catch (e) {
            console.error('[获取分享链接失败]', e);
        }
        // 若后端接口不可用，退化为当前浏览器地址
        const fallback = window.location.href;
        setShareUrl(fallback);
        return fallback;
    };

    const handleShareClick = async () => {
        const url = await ensureShareUrl();
        if (!url) {
            alert('暂时无法获取文章链接');
            return;
        }
        setShowShareMenu(v => !v);
    };

    // 复制给用户的文章浏览地址
    const getCopyableUrl = () => {
        try {
            const origin = window.location.origin;
            return `${origin}/post/${id}`;
        } catch {
            return window.location.href;
        }
    };

    const handleCopyLink = async () => {
        const url = getCopyableUrl();
        if (!url) {
            alert('暂时无法获取文章链接');
            return;
        }
        setCopying(true);
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
                alert('链接已复制到剪贴板');
            } else {
                const ok = window.prompt('复制以下链接:', url);
                if (!ok && ok !== null) {
                    // 用户取消无提示
                }
            }
        } catch (e) {
            console.error('复制失败', e);
            const ok = window.prompt('复制以下链接:', url);
            if (!ok && ok !== null) { }
        } finally {
            setCopying(false);
            setShowShareMenu(false);
        }
    };

    // 打开好友列表弹窗
    const openForwardFriendsDialog = async () => {
        if (!userId) {
            alert('请先登录后再转发到私信');
            return;
        }
        setFriendsLoading(true);
        setFriendsError(null);
        setShowForwardFriends(true);
        try {
            const res = await fetch('/api/friends/list', { headers: buildHeaders() });
            const j = await res.json().catch(() => null);
            if (j && j.code === 200) {
                setFriends(j.data?.list || j.data || []);
            } else {
                setFriendsError((j && (j.message || j.msg)) || '获取好友列表失败');
            }
        } catch (e) {
            console.error('[获取好友列表失败]', e);
            setFriendsError('网络错误');
        } finally {
            setFriendsLoading(false);
        }
    };

    // 选择一个好友后，跳转到该好友的会话，并带上 text=shareUrl
    const handleChooseFriendToForward = async (targetUserId) => {
        if (!targetUserId) return;
        const url = await ensureShareUrl();
        if (!url) {
            alert('暂时无法获取文章链接');
            return;
        }
        setShowForwardFriends(false);
        setShowShareMenu(false);
        // 携带 ?text= 链接跳转到会话页，ConversationDetail 会自动填入和自动发送
        navigate(`/conversation/${targetUserId}?text=${encodeURIComponent(url)}`);
    };

    return (
        <div className="article-detail-page">
            <BannerNavbar />
            <div className="article-detail-container">
                <article className="article-main">
                    {/* 封面不再在详情页显示 */}
                    <h1>{post.title}</h1>
                    <div className="article-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {post.authorAvatarUrl ? (
                            <Link
                                to={`/selfspace?userId=${post.authorId || post.userId || post.authorUserId || ''}`}
                                title={post.authorNickname || '用户主页'}
                            >
                                <img
                                    src={resolveUrl(post.authorAvatarUrl)}
                                    alt="avatar"
                                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                                />
                            </Link>
                        ) : null}
                        <span>{post.authorNickname ? post.authorNickname : '匿名'}</span>
                        <span style={{ color: '#bbb', marginLeft: 8 }}>
              {new Date(post.createdAt).toLocaleString()}
            </span>
                    </div>
                    <div
                        className="article-content"
                        dangerouslySetInnerHTML={{ __html: md.render(post.content || '') }}
                    />

                    {/* 点赞 / 转发 放在文章正文底部 */}
                    <div className="article-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={toggleLike}>
                            {post.likedByCurrentUser ? '取消点赞' : '点赞'} ({post.likeCount || 0})
                        </button>

                        {/* 转发按钮 */}
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button type="button" onClick={handleShareClick}>
                                转发
                            </button>
                            {showShareMenu && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '110%',
                                        left: 0,
                                        zIndex: 1000,
                                        background: '#fff',
                                        border: '1px solid #ddd',
                                        borderRadius: 4,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                        padding: 8,
                                        minWidth: 160
                                    }}
                                >
                                    <button
                                        type="button"
                                        style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
                                        onClick={openForwardFriendsDialog}
                                    >
                                        转发到私信
                                    </button>
                                    <button
                                        type="button"
                                        style={{ display: 'block', width: '100%', textAlign: 'left' }}
                                        disabled={copying}
                                        onClick={handleCopyLink}
                                    >
                                        {copying ? '复制中…' : '复制链接'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 评论区域保留原实现 */}
                    <section className="article-comments">
                        <h3>评论</h3>
                        <form onSubmit={handleSubmitComment}>
                            {userId ? (
                                <>
                                    <label htmlFor="commentText" className="comment-hint">
                                        在此发表评论（支持基本文本）
                                    </label>
                                    <textarea
                                        id="commentText"
                                        aria-label="发表评论"
                                        placeholder="写下你的想法，文明评论~"
                                        value={commentText}
                                        onChange={e => setCommentText(e.target.value)}
                                        required
                                    />
                                    <div style={{ marginTop: 8 }}>
                                        <button type="submit">评论</button>
                                    </div>
                                </>
                            ) : (
                                <div className="comment-login-prompt" style={{ padding: 8 }}>
                                    请先 <a href="/welcome">登录</a> 后发表评论。
                                </div>
                            )}
                        </form>
                        {/* 排序 & 列表 & 分页：保留原逻辑 */}
                        <div
                            className="sort-controls"
                            style={{ marginTop: 12, marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}
                        >
                            <button
                                className={`sort-button ${commentsSortMode === 'hot' ? 'active' : ''}`}
                                onClick={() => setCommentsSort('hot')}
                            >
                                按热度
                            </button>
                            <button
                                className={`sort-button ${commentsSortMode === 'time' ? 'active' : ''}`}
                                onClick={() => setCommentsSort('time')}
                            >
                                按时间
                            </button>
                        </div>
                        <div className="comments-list">
                            {displayedComments.map(c => (
                                <div key={c.id} id={`comment-${c.id}`} className="comment-item">
                                    <div className="comment-avatar">
                                        <Link
                                            to={`/selfspace?userId=${c.userId || c.authorId || c.uid || ''}`}
                                            title={c.nickname || '用户主页'}
                                        >
                                            <img src={resolveUrl(c.avatarUrl)} alt="avatar" />
                                        </Link>
                                    </div>
                                    <div className="comment-body">
                                        <div className="comment-main">
                                            <div className="comment-header">
                                                <div className="comment-meta-top">
                                                    <span className="comment-author">{c.nickname}</span>
                                                    <span className="comment-time">
                            {' '}
                                                        · {new Date(c.createdAt).toLocaleString()}
                          </span>
                                                </div>
                                            </div>
                                            <div className="comment-content">{c.content}</div>

                                            {/* 热门回复预览 */}
                                            {!openReplies[c.id] && hotRepliesMap[c.id] && hotRepliesMap[c.id].length > 0 && (
                                                <div className="hot-preview">
                                                    <div className="hot-preview-title">热门回复预览</div>
                                                    <div className="hot-preview-list">
                                                        {hotRepliesMap[c.id].slice(0, 3).map(hr => (
                                                            <a
                                                                key={hr.id}
                                                                href={`#reply-${hr.id}`}
                                                                className="hot-item"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    openCommentReplyAndScroll(c.id, hr.id);
                                                                }}
                                                            >
                                                                <img
                                                                    src={resolveUrl(hr.avatarUrl)}
                                                                    alt={hr.nickname}
                                                                    className="hot-item-avatar"
                                                                />
                                                                <div className="hot-item-body">
                                                                    <div className="hot-item-nick">{hr.nickname}</div>
                                                                    <div className="hot-item-snippet">
                                                                        {(hr.content || '').slice(0, 60)}
                                                                    </div>
                                                                </div>
                                                                <div className="hot-item-meta">👍{hr.likeCount || 0}</div>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* 楼中楼 */}
                                            {openReplies[c.id] && (
                                                <div className="reply-section">
                                                    <div className="reply-list">
                                                        {getDisplayedReplies(c.id).slice.map(r => {
                                                            const m = (r.content || '').match(/^@([^\s]+)\s+/);
                                                            let mentionTargetId = r.replyToUserId || r.replyToId || null;
                                                            if (!mentionTargetId && m) {
                                                                const nick = m[1];
                                                                const foundInReplies = (repliesMap[c.id] || []).find(rr => rr.nickname === nick);
                                                                if (foundInReplies) mentionTargetId = foundInReplies.userId;
                                                                else {
                                                                    const foundInComments = (comments || []).find(cm => cm.nickname === nick);
                                                                    if (foundInComments) mentionTargetId = foundInComments.userId;
                                                                }
                                                            }
                                                            return (
                                                                <div key={r.id} id={`reply-${r.id}`} className="reply-item">
                                                                    <div className="reply-avatar">
                                                                        <Link
                                                                            to={`/selfspace?userId={r.userId || r.authorId || r.uid || ''}`}
                                                                            title={r.nickname || '用户主页'}
                                                                        >
                                                                            <img src={resolveUrl(r.avatarUrl)} alt="avatar" />
                                                                        </Link>
                                                                    </div>
                                                                    <div className="reply-body">
                                                                        <div className="reply-header">
                                                                            <div className="reply-meta-top">
                                                                                {r.nickname} · {new Date(r.createdAt).toLocaleString()}
                                                                            </div>
                                                                            <div className="reply-actions-below">
                                                                                <button
                                                                                    className="comment-action-btn"
                                                                                    onClick={() => toggleReplyLike(r.id, c.id)}
                                                                                >
                                                                                    {(r.likedByCurrentUser || r.liked)
                                                                                        ? '取消点赞'
                                                                                        : '点赞'} ({r.likeCount || 0})
                                                                                </button>
                                                                                <button
                                                                                    className="comment-action-btn"
                                                                                    onClick={() =>
                                                                                        startReplyToReply(c.id, r.userId, r.nickname)
                                                                                    }
                                                                                    style={{ marginLeft: 6 }}
                                                                                >
                                                                                    回复
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        {m ? (
                                                                            <div className="reply-content">
                                                                                {mentionTargetId ? (
                                                                                    <Link
                                                                                        to={`/selfspace?userId=${mentionTargetId}`}
                                                                                        className="mention-link"
                                                                                    >
                                                                                        @{m[1]}
                                                                                    </Link>
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
                                                        {(!repliesMap[c.id] || repliesMap[c.id].length === 0) && (
                                                            <div className="reply-empty">暂无回复</div>
                                                        )}
                                                        {(repliesMap[c.id] || []).length > repliesPerPage && (() => {
                                                            const rp = getDisplayedReplies(c.id);
                                                            return (
                                                                <div className="replies-pager pager">
                                                                    <button
                                                                        className="pager-button"
                                                                        onClick={() => goRepliesPage(c.id, rp.page - 1)}
                                                                        disabled={rp.page <= 1}
                                                                    >
                                                                        上一页
                                                                    </button>
                                                                    <span className="pager-current">第 {rp.page} 页</span>
                                                                    <button
                                                                        className="pager-button"
                                                                        onClick={() => goRepliesPage(c.id, rp.page + 1)}
                                                                        disabled={rp.page >= rp.totalPages}
                                                                    >
                                                                        下一页
                                                                    </button>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="comment-side">
                                            <div className="comment-actions-below">
                                                <button
                                                    className="comment-action-btn"
                                                    onClick={() => toggleCommentLike(c.id)}
                                                >
                                                    {(c.likedByCurrentUser || c.liked) ? '取消点赞' : '点赞'} ({c.likeCount || 0})
                                                </button>
                                                <button
                                                    className="comment-action-btn"
                                                    onClick={() => toggleRepliesPanel(c.id)}
                                                >
                                                    {openReplies[c.id] ? '收起' : '回复'} (
                                                    {(c.replyCount != null
                                                        ? c.replyCount
                                                        : (repliesMap[c.id] || []).length) || 0}
                                                    )
                                                </button>
                                            </div>
                                            {userId && openReplies[c.id] && (
                                                <form
                                                    className="reply-form-side"
                                                    onSubmit={(e) => handleSubmitReply(e, c.id)}
                                                >
                          <textarea
                              placeholder="回复…"
                              value={replyTextMap[c.id] || ''}
                              onChange={e =>
                                  setReplyTextMap(prev => ({ ...prev, [c.id]: e.target.value }))
                              }
                              required
                          />
                                                    <div>
                                                        <button type="submit">回复</button>
                                                    </div>
                                                </form>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {totalComments > commentsPerPage && (
                                <div className="comments-pager pager" style={{ marginTop: 12 }}>
                                    <button
                                        className="pager-button"
                                        onClick={() => goCommentsPage(commentsPage - 1)}
                                        disabled={commentsPage <= 1}
                                    >
                                        上一页
                                    </button>
                                    <span className="pager-current">第 {commentsPage} 页</span>
                                    <button
                                        className="pager-button"
                                        onClick={() => goCommentsPage(commentsPage + 1)}
                                        disabled={commentsPage >= commentsTotalPages}
                                    >
                                        下一页
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                </article>
            </div>

            {/* 好友列表弹窗，用于选择转发对象 */}
            {showForwardFriends && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.4)',
                        zIndex: 1500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onClick={() => setShowForwardFriends(false)}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 8,
                            padding: 16,
                            maxHeight: '80vh',
                            width: '420px',
                            overflow: 'auto'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ marginTop: 0, marginBottom: 12 }}>选择好友转发</h3>
                        {friendsLoading && <div>加载好友列表中...</div>}
                        {friendsError && <div style={{ color: 'red' }}>{friendsError}</div>}
                        {!friendsLoading && !friendsError && friends.length === 0 && (
                            <div>暂无好友可转发</div>
                        )}
                        {!friendsLoading && !friendsError && friends.length > 0 && (
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                {friends.map(f => (
                                    <li
                                        key={f.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '6px 0',
                                            borderBottom: '1px solid #f2f2f2',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => handleChooseFriendToForward(f.id)}
                                    >
                                        <img
                                            src={f.avatarUrl || '/imgs/loginandwelcomepanel/1.png'}
                                            alt="avatar"
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                marginRight: 8
                                            }}
                                            onError={e => {
                                                e.target.onerror = null;
                                                e.target.src = '/imgs/loginandwelcomepanel/1.png';
                                            }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 500 }}>{f.nickname || f.username}</div>
                                            {f.bio && (
                                                <div style={{ fontSize: 12, color: '#777' }}>{f.bio}</div>
                                            )}
                                        </div>
                                        <button type="button">选择</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div style={{ textAlign: 'right', marginTop: 12 }}>
                            <button type="button" onClick={() => setShowForwardFriends(false)}>
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}