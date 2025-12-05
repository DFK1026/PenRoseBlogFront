import React, { useEffect, useRef, useState } from 'react';
import '../styles/message/MessageList.css';
import BannerNavbar from '../components/common/BannerNavbar';
import resolveUrl from '../utils/resolveUrl';
import {
    preloadNotifications,
    cacheNotifications,
} from '../utils/localNotificationCacheService';
import { ensureCommentPreview } from '../utils/commentPreviewService';

/**
 * 通知中心（/friends/pending）
 *
 * 行为：
 * - 首次挂载：preloadNotifications(userId) 从 IndexedDB 读最近 N 条通知；
 * - 然后拉 /api/friends/pending，同步当前好友请求（映射为通知）并写入缓存；
 * - 可以建立本页专用 SSE，用于实时更新当前视图；
 *
 * 紧密配合 globalNotificationSubscriber.js：
 * - 全局模块负责通用的“收到通知就写缓存”（包括评论预览）；
 * - 本页面只负责：读缓存 + 一次性补拉好友请求 + 实时展示。
 */

function buildKeyFromNotification(n) {
    if (!n) return '';
    const t = n.type || 'UNKNOWN';
    const rid = n.requestId ?? n.referenceId ?? '0';
    const ts = n.createdAt || '';
    return `${t}#${rid}#${ts}`;
}

function mapFriendRequestDTOToNotification(fr) {
    if (!fr) return null;
    return {
        type: 'FRIEND_REQUEST',
        requestId: fr.id,
        senderId: fr.senderId,
        receiverId: fr.receiverId,
        message: fr.message || '新的好友申请',
        status: fr.status,
        createdAt: fr.createdAt || null,
        _friendRequestId: fr.id,
        _senderNickname: fr.senderNickname || fr.senderUsername || '',
        _senderAvatarUrl: fr.senderAvatarUrl || '',
    };
}

function formatTitle(item) {
    switch (item.type) {
        case 'FRIEND_REQUEST':
            return '新的好友申请';
        case 'FRIEND_REQUEST_RESPONSE':
            return item.status === 'ACCEPTED' ? '好友申请已通过' : '好友申请被拒绝';
        case 'POST_LIKE':
            return '文章获得点赞';
        case 'COMMENT_REPLY':
            return '评论收到回复';
        case 'COMMENT_LIKE':
            return '评论获得点赞';
        case 'REPLY_LIKE':
            return '回复获得点赞';
        case 'PRIVATE_MESSAGE':
            return '新的私信';
        default:
            return item.type || '通知';
    }
}

function gotoTarget(item) {
    if (!item) return;
    const origin = window.location.origin || '';

    switch (item.type) {
        case 'FRIEND_REQUEST':
        case 'FRIEND_REQUEST_RESPONSE':
            window.location.href = `${origin}/friends`;
            break;
        case 'POST_LIKE':
            if (item.referenceId) {
                window.location.href = `${origin}/post/${item.referenceId}`;
            }
            break;
        case 'COMMENT_LIKE':
        case 'COMMENT_REPLY': {
            const preview = item._commentPreview;
            if (preview && preview.postId && preview.commentId) {
                window.location.href = `${origin}/post/${preview.postId}?commentId=${preview.commentId}`;
            }
            break;
        }
        case 'PRIVATE_MESSAGE':
            if (item.senderId) {
                window.location.href = `${origin}/conversation/${item.senderId}`;
            } else if (item.referenceId) {
                window.location.href = `${origin}/conversation/${item.referenceId}`;
            }
            break;
        default:
            break;
    }
}

export default function PendingFriendRequests() {
    const [notifications, setNotifications] = useState([]);
    const [error, setError] = useState(null);

    const token =
        typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const userId =
        typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;

    const seenRef = useRef(new Set());
    const commentPreviewCacheRef = useRef({});

    /** ---------- 统一追加通知：去重 + 排序 ---------- */
    const appendNotifications = (items) => {
        if (!items || !items.length) return;
        setNotifications((prev) => {
            const merged = Array.isArray(prev) ? prev.slice() : [];
            for (const n of items) {
                if (!n) continue;
                const key = buildKeyFromNotification(n);
                if (!key) continue;
                if (!seenRef.current.has(key)) {
                    seenRef.current.add(key);
                    merged.push(n);
                }
            }
            merged.sort((a, b) => {
                const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return tb - ta;
            });
            return merged;
        });
    };

    /** ---------- 1. 首次挂载：预加载历史通知（从 IndexedDB） ---------- */
    useEffect(() => {
        if (!userId) {
            setError('未登录');
            return;
        }

        let cancelled = false;

        (async () => {
            const cached = await preloadNotifications(userId, 500);
            if (cancelled) return;

            if (Array.isArray(cached) && cached.length > 0) {
                cached.sort((a, b) => {
                    const ta =
                        a.createdAt != null ? new Date(a.createdAt).getTime() : 0;
                    const tb =
                        b.createdAt != null ? new Date(b.createdAt).getTime() : 0;
                    return tb - ta;
                });
                const keys = new Set();
                cached.forEach((n) => {
                    const k = buildKeyFromNotification(n);
                    if (k) keys.add(k);
                });
                seenRef.current = keys;
                setNotifications(cached);
            } else {
                setNotifications([]);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    /** ---------- 2. 拉好友请求 +（可选）本页 SSE 增量 ---------- */
    useEffect(() => {
        if (!userId && !token) {
            setError('未登录');
            return;
        }

        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        if (userId) headers['X-User-Id'] = userId;

        const fetchPending = async () => {
            try {
                const res = await fetch('/api/friends/pending', { headers });
                const j = await res.json();
                if (j && j.code === 200) {
                    const rawList = j.data?.list || j.data || [];
                    const mapped = (Array.isArray(rawList) ? rawList : [])
                        .map(mapFriendRequestDTOToNotification)
                        .filter(Boolean);
                    if (mapped.length) {
                        appendNotifications(mapped);
                        // 把当前拉取的好友请求也写入缓存，避免下次刷新丢失
                        cacheNotifications(userId, mapped, 500);
                    }
                    setError(null);
                } else {
                    setError((j && (j.message || j.msg)) || '获取好友请求失败');
                }
            } catch {
                setError('网络错误');
            }
        };

        fetchPending();

        // ---- 以下 SSE 逻辑仅用于“当前页面实时更新”，可选保留 ----
        let es = null;
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : `?token=`;
        try {
            es = new EventSource(`/api/friends/subscribe${tokenParam}`);
        } catch {
            es = null;
        }

        const handleInit = async (e) => {
            try {
                const data = JSON.parse(e.data || '[]');
                let list = [];
                if (Array.isArray(data)) list = data;
                else if (data && Array.isArray(data.data)) list = data.data;
                const mapped = (Array.isArray(list) ? list : [])
                    .map(mapFriendRequestDTOToNotification)
                    .filter(Boolean);
                if (mapped.length) {
                    appendNotifications(mapped);
                    cacheNotifications(userId, mapped, 500);
                }
            } catch {
                // ignore
            }
        };

        const handleNotification = async (e) => {
            try {
                const data = JSON.parse(e.data || '{}');
                if (!data) return;

                // 只显示给当前用户的
                if (
                    data.receiverId != null &&
                    userId &&
                    String(data.receiverId) !== String(userId)
                ) {
                    return;
                }

                const t = data.type || '';
                if (t === 'COMMENT_REPLY' || t === 'COMMENT_LIKE') {
                    await ensureCommentPreview(data, headers, commentPreviewCacheRef);
                }

                appendNotifications([data]);
                cacheNotifications(userId, [data], 500);
            } catch {
                // ignore
            }
        };

        const handleMessage = (e) => {
            try {
                const data = JSON.parse(e.data || '[]');
                if (Array.isArray(data)) {
                    const mapped = data
                        .map(mapFriendRequestDTOToNotification)
                        .filter(Boolean);
                    if (mapped.length) {
                        appendNotifications(mapped);
                        cacheNotifications(userId, mapped, 500);
                    }
                }
            } catch {
                // ignore
            }
        };

        if (es) {
            es.addEventListener('init', handleInit);
            es.addEventListener('notification', handleNotification);
            es.onmessage = handleMessage;
            es.onerror = () => {
                if (es) {
                    try {
                        es.close();
                    } catch {}
                    es = null;
                }
            };
        }

        return () => {
            if (es) {
                es.removeEventListener('init', handleInit);
                es.removeEventListener('notification', handleNotification);
                try {
                    es.close();
                } catch {}
            }
        };
    }, [token, userId]);

    /** ---------- 3. 好友请求响应：仅影响当前视图（以及后端状态） ---------- */
    const respond = async (friendRequestId, accept) => {
        if (!friendRequestId) return;
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        if (userId) headers['X-User-Id'] = userId;

        try {
            const res = await fetch(
                `/api/friends/respond/${friendRequestId}?accept=${accept}`,
                { method: 'POST', headers }
            );
            const j = await res.json().catch(() => null);
            if (j && j.code === 200) {
                setNotifications((prev) =>
                    prev.filter((n) => n._friendRequestId !== friendRequestId),
                );
            } else {
                // eslint-disable-next-line no-alert
                alert((j && (j.message || j.msg)) || '处理失败');
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
            // eslint-disable-next-line no-alert
            alert('网络错误');
        }
    };

    return (
        <div className="message-list-page">
            <BannerNavbar />
            <div className="message-list-container">
                <h2 className="message-list-title">通知</h2>

                {error && (
                    <div className="message-list-empty" style={{ color: 'red' }}>
                        {error}
                    </div>
                )}

                {!error && notifications.length === 0 && (
                    <div className="message-list-empty">暂无通知</div>
                )}

                {!error && notifications.length > 0 && (
                    <ul className="message-list-ul">
                        {notifications.map((item) => {
                            const key = buildKeyFromNotification(item);
                            const title = formatTitle(item);
                            const created = item.createdAt
                                ? new Date(item.createdAt).toLocaleString()
                                : '';
                            const preview = item._commentPreview || null;

                            const avatar =
                                (preview && preview.avatarUrl) ||
                                item._senderAvatarUrl ||
                                item.senderAvatarUrl ||
                                '/imgs/loginandwelcomepanel/1.png';

                            const nickname =
                                (preview && preview.nickname) ||
                                item._senderNickname ||
                                item.senderNickname ||
                                item.senderUsername ||
                                '系统';

                            const isFriendRequest =
                                item.type === 'FRIEND_REQUEST' && item._friendRequestId;
                            const isCommentType =
                                item.type === 'COMMENT_REPLY' || item.type === 'COMMENT_LIKE';

                            return (
                                <li
                                    key={key}
                                    className="message-list-item"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => gotoTarget(item)}
                                >
                                    <img
                                        src={resolveUrl(avatar)}
                                        alt="avatar"
                                        className="message-list-avatar"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = '/imgs/loginandwelcomepanel/1.png';
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div className="message-list-nickname">{nickname}</div>
                                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                                            {title}
                                        </div>
                                        <div style={{ color: '#666', marginTop: 2 }}>
                                            {item.message}
                                        </div>
                                        {created && (
                                            <div
                                                style={{
                                                    color: '#999',
                                                    fontSize: 12,
                                                    marginTop: 2,
                                                }}
                                            >
                                                {created}
                                            </div>
                                        )}

                                        {isCommentType && preview && preview.postId && (
                                            <div
                                                style={{
                                                    marginTop: 8,
                                                    padding: 8,
                                                    borderRadius: 4,
                                                    background: '#fafafa',
                                                    border: '1px solid #f0f0f0',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    <img
                                                        src={resolveUrl(preview.avatarUrl)}
                                                        alt="avatar"
                                                        style={{
                                                            width: 24,
                                                            height: 24,
                                                            borderRadius: '50%',
                                                            objectFit: 'cover',
                                                            marginRight: 6,
                                                        }}
                                                        onError={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src =
                                                                '/imgs/loginandwelcomepanel/1.png';
                                                        }}
                                                    />
                                                    <span
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: 500,
                                                        }}
                                                    >
                            {preview.nickname}
                          </span>
                                                    {preview.createdAt && (
                                                        <span
                                                            style={{
                                                                fontSize: 12,
                                                                color: '#999',
                                                                marginLeft: 8,
                                                            }}
                                                        >
                              {new Date(
                                  preview.createdAt,
                              ).toLocaleString()}
                            </span>
                                                    )}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 13,
                                                        color: '#444',
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    {(preview.content || '').slice(0, 80)}
                                                </div>
                                                {preview.postTitle && (
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            color: '#999',
                                                        }}
                                                    >
                                                        来自文章《{preview.postTitle}》
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {isFriendRequest && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: 8,
                                                alignItems: 'center',
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    respond(item._friendRequestId, true)
                                                }
                                            >
                                                接受
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    respond(item._friendRequestId, false)
                                                }
                                            >
                                                拒绝
                                            </button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}