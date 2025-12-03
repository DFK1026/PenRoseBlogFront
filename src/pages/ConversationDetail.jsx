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

  // 新增：记录本次会话中我已撤回过的消息ID（会话内强制为已撤回）
  const recalledLocalRef = useRef(new Set());
  const normId = (id) => String(id);

  // 新增：会话“视图”记录（权威列表，含撤回/已删）
  const [viewRecords, setViewRecords] = useState([]);
  // 右键菜单状态
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, msg: null });
  const [inputHeight, setInputHeight] = useState(() => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
    return Math.max(56, Math.round(vh * 0.15)); // 15vh
  });
  const inputRef = useRef(null);

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
  // 进入会话后标记已读（抽成函数，便于复用）
  const markReadCurrent = React.useCallback(() => {
    if (!userId || !otherId) return;
    fetch(`/api/messages/conversation/${otherId}/read`, {
      method: 'POST',
      headers: { 'X-User-Id': userId }
    })
    .then(() => {
      setConversations(prev =>
        (prev || []).map(x => String(x.otherId) === String(otherId) ? { ...x, unreadCount: 0 } : x)
      );
      try { window.dispatchEvent(new Event('pm-unread-refresh')); } catch {}
    })
    .catch(() => {});
  }, [userId, otherId]);

  // 进入会话时即刻标记已读
  useEffect(() => { markReadCurrent(); }, [markReadCurrent]);

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

  // 加载左侧会话摘要列表（含头像、昵称、未读数）
  useEffect(() => {
    if (!userId) return;
    const loadList = async () => {
      try {
        const r = await fetch('/api/messages/conversation/list', { headers: { 'X-User-Id': userId } });
        const j = await r.json();
        if (j && j.code === 200 && j.data && Array.isArray(j.data.list)) {
          let list = j.data.list;

          // 若当前会话对象不在列表中，补一条占位项（无消息也显示）
          const exists = list.some(x => String(x.otherId) === String(otherId));
          if (!exists && otherId) {
            // 尝试获取真实昵称与头像
            let profileNick = '';
            let profileAvatar = '';
            try {
              const pr = await fetch(`/api/user/profile/${otherId}`);
              const pj = await pr.json();
              if (pj && pj.code === 200 && pj.data) {
                profileNick = pj.data.nickname || '';
                profileAvatar = pj.data.avatarUrl || '';
              }
            } catch {/* ignore */}

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

          // 如果接口返回的该用户条目缺少昵称/头像，也用 profile 补齐
          list = await Promise.all(list.map(async (x) => {
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
            } catch {/* ignore */}
            return {
              ...x,
              nickname: x.nickname || otherInfo?.nickname || '',
              avatarUrl: x.avatarUrl || otherInfo?.avatarUrl || ''
            };
          }));

          setConversations(list);
        }
      } catch (e) {
        // ignore
      }
    };
    loadList();
  }, [userId, otherId, otherInfo]);

  // 新增：加载“视图”数据（过滤已删除 + 撤回信息）
  const refreshView = React.useCallback(() => {
    if (!userId || !otherId) return;
    fetch(`/api/messages/conversation/view/${otherId}?page=0&size=500`, {
      headers: { 'X-User-Id': userId }
    })
      .then(r => r.json())
      .then(j => {
        if (j && j.code === 200 && j.data && Array.isArray(j.data.records || j.data.list)) {
          const list = j.data.records || j.data.list;
          // 关键：把“本地已撤回”的ID强制标记为 recalled=true，避免后端短时未反映导致回弹
          const withLocal = list.map(r => (
            recalledLocalRef.current.has(normId(r.id))
              ? { ...r, recalled: true }
              : r
          ));
          setViewRecords(withLocal);
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
      // 更稳健地解析 recalled
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
    const loadList = () => {
      if (!userId) return;
      fetch('/api/messages/conversation/list', { headers: { 'X-User-Id': userId } })
        .then(r => r.json())
        .then(j => { if (j && j.code === 200 && j.data && Array.isArray(j.data.list)) setConversations(j.data.list); })
        .catch(() => {});
    };

    try { es = new EventSource(`/api/messages/stream/${otherId}`); } catch { es = null; }
    let fallbackToPoll = false;
    if (es) {
      const onAny = () => {
        loadConversation();
        refreshView();
        loadList();         
        markReadCurrent();   
      };
      es.addEventListener('init', onAny);
      es.addEventListener('update', onAny);
      es.addEventListener('error', () => { fallbackToPoll = true; if (es) { es.close(); es = null; } });
    } else { fallbackToPoll = true; }

    if (fallbackToPoll) {
      const fn = () => {
        loadConversation();
        refreshView();
        loadList();        
        markReadCurrent();
      };
      fn();
      pollTimer = setInterval(fn, 4000);
    }
    return () => {
      try { if (es) es.close(); } catch {}
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [otherId, userId, refreshView, markReadCurrent]);

  // 仅让右侧会话容器自身滚动到底部（初始/更新时）
  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    // 基础滚到底
    el.scrollTop = el.scrollHeight;

    // 监听媒体加载完成后再次滚到底（避免图片/视频异步加载改变高度）
    const imgs = Array.from(el.querySelectorAll('img.conversation-detail-msgmedia'));
    const vids = Array.from(el.querySelectorAll('video.conversation-detail-msgmedia'));
    const onLoaded = () => {
      try {
        el.scrollTop = el.scrollHeight;
      } catch {}
    };
    imgs.forEach(img => {
      if (!img) return;
      if (img.complete) {
        // 已完成加载，直接滚一次
        onLoaded();
      } else {
        img.addEventListener('load', onLoaded, { once: true });
        img.addEventListener('error', onLoaded, { once: true });
      }
    });
    vids.forEach(v => {
      if (!v) return;
      if (v.readyState >= 2) {
        onLoaded();
      } else {
        v.addEventListener('loadeddata', onLoaded, { once: true });
        v.addEventListener('error', onLoaded, { once: true });
      }
    });

    // 清理事件监听（避免内存泄漏）
    return () => {
      imgs.forEach(img => {
        try {
          img.removeEventListener('load', onLoaded);
          img.removeEventListener('error', onLoaded);
        } catch {}
      });
      vids.forEach(v => {
        try {
          v.removeEventListener('loadeddata', onLoaded);
          v.removeEventListener('error', onLoaded);
        } catch {}
      });
    };
  }, [finalMessages]);

  // 切换会话后，等待一帧再滚到底，确保 DOM 更新完成
  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      try { el.scrollTop = el.scrollHeight; } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, [otherId]);

  // 视图刷新完成后也滚到底（收到新消息或SSE触发时）
  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    const timer = setTimeout(() => {
      try { el.scrollTop = el.scrollHeight; } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, [viewRecords]);

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
    refreshView();
  };

  // 新增：在 textarea 中支持 Shift+Enter 换行、Enter 发送
  const onInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // 直接调用发送
      const fakeEvent = { preventDefault: () => {} };
      handleSend(fakeEvent);
    }
    // Shift+Enter 默认行为换行，无需特殊处理
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
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      // 1) 上传文件，得到后端可访问的 URL
      const url = await uploadFile(file);

      // 2) 发送媒体消息
      const body = { type, mediaUrl: url, text: '' };
      const res = await fetch(`/api/messages/media/${otherId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify(body)
      });

      const j = await res.json().catch(() => null);
      if (j && j.code === 200 && j.data) {
        const dto = j.data;

        // 立即合并到详细 messages，避免“发送端不显示”
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
          // 按时间排序，确保位置正确
          next.sort((a, b) => {
            const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
            return ta - tb;
          });
          return next;
        });

        // 立即为视图追加占位记录，避免接收端首次渲染为空白
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

        // 滚动到底部
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
      // 保险：再拉一次视图，确保双方一致
      refreshView();
    }
  };

  const onPickImageClick = () => imageInputRef.current && imageInputRef.current.click();
  const onPickVideoClick = () => videoInputRef.current && videoInputRef.current.click();

  const reEditMessage = (msg) => {
    if (!msg || !msg.__originalText) return;
    setText(msg.__originalText);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const len = inputRef.current.value.length;
        try { inputRef.current.setSelectionRange(len, len); } catch {}
      }
    });
  };

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
    closeContextMenu();
    if (!messageId) return;
    try {
      const res = await fetch('/api/messages/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ messageId })
      });
      const j = await res.json().catch(() => null);
      if (j && (j.code === 200 || j.status === 200)) {
        // 记录到本地集合，并立即乐观置为撤回
        recalledLocalRef.current.add(normId(messageId));
        setViewRecords(prev => prev.map(r => (r && normId(r.id) === normId(messageId) ? { ...r, recalled: true } : r)));
        refreshView(); // 再拉一次视图
      } else {
        alert((j && (j.msg || j.message)) || '撤回失败');
      }
    } catch (e) {
      console.error(e);
      alert('网络错误');
    }
  };

  const deleteMessage = async (messageId) => {
    closeContextMenu();
    if (!messageId) return;
    try {
      const res = await fetch('/api/messages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ messageId })
      });
      const j = await res.json().catch(() => null);
      if (j && (j.code === 200 || j.status === 200)) {
        // 乐观更新：从当前用户视图移除
        setViewRecords(prev => prev.filter(r => r && r.id !== messageId));
        refreshView();
      } else {
        alert((j && (j.msg || j.message)) || '删除失败');
      }
    } catch (e) {
      console.error(e);
      alert('网络错误');
    }
  };

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
      const delta = startY - mv.clientY; // 向上拖动增加高度
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

// 监听全局私信事件（由 BannerNavbar 派发的 pm-event），即时刷新当前会话
  useEffect(() => {
    if (!userId) return;

    const onPm = (ev) => {
      const data = ev?.detail || {};
      const me = Number(userId);
      const partnerId = String(me === Number(data.receiverId) ? data.senderId : data.receiverId);

      // 无论来自谁，都刷新左侧列表（红点等）
      fetch('/api/messages/conversation/list', { headers: { 'X-User-Id': userId } })
        .then(r => r.json())
        .then(j => { if (j && j.code === 200 && j.data?.list) setConversations(j.data.list); })
        .catch(() => {});

      // 当前会话：刷新视图 + 拉详细消息，避免接收端“空白来信”
      if (String(partnerId) === String(otherId)) {
        refreshView();
        fetch(`/api/messages/conversation/${otherId}`, { headers: { 'X-User-Id': userId } })
          .then(r => r.json())
          .then(j => {
            if (j && j.code === 200 && j.data?.list) {
              setMessages(prev => mergeMessages(prev, j.data.list));
              requestAnimationFrame(() => {
                const el = rightScrollRef.current;
                if (el) el.scrollTop = el.scrollHeight;
              });
            }
          })
          .catch(() => {});
        // 我在此会话，立刻清零未读
        markReadCurrent();
      }
    };

    window.addEventListener('pm-event', onPm);
    return () => window.removeEventListener('pm-event', onPm);
  }, [userId, otherId, refreshView, markReadCurrent]);

  return (
    <div className="conversation-detail-page">
      <BannerNavbar />
      <div
        className="conversation-detail-container two-columns"
        style={{ '--input-height': `${inputHeight}px` }}  // 让 CSS 使用当前高度
      >
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
              {c.unreadCount > 0 && (
                <span className="conversation-sidebar-badge" title={`未读 ${c.unreadCount}`}>
                  {c.unreadCount > 99 ? '99+' : c.unreadCount}
                </span>
              )}
            </button>
          ))}
        </aside>

        {/* 右侧：会话消息栏，仅自身滚动 */}
        <div
          className="conversation-detail-list"
          ref={rightScrollRef}
          style={{ '--input-height': inputHeight + 'px' }}  
        >
          {finalMessages.map(msg => {
            const isSelf = msg.senderId === Number(userId);
            const recalled = !!msg.__recalled;

            if (recalled) {
              // 撤回提示：发送方显示“重新编辑”，双方都显示小×删除
              return (
                <div className="conversation-detail-recall" key={msg.id}>
                  <span className="txt">{isSelf ? '你撤回了一条消息' : '对方撤回了一条消息'}</span>
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
                    src={msg.senderAvatarUrl || otherInfo.avatarUrl || '/imgs/loginandwelcomepanel/1.png'}
                    alt="avatar"
                    className={`conversation-detail-msg-avatar${!isSelf ? ' clickable' : ''}`}
                    title={!isSelf ? '查看主页' : undefined}   // ← 新增：悬停提示
                    onClick={!isSelf ? () => openProfile(msg.senderId) : undefined}
                    onError={(e) => { e.target.onerror = null; e.target.src = '/imgs/loginandwelcomepanel/1.png'; }}
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
                      onError={(e) => { e.target.onerror = null; e.target.src = ''; }}
                    />
                  ) : msg?.type === 'VIDEO' && msg?.mediaUrl ? (
                    <video className="conversation-detail-msgmedia" src={toAbsUrl(msg.mediaUrl)} controls />
                  ) : (
                    msg?.text || (msg?.type === 'IMAGE' ? '[图片]' : msg?.type === 'VIDEO' ? '[视频]' : '')
                  )}
                </div>

                <div className="conversation-detail-msgtime">
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}
                </div>
              </div>
            );
          })}
        </div>

        {/* 表单：输入栏新结构（图标 + 可拉伸 textarea + 发送按钮） */}
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

        {/* 上传进度条 */}
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
          {(menu.msg.senderId === Number(userId))
            && !menu.msg.__recalled
            && Number.isFinite(new Date(menu.msg.createdAt).getTime())
            && (Date.now() - new Date(menu.msg.createdAt).getTime() <= 2 * 60 * 1000) && (
            <button onClick={() => recallMessage(menu.msg.id)}>撤回</button>
          )}
          <button onClick={() => deleteMessage(menu.msg.id)}>删除</button>
        </div>
      )}
    </div>
  );
}
