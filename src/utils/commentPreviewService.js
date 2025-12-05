/**
 * COMMENT_REPLY / COMMENT_LIKE 预览工具：
 * - 约定：referenceExtraId = 文章ID, referenceId = 评论ID。
 * - 会在 notification 对象上填充 `_commentPreview` 字段。
 *
 * 使用方式：
 *   await ensureCommentPreview(notification, headers, cacheRef);
 */
export async function ensureCommentPreview(notification, headers = {}, cacheRef) {
    if (!notification) return;
    const commentId = notification.referenceId;
    const postId = notification.referenceExtraId;
    if (!commentId || !postId) return;

    // 简单内存缓存，避免同一评论重复请求
    const cache = (cacheRef && cacheRef.current) || {};

    if (cache[commentId]) {
        // eslint-disable-next-line no-param-reassign
        notification._commentPreview = cache[commentId];
        return;
    }

    try {
        const params = new URLSearchParams();
        params.set('size', '10000');
        const url = `/api/comment/list/${postId}?${params.toString()}`;
        const res = await fetch(url, { headers });
        const j = await res.json().catch(() => null);
        if (!j || j.code !== 200) return;

        const list = Array.isArray(j.data)
            ? j.data
            : j.data && Array.isArray(j.data.list)
                ? j.data.list
                : [];
        const c = (list || []).find((x) => String(x.id) === String(commentId));
        if (c) {
            const preview = {
                postId,
                commentId,
                content: c.content || '',
                nickname: c.nickname || '',
                avatarUrl: c.avatarUrl || '',
                createdAt: c.createdAt || c.createTime || notification.createdAt,
                postTitle: j.postTitle || '',
            };

            cache[commentId] = preview;
            if (cacheRef) {
                // eslint-disable-next-line no-param-reassign
                cacheRef.current = cache;
            }

            // eslint-disable-next-line no-param-reassign
            notification._commentPreview = preview;
        }
    } catch {
        // ignore
    }
}