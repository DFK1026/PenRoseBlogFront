import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BannerNavbar from '../components/common/BannerNavbar';
import '../styles/message/ConversationDetail.css';

export default function ConversationDetail() {
  const { otherId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [otherInfo, setOtherInfo] = useState({ nickname: '', avatarUrl: '' });
  const [conversations, setConversations] = useState([]); // 左侧会话摘要列表
  const userId = localStorage.getItem('userId');
  const rightScrollRef = useRef(null);  // 右侧会话滚动容器
  const leftScrollRef = useRef(null);   // 左侧列表滚动容器

  const mergeMessages = (oldList, newList) => {
    if ((!oldList || oldList.length === 0) && (!newList || newList.length === 0)) return [];
    const mergedArr = [];
    const seen = new Map();
    const keyOf = (m) => {
      if (!m) return null;
      if (m.id != null) return `id:${m.id}`;
      // fallback composite key: createdAt + sender + receiver + text
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

    // prefer preserving order: first oldList then newList, but allow newList to override content by key
    (oldList || []).forEach(pushIfNew);
    (newList || []).forEach(pushIfNew);

    // sort by createdAt asc (fallback to keep existing order when missing)
    mergedArr.sort((a, b) => {
      const ta = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });

    return mergedArr;
  };
  // 进入会话后标记已读
  useEffect(() => {
    if (!userId || !otherId) return;
    // 标记此会话为已读（不需要等待结果）
    fetch(`/api/messages/conversation/${otherId}/read`, {
      method: 'POST',
      headers: { 'X-User-Id': userId }
    }).catch(() => {});
  }, [userId, otherId]);

  // 加载右侧会话消息
  useEffect(() => {
    if (!userId || !otherId) return;
    fetch(`/api/messages/conversation/${otherId}`, {
      headers: { 'X-User-Id': userId }
    })
      .then(r => r.json())
      .then(j => {
        if (j && j.code === 200 && j.data) setMessages(prev => mergeMessages(prev, j.data.list || []));
      });
  }, [userId, otherId]);

  // 加载左侧会话摘要列表（含头像、昵称）
  useEffect(() => {
    if (!userId) return;
    fetch('/api/messages/conversation/list', { headers: { 'X-User-Id': userId } })
      .then(r => r.json())
      .then(j => {
        if (j && j.code === 200 && j.data && Array.isArray(j.data.list)) {
          setConversations(j.data.list);
        }
      })
      .catch(() => {});
  }, [userId]);

  // 切换会话时清空旧消息，避免与上一位用户混杂
  useEffect(() => { setMessages([]); }, [otherId]);

  // 仅保留当前会话双方的消息
  const meId = Number(userId || 0);
  const oid = Number(otherId || 0);
  const filteredMessages = React.useMemo(
    () => (messages || []).filter(m =>
      (m?.senderId === meId && m?.receiverId === oid) ||
      (m?.senderId === oid && m?.receiverId === meId)
    ),
    [messages, meId, oid]
  );

  // 从消息推断对方信息
  useEffect(() => {
    if (!filteredMessages || filteredMessages.length === 0) return;
    for (let m of filteredMessages) {
      if (m.senderId !== Number(userId)) {
        setOtherInfo({ nickname: m.senderNickname || '', avatarUrl: m.senderAvatarUrl || '' });
        return;
      }
      if (m.receiverId !== Number(userId)) {
        setOtherInfo({ nickname: m.receiverNickname || '', avatarUrl: m.receiverAvatarUrl || '' });
        return;
      }
    }
  }, [filteredMessages, userId]);

  // SSE/轮询更新（保留原逻辑）
  useEffect(() => {
    if (!otherId) return;
    let es;
    let pollTimer;
    try { es = new EventSource(`/api/messages/stream/${otherId}`); } catch { es = null; }
    let fallbackToPoll = false;
    if (es) {
      es.addEventListener('init', e => {
        try { const data = JSON.parse(e.data); setMessages(prev => mergeMessages(prev, data || [])); } catch {}
      });
      es.addEventListener('update', e => {
        try { const data = JSON.parse(e.data); setMessages(prev => mergeMessages(prev, data || [])); } catch {}
      });
      es.addEventListener('error', () => { fallbackToPoll = true; if (es) { es.close(); es = null; } });
    } else { fallbackToPoll = true; }

    if (fallbackToPoll) {
      const fn = () => {
        if (!userId) return;
        fetch(`/api/messages/conversation/${otherId}`, { headers: { 'X-User-Id': userId } })
          .then(r => r.json())
          .then(j => { if (j && j.code === 200 && j.data) setMessages(prev => mergeMessages(prev, j.data.list || [])); });
      };
      fn();
      pollTimer = setInterval(fn, 4000);
    }
    return () => { if (es) es.close(); if (pollTimer) clearInterval(pollTimer); };
  }, [otherId, userId]);

  // 仅让右侧会话容器自身滚动到底部（初始/更新时）
  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [filteredMessages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const body = { text };
    const res = await fetch(`/api/messages/text/${otherId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify(body)
    });
    setText('');
    try {
      const j = await res.json();
      if (j && j.code === 200 && j.data) {
        // merge the sent message into the list (dedupe if SSE/poll also returns it)
        setMessages(prev => mergeMessages(prev, [j.data]));
      } else {
        // fallback: refresh full conversation
        fetch(`/api/messages/conversation/${otherId}`, { headers: { 'X-User-Id': userId } })
          .then(r => r.json())
          .then(j2 => { if (j2 && j2.code === 200 && j2.data) setMessages(prev => mergeMessages(prev, j2.data.list || [])); });
      }
    } catch {
      // ignore errors parsing response
    }
  };

  const gotoConversation = (id) => {
    if (!id || String(id) === String(otherId)) return;
    navigate(`/conversation/${id}`);
  };
  const openProfile = (uid) => {
    if (!uid) return;
    navigate(`/selfspace?userId=${uid}`);
  };

  return (
    <div className="conversation-detail-page">
      <BannerNavbar />
      <div className="conversation-detail-container two-columns">
        {/* 左侧：会话用户栏（头像 + 昵称），可滚动 */}
        <aside className="conversation-sidebar" ref={leftScrollRef} aria-label="会话列表">
          {conversations.map(c => (
            <button
              key={c.otherId}
              className={`conversation-sidebar-item${String(c.otherId) === String(otherId) ? ' active' : ''}`}
              title={c.nickname || ''}
              onClick={() => gotoConversation(c.otherId)}
            >
              <img
                src={c.avatarUrl || '/imgs/loginandwelcomepanel/1.png'}
                alt="avatar"
                className="conversation-sidebar-avatar"
                onError={(e) => { e.target.onerror = null; e.target.src = '/imgs/loginandwelcomepanel/1.png'; }}
              />
              <span className="conversation-sidebar-name">{c.nickname || `用户${c.otherId}`}</span>
            </button>
          ))}
        </aside>

        {/* 右侧：会话消息栏，仅自身滚动 */}
        <div className="conversation-detail-list" ref={rightScrollRef}>
          {filteredMessages.map(msg => (
            <div key={msg.id} className={`conversation-detail-msg${msg.senderId === Number(userId) ? ' self' : ''}`}>
              <div className="conversation-detail-msg-meta">
                <img
                  src={msg.senderAvatarUrl || otherInfo.avatarUrl || '/imgs/loginandwelcomepanel/1.png'}
                  alt="avatar"
                  className={`conversation-detail-msg-avatar${msg.senderId !== Number(userId) ? ' clickable' : ''}`}
                  onClick={msg.senderId !== Number(userId) ? () => openProfile(msg.senderId) : undefined}
                  onError={(e) => { e.target.onerror = null; e.target.src = '/imgs/loginandwelcomepanel/1.png'; }}
                />
                <span className="conversation-detail-msg-nickname">{msg.senderNickname || (msg.senderId === Number(userId) ? '你' : otherInfo.nickname)}</span>
              </div>
              <div className="conversation-detail-msgtext">{msg.text}</div>
              <div className="conversation-detail-msgtime">{new Date(msg.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <form className="conversation-detail-form" onSubmit={handleSend}>
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="输入消息..."
            className="conversation-detail-input"
            autoFocus
          />
          <button type="submit" className="conversation-detail-sendbtn">发送</button>
        </form>
      </div>
    </div>
  );
}
