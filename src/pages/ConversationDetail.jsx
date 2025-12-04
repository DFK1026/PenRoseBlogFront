import React, {
    useEffect,
    useState,
    useRef,
    useLayoutEffect,
    useCallback,
    useMemo
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BannerNavbar from '../components/common/BannerNavbar';
import '../styles/message/ConversationDetail.css';

// 本地缓存服务
import {
    preloadConversationMessages,
    cacheConversationMessages,
    cacheConversationSummaries,
    loadCachedConversationSummaries
} from '../utils/localPmCacheService';

export default function ConversationDetail() {
    const { otherId } = useParams();
    const navigate = useNavigate();

    // 核心状态
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [otherInfo, setOtherInfo] = useState({ nickname: '', avatarUrl: '' });
    const [conversations, setConversations] = useState([]); // 左侧会话摘要列表
    const userId = localStorage.getItem('userId');

    // 分页
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // 滚动
    const rightScrollRef = useRef(null);
    const leftScrollRef = useRef(null);
    const userScrollingUpRef = useRef(false);
    const autoScrollEnabledRef = useRef(true);
    const previousScrollHeightRef = useRef(0);

    const isNearBottom = (el, thresh = 40) => {
        if (!el) return true;
        return el.scrollHeight - el.scrollTop - el.clientHeight <= thresh;
    };

    // 上传
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const imageInputRef = useRef(null);
    const videoInputRef = useRef(null);

    // 撤回相关
    const recalledLocalRef = useRef(new Set());
    const normId = (id) => String(id);

    // 会话视图（包含撤回/已删）
    const [viewRecords, setViewRecords] = useState([]);

    // 右键菜单
    const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, msg: null });

    // 输入框高度
    const [inputHeight, setInputHeight] = useState(() => {
        const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
        return Math.max(56, Math.round(vh * 0.15));
    });
    const inputRef = useRef(null);

    // 新消息提示
    const [newTip, setNewTip] = useState({ visible: false, count: 0 });
    const lastSeenMaxTimeRef = useRef(0);
    const seenIdsRef = useRef(new Set());

    /** ---------------- 工具方法 ---------------- */

    const mergeMessages = (oldList, newList) => {
        if ((!oldList || oldList.length === 0) && (!newList || newList.length === 0)) return [];
        const mergedArr = [];
        const seen = new Map();
        const keyOf = (m) => {
            if (!m) return null;
            if (m.id != null) return `id:${m.id}`;
            const time = m.createdAt ? String(m.createdAt) : '';
            const s = m.senderId != null ? String(m.senderId) : '';
            const r = m.receiverId != null ? String(m.receiverId) : '';
            const t = m.text != null ? String(m.text) : '';
            return `c:${time}|s:${s}|r:${r}|t:${t}`;
        };

        const pushIfNew = (m) => {
            const k = keyOf(m);
            if (!k) return;
            if (!seen.has(k)) {
                seen.set(k, true);
                mergedArr.push(m);
            }
        };

        (oldList || []).forEach(pushIfNew);
        (newList || []).forEach(pushIfNew);

        mergedArr.sort((a, b) => {
            const ta = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return ta - tb;
        });

        return mergedArr;
    };

    const markReadCurrent = useCallback(() => {
        if (!userId || !otherId) return;
        fetch(`/api/messages/conversation/${otherId}/read`, {
            method: 'POST',
            headers: { 'X-User-Id': userId }
        })
            .then(() => {
                setConversations(prev =>
                    (prev || []).map(x =>
                        String(x.otherId) === String(otherId) ? { ...x, unreadCount: 0 } : x
                    )
                );
                try {
                    window.dispatchEvent(new Event('pm-unread-refresh'));
                } catch (err) {
                    // ignore
                    console.warn('pm-unread-refresh dispatch failed', err);
                }
            })
            .catch((err) => {
                console.warn('markReadCurrent failed', err);
            });
    }, [userId, otherId]);

    /** ---------------- 分页获取消息（带本地缓存） ---------------- */

    const fetchMessages = async (pageNum) => {
        if (!userId || !otherId) return;
        try {
            if (pageNum > 0) setIsLoadingHistory(true);

            const res = await fetch(
                `/api/messages/conversation/${otherId}?page=${pageNum}&size=20`,
                {
                    headers: { 'X-User-Id': userId }
                }
            );
            const j = await res.json();

            if (j && j.code === 200 && j.data) {
                const newMsgs = j.data.list || [];

                // 永远在现有 messages 基础上“补齐”，不再有覆盖逻辑
                setMessages(prev => {
                    const existingIds = new Set((prev || []).map(m => m.id));
                    const filteredNew = (newMsgs || []).filter(m => !existingIds.has(m.id));
                    // 服务器分页是“越大 page 越早的历史消息”，所以老消息应该加在前面
                    const merged = [...filteredNew, ...(prev || [])];
                    return merged.sort((a, b) => {
                        const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return ta - tb;
                    });
                });

                // 写入 IndexedDB 缓存（最多 1000 条）
                cacheConversationMessages(userId, otherId, newMsgs, 1000)
                    .then(() => {
                        // 方便你在 F12 里看到缓存写入情况
                        console.log(
                            '[PM] cacheConversationMessages written page',
                            pageNum,
                            'count=',
                            newMsgs.length
                        );
                    })
                    .catch(() => {});

                if (newMsgs.length < 20) {
                    setHasMore(false);
                }
            }
        } catch (e) {
            console.error('Fetch messages failed', e);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    /** ---------------- 视图刷新 ---------------- */

    const refreshView = useCallback(() => {
        if (!userId || !otherId) return;
        fetch(`/api/messages/conversation/view/${otherId}?page=0&size=500`, {
            headers: { 'X-User-Id': userId }
        })
            .then(r => r.json())
            .then(j => {
                if (j && j.code === 200 && j.data && Array.isArray(j.data.records || j.data.list)) {
                    const list = j.data.records || j.data.list;
                    const withLocal = list.map(r =>
                        recalledLocalRef.current.has(normId(r.id))
                            ? { ...r, recalled: true }
                            : r
                    );
                    setViewRecords(withLocal);
                }
            })
            .catch((err) => {
                console.warn('refreshView failed', err);
            });
    }, [userId, otherId]);

    /** ---------------- 初始与切换会话：先用本地缓存填充 ---------------- */

    useEffect(() => {
        if (!userId || !otherId) return;

        let cancelled = false;

        (async () => {
            // 1. 先从 IndexedDB 预加载最近 N 条消息
            const cached = await preloadConversationMessages(userId, otherId, 1000);
            if (cancelled) return;

            console.log(
                '[PM] preloadConversationMessages from IndexedDB:',
                cached.length,
                'records'
            );

            if (cached && cached.length > 0) {
                setMessages(cached);
            } else {
                setMessages([]); // 确保状态清空
            }

            // 2. 再从服务器拉取 page=0，作为“增量补充”，不再覆盖本地缓存
            setPage(0);
            setHasMore(true);
            fetchMessages(0);

            // 3. 标记当前会话为已读
            markReadCurrent();
        })();

        return () => {
            cancelled = true;
        };
    }, [userId, otherId, markReadCurrent]);

    useEffect(() => {
        markReadCurrent();
    }, [markReadCurrent]);

    /** ---------------- 左侧会话摘要：先本地、再远端 ---------------- */

    useEffect(() => {
        if (!userId) return;

        (async () => {
            const localList = await loadCachedConversationSummaries();
            if (localList && localList.length > 0) {
                setConversations(
                    localList.map(c => ({
                        otherId: c.otherId,
                        nickname: c.nickname,
                        avatarUrl: c.avatarUrl,
                        lastMessage: c.lastMessage,
                        lastAt: c.lastAt,
                        unreadCount: c.unreadCount || 0
                    }))
                );
            }
        })();

        const loadList = async () => {
            try {
                const r = await fetch('/api/messages/conversation/list', {
                    headers: { 'X-User-Id': userId }
                });
                const j = await r.json();
                if (j && j.code === 200 && j.data && Array.isArray(j.data.list)) {
                    let list = j.data.list;

                    const exists = list.some(x => String(x.otherId) === String(otherId));
                    if (!exists && otherId) {
                        let profileNick = '';
                        let profileAvatar = '';
                        try {
                            const pr = await fetch(`/api/user/profile/${otherId}`);
                            const pj = await pr.json();
                            if (pj && pj.code === 200 && pj.data) {
                                profileNick = pj.data.nickname || '';
                                profileAvatar = pj.data.avatarUrl || '';
                            }
                        } catch (err) {
                            console.warn('load profile failed', err);
                        }

                        list = [
                            {
                                otherId: Number(otherId),
                                nickname: profileNick || otherInfo?.nickname || '',
                                avatarUrl: profileAvatar || otherInfo?.avatarUrl || '',
                                lastMessage: '',
                                lastAt: null,
                                unreadCount: 0
                            },
                            ...list
                        ];
                    }

                    list = await Promise.all(
                        list.map(async x => {
                            if (!x || String(x.otherId) !== String(otherId)) return x;
                            if (x.nickname && x.avatarUrl) return x;
                            try {
                                const pr = await fetch(`/api/user/profile/${x.otherId}`);
                                const pj = await pr.json();
                                if (pj && pj.code === 200 && pj.data) {
                                    return {
                                        ...x,
                                        nickname: x.nickname || pj.data.nickname || '',
                                        avatarUrl: x.avatarUrl || pj.data.avatarUrl || ''
                                    };
                                }
                            } catch (err) {
                                console.warn('补充 profile 失败', err);
                            }
                            return {
                                ...x,
                                nickname: x.nickname || otherInfo?.nickname || '',
                                avatarUrl: x.avatarUrl || otherInfo?.avatarUrl || ''
                            };
                        })
                    );

                    setConversations(list);
                    cacheConversationSummaries(userId, list).catch(() => {});
                }
            } catch (err) {
                console.warn('load conversation list failed', err);
            }
        };

        loadList();
    }, [userId, otherId, otherInfo]);

    // 视图加载
    useEffect(() => {
        refreshView();
    }, [refreshView]);

    /** ---------------- 视图与消息合成 finalMessages ---------------- */

    const messagesById = useMemo(() => {
        const map = new Map();
        (messages || []).forEach(m => {
            if (m && m.id != null) map.set(m.id, m);
        });
        return map;
    }, [messages]);

    const finalMessages = useMemo(() => {
        return (viewRecords || []).map(v => {
            const m = v?.id != null ? messagesById.get(v.id) : null;
            const merged = m
                ? { ...m }
                : {
                    id: v.id,
                    senderId: v.senderId,
                    receiverId: v.receiverId,
                    createdAt: v.createdAt,
                    text: v.displayText || '',
                    type: null,
                    mediaUrl: null,
                    senderNickname: (m && m.senderNickname) || '',
                    receiverNickname: (m && m.receiverNickname) || '',
                    senderAvatarUrl: (m && m.senderAvatarUrl) || '',
                    receiverAvatarUrl: (m && m.receiverAvatarUrl) || ''
                };
            const recalledFlag =
                v.recalled === true || v.recalled === 1 || v.recalled === 'true';
            merged.__recalled = recalledFlag;
            merged.__displayText = v.displayText || '';
            if (merged.__recalled) {
                if (m && m.text) merged.__originalText = m.text;
            }
            return merged;
        });
    }, [viewRecords, messagesById]);

    /** ---------------- 通过消息推断对方信息 ---------------- */

    useEffect(() => {
        if (!finalMessages || finalMessages.length === 0) return;
        for (let m of finalMessages) {
            if (m.senderId !== Number(userId)) {
                setOtherInfo({
                    nickname: m.senderNickname || '',
                    avatarUrl: m.senderAvatarUrl || ''
                });
                return;
            }
            if (m.receiverId !== Number(userId)) {
                setOtherInfo({
                    nickname: m.receiverNickname || '',
                    avatarUrl: m.receiverAvatarUrl || ''
                });
                return;
            }
        }
    }, [finalMessages, userId]);

    /** ---------------- 滚动监听/自动滚动/分页加载 ---------------- */

    useEffect(() => {
        const el = rightScrollRef.current;
        if (!el) return;
        const onScroll = () => {
            const near = isNearBottom(el);
            userScrollingUpRef.current = !near;
            autoScrollEnabledRef.current = near;
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        autoScrollEnabledRef.current = isNearBottom(el);
        userScrollingUpRef.current = !autoScrollEnabledRef.current;
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    const handleScroll = (e) => {
        const el = e.target;

        const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
        autoScrollEnabledRef.current = isBottom;

        if (el.scrollTop === 0 && hasMore && !isLoadingHistory && messages.length > 0) {
            previousScrollHeightRef.current = el.scrollHeight;
            const nextPage = page + 1;
            setPage(nextPage);
            fetchMessages(nextPage);
        }
    };

    useLayoutEffect(() => {
        const el = rightScrollRef.current;
        if (!el) return;

        if (isLoadingHistory === false && previousScrollHeightRef.current > 0) {
            const heightDiff = el.scrollHeight - previousScrollHeightRef.current;
            el.scrollTop = heightDiff;
            previousScrollHeightRef.current = 0;
        } else {
            if (autoScrollEnabledRef.current) {
                el.scrollTop = el.scrollHeight;
            }
        }
    }, [messages, isLoadingHistory]);

    useEffect(() => {
        const el = rightScrollRef.current;
        if (!el) return;
        if (autoScrollEnabledRef.current || isNearBottom(el)) {
            el.scrollTop = el.scrollHeight;
        }
        const imgs = Array.from(
            el.querySelectorAll('img.conversation-detail-msgmedia')
        );
        const vids = Array.from(
            el.querySelectorAll('video.conversation-detail-msgmedia')
        );
        const onLoaded = () => {
            if (autoScrollEnabledRef.current || isNearBottom(el)) {
                el.scrollTop = el.scrollHeight;
            }
        };
        imgs.forEach(img => {
            img.addEventListener('load', onLoaded);
        });
        vids.forEach(v => {
            v.addEventListener('loadedmetadata', onLoaded);
            v.addEventListener('loadeddata', onLoaded);
        });
        return () => {
            imgs.forEach(img => {
                img.removeEventListener('load', onLoaded);
            });
            vids.forEach(v => {
                v.removeEventListener('loadedmetadata', onLoaded);
                v.removeEventListener('loadeddata', onLoaded);
            });
        };
    }, [finalMessages]);

    useEffect(() => {
        const el = rightScrollRef.current;
        if (!el) return;
        const raf = requestAnimationFrame(() => {
            autoScrollEnabledRef.current = true;
            el.scrollTop = el.scrollHeight;
        });
        return () => cancelAnimationFrame(raf);
    }, [otherId]);

    useEffect(() => {
        const el = rightScrollRef.current;
        if (!el) return;

        const near = isNearBottom(el);
        const currentIds = new Set(
            (viewRecords || [])
                .map(r => r?.id)
                .filter(id => id != null)
        );

        if (autoScrollEnabledRef.current || near) {
            requestAnimationFrame(() => {
                el.scrollTop = el.scrollHeight;
            });
            seenIdsRef.current = currentIds;
            const maxTime = (viewRecords || []).reduce((acc, r) => {
                const t = r?.createdAt ? new Date(r.createdAt).getTime() : 0;
                return t > acc ? t : acc;
            }, 0);
            lastSeenMaxTimeRef.current = maxTime;
            setNewTip({ visible: false, count: 0 });
        } else {
            const seen = seenIdsRef.current || new Set();
            let inc = 0;
            currentIds.forEach(id => {
                if (!seen.has(id)) inc += 1;
            });
            if (inc > 0) {
                setNewTip({ visible: true, count: inc });
            }
        }
    }, [viewRecords]);

    /** ---------------- 发送文本消息（成功后写缓存） ---------------- */

    const handleSend = async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const body = { text };
        const res = await fetch(`/api/messages/text/${otherId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userId
            },
            body: JSON.stringify(body)
        });
        setText('');
        try {
            const j = await res.json();
            if (j && j.code === 200 && j.data) {
                const msg = j.data;
                setMessages(prev => mergeMessages(prev, [msg]));
                cacheConversationMessages(userId, otherId, [msg], 1000)
                    .then(() => console.log('[PM] cache after send text, id=', msg.id))
                    .catch(() => {});
            }
        } catch (err) {
            console.warn('parse send text response failed', err);
        }
        autoScrollEnabledRef.current = true;
        refreshView();
    };

    const onInputKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const fakeEvent = { preventDefault: () => {} };
            handleSend(fakeEvent);
        }
    };

    /** ---------------- 带进度上传 & 发送媒体 ---------------- */

    const uploadFile = (file) => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const form = new FormData();
            form.append('file', file);
            xhr.open('POST', '/api/messages/upload');
            if (userId) xhr.setRequestHeader('X-User-Id', userId);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const p = Math.round((e.loaded / e.total) * 100);
                    setUploadProgress(p);
                }
            };
            xhr.onload = () => {
                try {
                    const res = JSON.parse(xhr.responseText || '{}');
                    if (res && res.code === 200 && res.data) {
                        resolve(res.data);
                    } else {
                        reject(new Error(res?.message || '上传失败'));
                    }
                } catch (err) {
                    reject(new Error('上传响应解析失败'));
                }
            };
            xhr.onerror = () => reject(new Error('网络错误，上传失败'));
            xhr.send(form);
        });
    };

    const handleFileChosen = async (e, type) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);
        try {
            const url = await uploadFile(file);

            const body = { type, mediaUrl: url, text: '' };
            const res = await fetch(`/api/messages/media/${otherId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
                body: JSON.stringify(body)
            });

            const j = await res.json().catch(() => null);
            if (j && j.code === 200 && j.data) {
                const dto = j.data;

                setMessages(prev => {
                    const next = Array.isArray(prev) ? prev.slice() : [];
                    next.push({
                        id: dto.id,
                        senderId: dto.senderId,
                        receiverId: dto.receiverId,
                        text: dto.text || '',
                        mediaUrl: dto.mediaUrl || '',
                        type: dto.type || type,
                        createdAt: dto.createdAt,
                        senderNickname: dto.senderNickname || '你',
                        senderAvatarUrl: dto.senderAvatarUrl || (otherInfo?.avatarUrl || ''),
                        receiverNickname: dto.receiverNickname || otherInfo?.nickname || '',
                        receiverAvatarUrl: dto.receiverAvatarUrl || (otherInfo?.avatarUrl || '')
                    });
                    next.sort((a, b) => {
                        const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return ta - tb;
                    });
                    return next;
                });

                setViewRecords(prev => {
                    const next = Array.isArray(prev) ? prev.slice() : [];
                    next.push({
                        id: dto.id,
                        senderId: dto.senderId,
                        receiverId: dto.receiverId,
                        createdAt: dto.createdAt,
                        recalled: false,
                        displayText: dto.text || ''
                    });
                    next.sort((a, b) => {
                        const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return ta - tb;
                    });
                    return next;
                });

                cacheConversationMessages(userId, otherId, [dto], 1000)
                    .then(() => console.log('[PM] cache after send media, id=', dto.id))
                    .catch(() => {});

                requestAnimationFrame(() => {
                    const el = rightScrollRef.current;
                    if (el) el.scrollTop = el.scrollHeight;
                });
            } else {
                alert((j && (j.message || j.msg)) || '发送失败');
            }
        } catch (err) {
            console.error(err);
            alert('上传或发送失败');
        } finally {
            setUploading(false);
            setUploadProgress(0);
            refreshView();
        }
    };

    const onPickImageClick = () =>
        imageInputRef.current && imageInputRef.current.click();
    const onPickVideoClick = () =>
        videoInputRef.current && videoInputRef.current.click();

    /** ---------------- 撤回/删除/右键菜单 ---------------- */

    const reEditMessage = (msg) => {
        if (!msg || !msg.__originalText) return;
        setText(msg.__originalText);
        requestAnimationFrame(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const len = inputRef.current.value.length;
                try {
                    inputRef.current.setSelectionRange(len, len);
                } catch (err) {
                    console.warn('setSelectionRange failed', err);
                }
            }
        });
    };

    const openContextMenu = (e, msg) => {
        e.preventDefault();
        setMenu({ visible: true, x: e.clientX, y: e.clientY, msg });
    };

    const closeContextMenu = () =>
        setMenu(m => ({ ...m, visible: false, msg: null }));

    useEffect(() => {
        const onDocClick = () => closeContextMenu();
        const onEsc = (ev) => {
            if (ev.key === 'Escape') closeContextMenu();
        };
        const onScrollAny = () => closeContextMenu();
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onEsc);
        document.addEventListener('scroll', onScrollAny, true);
        window.addEventListener('resize', onScrollAny);
        return () => {
            document.removeEventListener('click', onDocClick);
            document.removeEventListener('keydown', onEsc);
            document.removeEventListener('scroll', onScrollAny, true);
            window.removeEventListener('resize', onScrollAny);
        };
    }, []);

    const recallMessage = async (messageId) => {
        closeContextMenu();
        if (!messageId) return;
        try {
            const res = await fetch('/api/messages/recall', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId
                },
                body: JSON.stringify({ messageId })
            });
            const j = await res.json().catch(() => null);
            if (j && (j.code === 200 || j.status === 200)) {
                recalledLocalRef.current.add(normId(messageId));
                setViewRecords(prev =>
                    prev.map(r =>
                        r && normId(r.id) === normId(messageId)
                            ? { ...r, recalled: true }
                            : r
                    )
                );
                refreshView();
            } else {
                alert((j && (j.msg || j.message)) || '撤回失败');
            }
        } catch (err) {
            console.error(err);
            alert('网络错误');
        }
    };

    const deleteMessage = async (messageId) => {
        closeContextMenu();
        if (!messageId) return;
        try {
            const res = await fetch('/api/messages/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId
                },
                body: JSON.stringify({ messageId })
            });
            const j = await res.json().catch(() => null);
            if (j && (j.code === 200 || j.status === 200)) {
                setViewRecords(prev => prev.filter(r => r && r.id !== messageId));
                refreshView();
            } else {
                alert((j && (j.msg || j.message)) || '删除失败');
            }
        } catch (err) {
            console.error(err);
            alert('网络错误');
        }
    };

    /** ---------------- 头像 / 会话跳转 ---------------- */

    const gotoConversation = (id) => {
        if (!id || String(id) === String(otherId)) return;
        navigate(`/conversation/${id}`);
    };

    const openProfile = (uid) => {
        if (!uid) return;
        navigate(`/selfspace?userId=${uid}`);
    };

    /** ---------------- URL 处理 ---------------- */

    const toAbsUrl = (u) => {
        if (!u) return '';
        if (/^https?:\/\//i.test(u)) return u;
        const isFiles = u.startsWith('/files/');
        if (isFiles) {
            const loc = window.location;
            const backendOrigin = `${loc.protocol}//${loc.hostname}:8080`;
            return backendOrigin + u;
        }
        try {
            return new URL(u, window.location.origin).toString();
        } catch (err) {
            console.warn('toAbsUrl failed', err);
            return u;
        }
    };

    /** ---------------- 输入框高度拖拽 ---------------- */

    const startResize = (e) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = inputHeight;
        const anchorMessagesBottom = () => {
            const el = rightScrollRef.current;
            if (!el) return;
            requestAnimationFrame(() => {
                el.scrollTop = el.scrollHeight - el.clientHeight;
            });
        };
        const onMove = (mv) => {
            const delta = startY - mv.clientY;
            const newHeight = Math.min(240, Math.max(56, startHeight + delta));
            if (newHeight !== inputHeight) {
                setInputHeight(newHeight);
                anchorMessagesBottom();
            }
        };
        const onUp = () => {
            anchorMessagesBottom();
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    /** ---------------- SSE/轮询 & 全局事件 ---------------- */

    useEffect(() => {
        if (!otherId || !userId) return;
        let es = null;
        let pollTimer = null;
        const subscribeUrl = `/api/messages/subscribe/${otherId}?userId=${encodeURIComponent(
            userId
        )}&_=${Date.now()}`;
        try {
            es = new EventSource(subscribeUrl);
        } catch (err) {
            console.warn('EventSource init failed, fallback to polling', err);
            es = null;
        }

        const onAny = () => {
            refreshView();
            try {
                window.dispatchEvent(new Event('pm-unread-refresh'));
            } catch (err) {
                console.warn('pm-unread-refresh dispatch failed', err);
            }
        };

        if (es) {
            es.addEventListener('init', onAny);
            es.addEventListener('update', onAny);
            es.onerror = () => {
                if (es) {
                    try {
                        es.close();
                    } catch (err) {
                        console.warn('EventSource close failed', err);
                    }
                    es = null;
                }
                pollTimer = setInterval(() => {
                    refreshView();
                }, 3000);
            };
        } else {
            pollTimer = setInterval(() => {
                refreshView();
            }, 3000);
        }

        refreshView();

        return () => {
            if (es) {
                try {
                    es.removeEventListener('init', onAny);
                    es.removeEventListener('update', onAny);
                    es.close();
                } catch (err) {
                    console.warn('EventSource cleanup failed', err);
                }
            }
            if (pollTimer) clearInterval(pollTimer);
        };
    }, [otherId, userId, refreshView]);

    useEffect(() => {
        if (!userId) return;

        const onPm = (ev) => {
            const data = ev?.detail || {};
            const me = Number(userId);
            const partnerId = String(
                me === Number(data.receiverId) ? data.senderId : data.receiverId
            );

            fetch('/api/messages/conversation/list', {
                headers: { 'X-User-Id': userId }
            })
                .then(r => r.json())
                .then(j => {
                    if (j && j.code === 200 && j.data?.list) {
                        setConversations(j.data.list);
                        cacheConversationSummaries(userId, j.data.list).catch(() => {});
                    }
                })
                .catch((err) => {
                    console.warn('pm-event load list failed', err);
                });

            if (String(partnerId) === String(otherId)) {
                refreshView();
                fetch(`/api/messages/conversation/${otherId}`, {
                    headers: { 'X-User-Id': userId }
                })
                    .then(r => r.json())
                    .then(j => {
                        if (j && j.code === 200 && j.data?.list) {
                            setMessages(prev => {
                                const merged = mergeMessages(prev, j.data.list);
                                return merged;
                            });
                            cacheConversationMessages(userId, otherId, j.data.list, 1000).catch(
                                () => {}
                            );
                        }
                    })
                    .catch((err) => {
                        console.warn('pm-event load messages failed', err);
                    });
                markReadCurrent();
            }
        };

        window.addEventListener('pm-event', onPm);
        return () => window.removeEventListener('pm-event', onPm);
    }, [userId, otherId, refreshView, markReadCurrent]);

    /** ---------------- “新消息”按钮 ---------------- */

    const jumpToLatest = () => {
        const el = rightScrollRef.current;
        if (!el) return;
        autoScrollEnabledRef.current = true;
        el.scrollTop = el.scrollHeight;
        seenIdsRef.current = new Set(
            (viewRecords || [])
                .map(r => r?.id)
                .filter(id => id != null)
        );
        const maxTime = (viewRecords || []).reduce((acc, r) => {
            const t = r?.createdAt ? new Date(r.createdAt).getTime() : 0;
            return t > acc ? t : acc;
        }, 0);
        lastSeenMaxTimeRef.current = maxTime;
        setNewTip({ visible: false, count: 0 });
    };

    /** ---------------- 渲染 ---------------- */

    return (
        <div className="conversation-detail-page">
            <BannerNavbar />
            <div
                className="conversation-detail-container two-columns"
                style={{ '--input-height': `${inputHeight}px` }}
            >
                {/* 左侧会话列表 */}
                <aside
                    className="conversation-sidebar"
                    ref={leftScrollRef}
                    aria-label="会话列表"
                >
                    {conversations.map(c => (
                        <button
                            key={c.otherId}
                            className={`conversation-sidebar-item${String(c.otherId) ===
                            String(otherId)
                                ? ' active'
                                : ''}`}
                            title={c.nickname || ''}
                            onClick={() => gotoConversation(c.otherId)}
                        >
                            <img
                                src={c.avatarUrl || '/imgs/loginandwelcomepanel/1.png'}
                                alt="avatar"
                                className="conversation-sidebar-avatar"
                                onError={(ev) => {
                                    const target = ev.target;
                                    target.onerror = null;
                                    target.src = '/imgs/loginandwelcomepanel/1.png';
                                }}
                            />
                            <span className="conversation-sidebar-name">
                                {c.nickname || `用户${c.otherId}`}
                            </span>
                            {c.unreadCount > 0 && (
                                <span
                                    className="conversation-sidebar-badge"
                                    title={`未读 ${c.unreadCount}`}
                                >
                                    {c.unreadCount > 99 ? '99+' : c.unreadCount}
                                </span>
                            )}
                        </button>
                    ))}
                </aside>

                {/* 右侧消息区 */}
                <div
                    className="conversation-detail-list"
                    ref={rightScrollRef}
                    onScroll={handleScroll}
                    style={{ '--input-height': inputHeight + 'px' }}
                >
                    {isLoadingHistory && (
                        <div
                            style={{
                                textAlign: 'center',
                                padding: '10px',
                                color: '#999'
                            }}
                        >
                            加载历史消息...
                        </div>
                    )}

                    {finalMessages.map(msg => {
                        const isSelf = msg.senderId === Number(userId);
                        const recalled = !!msg.__recalled;

                        if (recalled) {
                            return (
                                <div className="conversation-detail-recall" key={msg.id}>
                                    <span className="txt">
                                        {isSelf ? '你撤回了一条消息' : '对方撤回了一条消息'}
                                    </span>
                                    {isSelf && msg.__originalText && (
                                        <button
                                            type="button"
                                            className="reedit"
                                            onClick={() => reEditMessage(msg)}
                                            title="重新编辑并发送"
                                        >
                                            重新编辑
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="recall-close"
                                        onClick={() => deleteMessage(msg.id)}
                                        title="删除这条记录"
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={msg.id}
                                className={`conversation-detail-msg${isSelf ? ' self' : ''}`}
                                onContextMenu={(e) => openContextMenu(e, msg)}
                                title="右键可撤回/删除"
                            >
                                <div className="conversation-detail-msg-meta">
                                    <img
                                        src={
                                            msg.senderAvatarUrl ||
                                            otherInfo.avatarUrl ||
                                            '/imgs/loginandwelcomepanel/1.png'
                                        }
                                        alt="avatar"
                                        className={`conversation-detail-msg-avatar${
                                            !isSelf ? ' clickable' : ''
                                        }`}
                                        title={!isSelf ? '查看主页' : undefined}
                                        onClick={!isSelf ? () => openProfile(msg.senderId) : undefined}
                                        onError={(ev) => {
                                            const target = ev.target;
                                            target.onerror = null;
                                            target.src = '/imgs/loginandwelcomepanel/1.png';
                                        }}
                                    />
                                    <span className="conversation-detail-msg-nickname">
                                        {msg.senderNickname || (isSelf ? '你' : otherInfo.nickname)}
                                    </span>
                                </div>

                                <div className="conversation-detail-msgtext">
                                    {msg?.type === 'IMAGE' && msg?.mediaUrl ? (
                                        <img
                                            className="conversation-detail-msgmedia"
                                            src={toAbsUrl(msg.mediaUrl)}
                                            alt="image"
                                            onError={(ev) => {
                                                const target = ev.target;
                                                target.onerror = null;
                                                target.src = '';
                                            }}
                                        />
                                    ) : msg?.type === 'VIDEO' && msg?.mediaUrl ? (
                                        <video
                                            className="conversation-detail-msgmedia"
                                            src={toAbsUrl(msg.mediaUrl)}
                                            controls
                                        />
                                    ) : (
                                        msg?.text ||
                                        (msg?.type === 'IMAGE'
                                            ? '[图片]'
                                            : msg?.type === 'VIDEO'
                                                ? '[视频]'
                                                : '')
                                    )}
                                </div>

                                <div className="conversation-detail-msgtime">
                                    {msg.createdAt
                                        ? new Date(msg.createdAt).toLocaleString()
                                        : ''}
                                </div>
                            </div>
                        );
                    })}

                    {/* 右下角“新消息”提示按钮 */}
                    {newTip.visible && newTip.count > 0 && (
                        <button
                            type="button"
                            className="conversation-detail-sendbtn"
                            style={{
                                position: 'sticky',
                                float: 'right',
                                bottom: '12px',
                                right: '12px',
                                marginTop: '12px',
                                zIndex: 10
                            }}
                            onClick={jumpToLatest}
                            title="回到底部查看最新消息"
                        >
                            {newTip.count} 条新消息
                        </button>
                    )}
                </div>

                {/* 输入框与发送 */}
                <form
                    className="conversation-detail-form"
                    onSubmit={handleSend}
                    style={{ '--input-height': inputHeight + 'px' }}
                >
                    <div className="conversation-inputbox">
                        <div
                            className="conversation-inputbox-resize"
                            title="拖动上边界可加长输入框"
                            onMouseDown={startResize}
                        ></div>

                        <button
                            type="button"
                            className="icon-btn icon-image"
                            onClick={onPickImageClick}
                            title="发送图片"
                            disabled={uploading}
                        ></button>
                        <button
                            type="button"
                            className="icon-btn icon-video"
                            onClick={onPickVideoClick}
                            title="发送视频"
                            disabled={uploading}
                        ></button>

                        <textarea
                            ref={inputRef}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={onInputKeyDown}
                            placeholder="请输入消息内容..."
                            className="conversation-detail-input"
                            disabled={uploading}
                        />
                    </div>
                    <button
                        type="submit"
                        className="conversation-detail-sendbtn"
                        disabled={uploading}
                    >
                        发送
                    </button>

                    {/* 隐藏文件输入框 */}
                    <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileChosen(e, 'IMAGE')}
                    />
                    <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileChosen(e, 'VIDEO')}
                    />
                </form>

                {/* 上传进度条 */}
                {uploading && (
                    <div
                        className="conversation-detail-uploadprogress"
                        aria-live="polite"
                    >
                        <div
                            className="bar"
                            style={{ width: `${uploadProgress}%` }}
                        />
                        <span className="pct">{uploadProgress}%</span>
                    </div>
                )}
            </div>

            {/* 右键菜单 */}
            {menu.visible && menu.msg && (
                <div
                    className="msg-context-menu"
                    style={{ left: menu.x, top: menu.y }}
                >
                    {menu.msg.senderId === Number(userId) &&
                        !menu.msg.__recalled &&
                        Number.isFinite(new Date(menu.msg.createdAt).getTime()) &&
                        Date.now() - new Date(menu.msg.createdAt).getTime() <=
                        2 * 60 * 1000 && (
                            <button onClick={() => recallMessage(menu.msg.id)}>撤回</button>
                        )}
                    <button onClick={() => deleteMessage(menu.msg.id)}>删除</button>
                </div>
            )}
        </div>
    );
}