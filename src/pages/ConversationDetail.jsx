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

  // 新增：上传相关状态与 ref
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // 新增：会话“视图”记录（权威列表，含撤回/已删）
  const [viewRecords, setViewRecords] = useState([]);
  // 右键菜单状态
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, msg: null });

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
        if (j && j.code === 200 && j.data)
          setMessages(prev => mergeMessages(prev, j.data.list || []));
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

  // 新增：加载“视图”数据（过滤已删除 + 撤回信息）
  const refreshView = React.useCallback(() => {
    if (!userId || !otherId) return;
    // 拉大 size，避免遗漏较多消息
    fetch(`/api/messages/conversation/view/${otherId}?page=0&size=500`, {
      headers: { 'X-User-Id': userId }
    })
      .then(r => r.json())
      .then(j => {
        if (j && j.code === 200 && j.data && Array.isArray(j.data.records || j.data.list)) {
          const list = j.data.records || j.data.list; // 兼容 records/list 字段
          setViewRecords(list);
        }
      })
      .catch(() => {});
  }, [userId, otherId]);

  useEffect(() => { refreshView(); }, [refreshView]);

  // 切换会话时清空旧消息，避免与上一位用户混杂
  useEffect(() => { setMessages([]); setViewRecords([]); }, [otherId]);

  // 根据“视图”与“详细消息”合成实际渲染列表
  const messagesById = React.useMemo(() => {
    const map = new Map();
    (messages || []).forEach(m => { if (m && m.id != null) map.set(m.id, m); });
    return map;
  }, [messages]);

  const finalMessages = React.useMemo(() => {
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
      merged.__recalled = !!v.recalled;
      merged.__displayText = v.displayText || '';
      return merged;
    });
  }, [viewRecords, messagesById]);

  // 从消息推断对方信息（改为用 finalMessages）
  useEffect(() => {
    if (!finalMessages || finalMessages.length === 0) return;
    for (let m of finalMessages) {
      if (m.senderId !== Number(userId)) {
        setOtherInfo({ nickname: m.senderNickname || '', avatarUrl: m.senderAvatarUrl || '' });
        return;
      }
      if (m.receiverId !== Number(userId)) {
        setOtherInfo({ nickname: m.receiverNickname || '', avatarUrl: m.receiverAvatarUrl || '' });
        return;
      }
    }
  }, [finalMessages, userId]);

  // SSE/轮询更新：收到任何事件后只触发刷新，避免与视图不一致
  useEffect(() => {
    if (!otherId) return;
    let es;
    let pollTimer;
    const loadConversation = () => {
      if (!userId) return;
      fetch(`/api/messages/conversation/${otherId}`, { headers: { 'X-User-Id': userId } })
        .then(r => r.json())
        .then(j => { if (j && j.code === 200 && j.data) setMessages(prev => mergeMessages(prev, j.data.list || [])); });
    };

    try { es = new EventSource(`/api/messages/stream/${otherId}`); } catch { es = null; }
    let fallbackToPoll = false;
    if (es) {
      const onAny = () => { loadConversation(); refreshView(); };
      es.addEventListener('init', onAny);
      es.addEventListener('update', onAny);
      es.addEventListener('error', () => { fallbackToPoll = true; if (es) { es.close(); es = null; } });
    } else { fallbackToPoll = true; }

    if (fallbackToPoll) {
      const fn = () => { loadConversation(); refreshView(); };
      fn();
      pollTimer = setInterval(fn, 4000);
    }
    return () => { if (es) es.close(); if (pollTimer) clearInterval(pollTimer); };
  }, [otherId, userId, refreshView]);

  // 仅让右侧会话容器自身滚动到底部（初始/更新时）
  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [finalMessages]);

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
        setMessages(prev => mergeMessages(prev, [j.data]));
      }
    } catch {}
    // 发送后刷新视图（权威状态）
    refreshView();
  };

  // 新增：带进度的上传函数
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
        } catch {
          reject(new Error('上传响应解析失败'));
        }
      };
      xhr.onerror = () => reject(new Error('网络错误，上传失败'));
      xhr.send(form);
    });
  };

  // 新增：选择文件并上传后发送媒体消息
  const handleFileChosen = async (e, type) => {
    const file = e.target.files && e.target.files[0];
    // 允许重复选择同一文件
    e.target.value = '';
    if (!file) return;
    try {
      setUploading(true);
      setUploadProgress(0);
      const url = await uploadFile(file);
      const body = { type, mediaUrl: url, text: '' };
      const res = await fetch(`/api/messages/media/${otherId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify(body)
      });
      const j = await res.json();
      if (j && j.code === 200 && j.data) {
        setMessages(prev => mergeMessages(prev, [j.data]));
      } else {
        // 失败则刷新会话
        fetch(`/api/messages/conversation/${otherId}`, { headers: { 'X-User-Id': userId } })
          .then(r => r.json())
          .then(j2 => { if (j2 && j2.code === 200 && j2.data) setMessages(prev => mergeMessages(prev, j2.data.list || [])); });
      }
    } catch (err) {
      window.alert(err?.message || '上传失败');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const onPickImageClick = () => imageInputRef.current && imageInputRef.current.click();
  const onPickVideoClick = () => videoInputRef.current && videoInputRef.current.click();

  const gotoConversation = (id) => {
    if (!id || String(id) === String(otherId)) return;
    navigate(`/conversation/${id}`);
  };
  const openProfile = (uid) => {
    if (!uid) return;
    navigate(`/selfspace?userId=${uid}`);
  };

  // 新增/修正：把 /files/... 指到后端来源（避免打到前端域）
  const toAbsUrl = (u) => {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    // 后端默认提供静态资源前缀 /files/...，开发环境前后端分离时需指向后端端口
    const isFiles = u.startsWith('/files/');
    if (isFiles) {
      // 简单推断后端来源：同域但改端口为 8080
      const loc = window.location;
      const backendOrigin = `${loc.protocol}//${loc.hostname}:8080`;
      return backendOrigin + u;
    }
    // 其他相对路径维持原样（走当前站点/代理）
    try {
      return new URL(u, window.location.origin).toString();
    } catch {
      return u;
    }
  };

  // 右键菜单：打开/关闭
  const openContextMenu = (e, msg) => {
    e.preventDefault();
    setMenu({ visible: true, x: e.clientX, y: e.clientY, msg });
  };
  const closeContextMenu = () => setMenu(m => ({ ...m, visible: false, msg: null }));
  useEffect(() => {
    const onDocClick = () => closeContextMenu();
    const onEsc = (e) => { if (e.key === 'Escape') closeContextMenu(); };
    const onScroll = () => closeContextMenu();
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // 撤回与删除调用
  const recallMessage = async (messageId) => {
    try {
      const r = await fetch(`/api/messages/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ messageId })
      });
      const j = await r.json().catch(() => ({}));
      if (!(j && j.code === 200)) {
        window.alert(j?.message || '撤回失败');
      }
    } catch {
      window.alert('网络错误，撤回失败');
    } finally {
      closeContextMenu();
      refreshView();
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      const r = await fetch(`/api/messages/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ messageId })
      });
      const j = await r.json().catch(() => ({}));
      if (!(j && j.code === 200)) {
        window.alert(j?.message || '删除失败');
      }
    } catch {
      window.alert('网络错误，删除失败');
    } finally {
      closeContextMenu();
      refreshView();
    }
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
          {finalMessages.map(msg => {
            const isSelf = msg.senderId === Number(userId);
            const recalled = !!msg.__recalled;
            return (
              <div
                key={msg.id}
                className={`conversation-detail-msg${isSelf ? ' self' : ''}${recalled ? ' recalled' : ''}`}
                onContextMenu={(e) => openContextMenu(e, msg)}
                title="右键可撤回/删除"
              >
                <div className="conversation-detail-msg-meta">
                  <img
                    src={msg.senderAvatarUrl || otherInfo.avatarUrl || '/imgs/loginandwelcomepanel/1.png'}
                    alt="avatar"
                    className={`conversation-detail-msg-avatar${!isSelf ? ' clickable' : ''}`}
                    onClick={!isSelf ? () => openProfile(msg.senderId) : undefined}
                    onError={(e) => { e.target.onerror = null; e.target.src = '/imgs/loginandwelcomepanel/1.png'; }}
                  />
                  <span className="conversation-detail-msg-nickname">
                    {msg.senderNickname || (isSelf ? '你' : otherInfo.nickname)}
                  </span>
                </div>

                <div className="conversation-detail-msgtext">
                  {recalled ? (
                    msg.__displayText || '消息已撤回'
                  ) : (
                    // 原有媒体/文本渲染
                    msg?.type === 'IMAGE' && msg?.mediaUrl ? (
                      <img
                        className="conversation-detail-msgmedia"
                        src={toAbsUrl(msg.mediaUrl)}
                        alt="image"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const a = document.createElement('a');
                          a.href = toAbsUrl(msg.mediaUrl);
                          a.textContent = '[图片加载失败，点击打开]';
                          a.target = '_blank';
                          e.currentTarget.parentElement?.appendChild(a);
                        }}
                      />
                    ) : msg?.type === 'VIDEO' && msg?.mediaUrl ? (
                      <video className="conversation-detail-msgmedia" src={toAbsUrl(msg.mediaUrl)} controls />
                    ) : (
                      msg?.text || ''
                    )
                  )}
                </div>

                <div className="conversation-detail-msgtime">
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}
                </div>
              </div>
            );
          })}
        </div>

        {/* 表单：增加图片/视频上传按钮和隐藏的文件选择器 */}
        <form className="conversation-detail-form" onSubmit={handleSend}>
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="输入消息..."
            className="conversation-detail-input"
            autoFocus
            disabled={uploading}
          />

          {/* 新增：上传图片 */}
          <button
            type="button"
            className="conversation-detail-uploadbtn"
            onClick={onPickImageClick}
            disabled={uploading}
            title="上传图片"
          >
            图片
          </button>

          {/* 新增：上传视频 */}
          <button
            type="button"
            className="conversation-detail-uploadbtn"
            onClick={onPickVideoClick}
            disabled={uploading}
            title="上传视频"
          >
            视频
          </button>

          <button type="submit" className="conversation-detail-sendbtn" disabled={uploading}>发送</button>

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

        {/* 新增：上传进度条 */}
        {uploading && (
          <div className="conversation-detail-uploadprogress" aria-live="polite">
            <div className="bar" style={{ width: `${uploadProgress}%` }} />
            <span className="pct">{uploadProgress}%</span>
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {menu.visible && menu.msg && (
        <div className="msg-context-menu" style={{ left: menu.x, top: menu.y }}>
          {menu.msg.senderId === Number(userId) && !menu.msg.__recalled && (
            <button onClick={() => recallMessage(menu.msg.id)}>撤回</button>
          )}
          <button onClick={() => deleteMessage(menu.msg.id)}>删除</button>
        </div>
      )}
    </div>
  );
}
