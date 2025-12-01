import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/message/MessageList.css';
import BannerNavbar from '../components/common/BannerNavbar.jsx';

export default function FollowingList() {
  const [list, setList] = useState([]);
  const [error, setError] = useState(null);
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;

  useEffect(() => {
    const fetchFollowing = async () => {
      try {
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (userId) headers['X-User-Id'] = userId;
        const res = await fetch('/api/following', { headers });
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
    fetchFollowing();
  }, [token, userId]);

  return (
    <>
      <BannerNavbar />
      <div className="message-list-container">
        <h2 className="message-list-title">我的关注</h2>
        {error ? (
          <div className="message-list-empty" style={{color:'red'}}>{error}</div>
        ) : list.length === 0 ? (
          <div className="message-list-empty">暂无关注</div>
        ) : (
          <ul className="message-list-ul">
            {list.map(u => (
              <li key={u.id} className="message-list-item">
                <img src={u.avatarUrl || '/imgs/loginandwelcomepanel/1.png'} alt="avatar" className="message-list-avatar" />
                <div style={{ flex: 1, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div className="message-list-nickname">{u.nickname || u.username}</div>
                    <div style={{ color: '#666' }}>{u.bio || ''}</div>
                  </div>
                  <Link to={`/conversation/${u.id}`} className="message-list-linkbtn">私信</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
