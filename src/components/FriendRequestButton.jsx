import React, { useState, useEffect } from 'react';

export default function FriendRequestButton({ targetId, onSent, initialFriend = false }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [isFriend, setIsFriend] = useState(initialFriend);
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;

  useEffect(() => { setIsFriend(!!initialFriend); }, [initialFriend]);

  // 若未能从外部判定好友，调用“是否互关”接口兜底
  useEffect(() => {
    if (initialFriend) return;
    const headers = withHeaders();
    fetch(`/api/follow/friends/${targetId}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && (j.code === 200 || j.status === 200)) setIsFriend(!!j.data); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  const withHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const uid = payload && (payload.userId || payload.userID || payload.user_id || payload.uid);
        if (uid) headers['X-User-Id'] = String(uid);
      } catch {}
    } else if (userId) headers['X-User-Id'] = userId;
    return headers;
  };

  const send = async () => {
    if (!userId && !token) {
      alert('请先登录');
      return;
    }
    if (!isFriend && sent) return; // 申请中勿重复

    setLoading(true);
    try {
      const headers = withHeaders();
      if (isFriend) {
        // 取消我对TA的关注 => 破坏互关，即“删除好友”
        const r = await fetch(`/api/follow/${targetId}`, { method: 'DELETE', headers });
        const j = await r.json().catch(() => ({}));
        if (j && (j.code === 200 || j.status === 200)) {
          setIsFriend(false); setSent(false);
        } else {
          alert((j && (j.message || j.msg)) || '删除失败');
        }
      } else {
        // 发送好友申请
        const res = await fetch(`/api/friends/request/${targetId}`, { method: 'POST', headers });
        const j = await res.json();
        if (j && (j.code === 200 || j.status === 200)) {
          setSent(true);
          if (onSent) onSent(j.data);
        } else {
          const msg = j && (j.message || j.msg) ? (j.message || j.msg) : '发送失败';
          alert(msg);
          console.warn('FriendRequest failed', j);
        }
      }
    } catch (e) {
      console.error(e);
      alert('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`friend-request-btn ${sent ? 'sent' : ''}`}
      onClick={send}
      disabled={loading || (!isFriend && sent)}
      title={isFriend ? '删除与该用户的好友关系' : ''}
    >
      {isFriend ? (loading ? '删除中...' : '删除好友') : (sent ? '已申请' : (loading ? '发送中...' : '加好友'))}
    </button>
  );
}
