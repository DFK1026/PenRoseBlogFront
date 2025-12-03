import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/message/MessageList.css';
import BannerNavbar from '../components/common/BannerNavbar.jsx';

export default function FriendsList() {
  const [list, setList] = useState([]);
  const [error, setError] = useState(null);
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;
  const navigate = useNavigate();

  const buildHeaders = () => {
    const h = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (userId) h['X-User-Id'] = userId;
    return h;
  };

  // 删除好友 = 取消我对对方的关注（打破互关即可）
  const handleRemoveFriend = async (targetId) => {
    try {
      const res = await fetch(`/api/follow/${targetId}`, { method: 'DELETE', headers: buildHeaders() });
      let ok = res.ok, j = null;
      try { j = await res.json(); ok = ok || (j && (j.code === 200 || j.status === 200)); } catch {}
      if (ok) {
        setList(prev => prev.filter(u => String(u.id) !== String(targetId)));
      } else {
        alert((j && (j.message || j.msg)) || '删除好友失败');
      }
    } catch (e) {
      console.error(e);
      alert('网络错误');
    }
  };

  // 新增：进入会话后自动刷新一次，确保布局正常
  const gotoConversationWithRefresh = (id) => {
    if (!id) return;
    navigate(`/conversation/${id}`);
    // 让路由渲染完成后刷新
    setTimeout(() => {
      try { window.location.reload(); } catch {}
    }, 0);
  };

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await fetch('/api/friends/list', { headers: buildHeaders() });
        const j = await res.json();
        if (j && j.code === 200) {
          setList(j.data?.list || j.data || []);
        } else {
          setError(j && (j.message || j.msg) ? (j.message || j.msg) : '获取失败');
        }
      } catch (e) {
        setError('网络错误');
        console.error(e);
      }
    };
    fetchFriends();
  }, [token, userId]);

  return (
    <>
      <BannerNavbar />
      <div className="message-list-container">
        <h2 className="message-list-title">我的好友</h2>
        {error ? (
          <div className="message-list-empty" style={{color:'red'}}>{error}</div>
        ) : list.length === 0 ? (
          <div className="message-list-empty">暂无好友</div>
        ) : (
          <ul className="message-list-ul">
            {list.map(u => (
              <li key={u.id} className="message-list-item">
                <Link to={`/selfspace?userId=${u.id}`} title="查看主页" style={{ display:'inline-block' }}>
                  <img
                    src={u.avatarUrl || '/imgs/loginandwelcomepanel/1.png'}
                    alt="avatar"
                    className="message-list-avatar clickable"
                  />
                </Link>
                <div style={{ flex: 1, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div className="message-list-nickname">{u.nickname || u.username}</div>
                    <div style={{ color: '#666' }}>{u.bio || ''}</div>
                  </div>
                  <div style={{display:'flex', gap:8}}>
                    <button
                      type="button"
                      className="message-list-linkbtn"
                      style={{ background:'#ff6b6b' }}   /* 红色：删除好友 */
                      onClick={() => handleRemoveFriend(u.id)}
                    >
                      删除好友
                    </button>
                    {/* 原 Link 改为按钮，点击后跳转并刷新一次 */}
                    <button
                      type="button"
                      className="message-list-linkbtn"
                      onClick={() => gotoConversationWithRefresh(u.id)}
                    >
                      私信
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
