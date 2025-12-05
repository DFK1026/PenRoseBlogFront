import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * 通知铃组件：
 *
 * - 通过 /api/friends/subscribe 的 SSE 接收所有 NotificationDTO；
 * - 只监听命名事件 "notification"，避免 default message 导致一次操作计两条；
 * - 每条 NotificationDTO 视为一条通知，累加计数；
 * - 点击后跳转到 /friends/pending 页面（通知中心）。
 *
 * 注意：真正的“写入本地缓存”在 globalNotificationSubscriber.js 中集中处理；
 * 这里仅做 badge 计数展示，避免每个页面都实现缓存逻辑。
 */
export default function NotificationBell() {
    const [count, setCount] = useState(0);
    const token =
        typeof localStorage !== 'undefined'
            ? localStorage.getItem('token')
            : null;
    const userId =
        typeof localStorage !== 'undefined'
            ? localStorage.getItem('userId')
            : null;

    useEffect(() => {
        if (!token || !userId) {
            setCount(0);
            return;
        }

        let es = null;
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : `?token=`;

        try {
            es = new EventSource(`/api/friends/subscribe${tokenParam}`);
        } catch {
            es = null;
        }

        if (!es) return;

        const onNotification = (e) => {
            try {
                const data = JSON.parse(e.data || '{}');
                if (!data) return;

                // 只统计发给当前用户的通知
                if (
                    data.receiverId != null &&
                    userId &&
                    String(data.receiverId) !== String(userId)
                ) {
                    return;
                }

                // 所有类型的 NotificationDTO 统一 +1
                setCount((prev) => prev + 1);
            } catch {
                // ignore
            }
        };

        es.addEventListener('notification', onNotification);

        es.onerror = () => {
            if (es) {
                try {
                    es.close();
                } catch {
                    // ignore
                }
                es = null;
            }
        };

        return () => {
            if (es) {
                es.removeEventListener('notification', onNotification);
                try {
                    es.close();
                } catch {
                    // ignore
                }
            }
        };
    }, [token, userId]);

    return (
        <div style={{ position: 'relative' }}>
            <Link
                to="/friends/pending"
                aria-label="查看通知"
                style={{ display: 'inline-block' }}
            >
                <button className="notification-bell" type="button">
                    🔔
                </button>
            </Link>
            {count > 0 && (
                <span
                    style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        background: '#ff4d4f',
                        color: '#fff',
                        borderRadius: 12,
                        padding: '2px 6px',
                        fontSize: 12,
                    }}
                >
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </div>
    );
}