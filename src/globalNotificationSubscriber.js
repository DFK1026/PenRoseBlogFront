// 全局通知订阅模块：在应用初始化时调用一次，即可在任意页面都持久化通知。
// 依赖：localNotificationCacheService.js

import { cacheNotifications } from './utils/localNotificationCacheService';
import { ensureCommentPreview } from './utils/commentPreviewService';

let globalEs = null;

/**
 * 启动全局 SSE 订阅：
 * - 只负责：从 /api/friends/subscribe 拉取通知，并写入本地缓存（IndexedDB）。
 * - 不负责：页面内的展示 / 计数，这些交由各自组件（如 NotificationBell、PendingFriendRequests）处理。
 */
export function startGlobalNotificationSubscriber() {
    if (typeof window === 'undefined') return;

    const token =
        typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const userId =
        typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;

    if (!token || !userId) {
        stopGlobalNotificationSubscriber();
        return;
    }

    // 已经创建过就不重复创建
    if (globalEs) return;

    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : `?token=`;

    try {
        globalEs = new EventSource(`/api/friends/subscribe${tokenParam}`);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[globalNotificationSubscriber] EventSource error', e);
        globalEs = null;
        return;
    }

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (userId) headers['X-User-Id'] = userId;

    // 全局简单缓存，避免多次请求同一个评论
    const commentPreviewCacheRef = { current: {} };

    const enrichIfNeeded = async (n) => {
        if (!n) return n;
        const t = n.type || '';
        if (t === 'COMMENT_REPLY' || t === 'COMMENT_LIKE') {
            try {
                await ensureCommentPreview(n, headers, commentPreviewCacheRef);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('[globalNotificationSubscriber] ensureCommentPreview error', err);
            }
        }
        return n;
    };

    const handleNotification = async (e) => {
        try {
            const data = JSON.parse(e.data || '{}');
            if (!data) return;

            // 只记录发给当前用户的通知
            if (
                data.receiverId != null &&
                userId &&
                String(data.receiverId) !== String(userId)
            ) {
                return;
            }

            await enrichIfNeeded(data);

            await cacheNotifications(userId, [data], 500);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[globalNotificationSubscriber] notification error', err);
        }
    };

    const handleInit = async (e) => {
        try {
            const data = JSON.parse(e.data || '[]');
            let list = [];
            if (Array.isArray(data)) list = data;
            else if (data && Array.isArray(data.data)) list = data.data;

            if (list && list.length > 0) {
                const enriched = [];
                for (const n of list) {
                    if (!n) continue;
                    if (
                        n.receiverId != null &&
                        userId &&
                        String(n.receiverId) !== String(userId)
                    ) {
                        continue;
                    }
                    // 评论类补充预览
                    // eslint-disable-next-line no-await-in-loop
                    await enrichIfNeeded(n);
                    enriched.push(n);
                }
                if (enriched.length > 0) {
                    await cacheNotifications(userId, enriched, 500);
                }
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[globalNotificationSubscriber] init error', err);
        }
    };

    const handleMessage = async (e) => {
        // 默认 message 兼容一些后端不带 event type 的推送，也写缓存
        try {
            const data = JSON.parse(e.data || '[]');
            if (Array.isArray(data) && data.length > 0) {
                const enriched = [];
                for (const n of data) {
                    if (!n) continue;
                    if (
                        n.receiverId != null &&
                        userId &&
                        String(n.receiverId) !== String(userId)
                    ) {
                        continue;
                    }
                    // eslint-disable-next-line no-await-in-loop
                    await enrichIfNeeded(n);
                    enriched.push(n);
                }
                if (enriched.length > 0) {
                    await cacheNotifications(userId, enriched, 500);
                }
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[globalNotificationSubscriber] message error', err);
        }
    };

    globalEs.addEventListener('init', handleInit);
    globalEs.addEventListener('notification', handleNotification);
    globalEs.onmessage = handleMessage;

    globalEs.onerror = () => {
        if (globalEs) {
            try {
                globalEs.close();
            } catch {
                // ignore
            }
            globalEs = null;
        }
    };
}

/**
 * 停止全局 SSE 订阅（比如用户退出登录时调用）
 */
export function stopGlobalNotificationSubscriber() {
    if (globalEs) {
        try {
            globalEs.close();
        } catch {
            // ignore
        }
        globalEs = null;
    }
}