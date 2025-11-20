import React, { useEffect, useMemo, useState } from "react";
import "./styles/messagepanel/messagepanel.css";

/**
 * MessagePanel
 * - 展示 targetUserId 的留言列表（仅最近20条，按时间倒序）
 * - 当前登录用户（localStorage.userId）可写留言；若未登录，以匿名身份留言
 *
 * Props:
 * - targetUserId: number (必需)
 * - maxLength?: number = 500
 * - className?: string
 * - style?: React.CSSProperties
 */
export default function MessagePanel({ targetUserId, maxLength = 500, className = "", style = {} }) {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");

  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState("");
  // 上半部分留言列表展开/收起，默认收起
  const [expanded, setExpanded] = useState(false);

  const [me, setMe] = useState({ nickname: "匿名用户", avatarUrl: "" });

  const userId = useMemo(() => {
    try { return localStorage.getItem("userId"); } catch { return null; }
  }, []);

  // 获取当前登录用户的基本信息（昵称/头像）
  useEffect(() => {
    let alive = true;
    async function fetchMe() {
      if (!userId) return; // 未登录，维持匿名
      try {
        const res = await fetch(`/api/user/profile/${userId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        const nickname = data?.nickname || "匿名用户";
        const avatarUrl = data?.avatarUrl || "";
        setMe({ nickname, avatarUrl });
      } catch {}
    }
    fetchMe();
    return () => { alive = false; };
  }, [userId]);

  // 拉取留言列表（仅最近20条，后端已限制，前端再兜底）
  useEffect(() => {
    let alive = true;
    async function loadMessages() {
      setLoading(true);
      setError("");
      try {
        if (!targetUserId) { setMessages([]); return; }
        const res = await fetch(`/api/message/list?targetUserId=${encodeURIComponent(targetUserId)}`);
        if (!res.ok) {
          setError("留言加载失败");
          setMessages([]);
        } else {
          const json = await res.json();
          const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
          if (!alive) return;
          // 兜底：保证倒序并截取 20 条
          const normalized = list
            .filter(Boolean)
            .sort((a,b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime())
            .slice(0, 20);
          setMessages(normalized);
        }
      } catch (e) {
        if (alive) {
          setError("留言加载失败");
          setMessages([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadMessages();
    return () => { alive = false; };
  }, [targetUserId]);

  const remaining = Math.max(0, maxLength - content.length);
  const canSend = !posting && content.trim().length > 0 && content.length <= maxLength && !!targetUserId;

  const handleSubmit = async () => {
    if (!canSend) return;
    setPosting(true);
    setPostMsg("");
    try {
      const body = {
        targetUserId: Number(targetUserId),
        nickname: me.nickname || "匿名用户",
        avatarUrl: me.avatarUrl || "",
        content: content.trim(),
      };
      const res = await fetch("/api/message/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        setPostMsg("留言失败，请稍后重试");
      } else {
        const json = await res.json();
        const saved = json?.data || json;
        // 插入开头并截取 20 条
        setMessages(prev => [saved, ...prev].slice(0, 20));
        setContent("");
        setPostMsg("留言成功");
      }
    } catch (e) {
      setPostMsg("留言失败，请稍后重试");
    } finally {
      setPosting(false);
      window.clearTimeout((handleSubmit)._timer);
      (handleSubmit)._timer = window.setTimeout(() => setPostMsg(""), 2000);
    }
  };

  return (
    <div className={`messagepanel ${expanded ? "expanded" : "collapsed"} ${className}`} style={style}>
      <div className="messagepanel-header">
        <h3>留言板</h3>
      </div>

      {/* 主体：上部列表，下部输入（3:1） */}
      <div className="messagepanel-main">
        {/* 可折叠的留言展示区域 */}
        <div className="messagepanel-listwrap" aria-hidden={!expanded}>
          <div className="messagepanel-body">
          {loading && <div className="messagepanel-loading">加载中…</div>}
          {error && !loading && <div className="messagepanel-error">{error}</div>}
          {!loading && !error && messages.length === 0 && (
            <div className="messagepanel-empty">还没有留言，快来抢沙发吧～</div>
          )}
          {!loading && !error && messages.map(m => (
            <MessageItem key={m.id ?? `${m.nickname}-${m.createTime}-${Math.random()}` } msg={m} />
          ))}
          </div>
        </div>

        {/* 展开/收起开关 */}
        <div className="messagepanel-togglewrap">
          <button
            className={`messagepanel-toggle ${expanded ? "on" : "off"}`}
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            type="button"
          >
            {expanded ? "收起留言" : "展开留言"}
          </button>
        </div>

        <div className="messagepanel-compose">
          <div className="messagepanel-compose-avatar">
            {me.avatarUrl ? (
              <img src={me.avatarUrl} alt="avatar" loading="lazy" decoding="async" />
            ) : (
              <div className="messagepanel-avatar-placeholder" aria-hidden="true" />
            )}
          </div>
          <div className="messagepanel-compose-main">
            {/* 输入框容器：用于将字数提示叠加在白板右下角 */}
            <div className="messagepanel-compose-inputwrap">
              <textarea
                value={content}
                onChange={e => setContent(e.target.value.slice(0, maxLength))}
                placeholder="写点什么吧…"
                rows={3}
                maxLength={maxLength}
              />
              <span className={`messagepanel-counter-inbox${remaining < 20 ? " warn" : ""}`}>{remaining}</span>
            </div>
            <div className="messagepanel-compose-toolbar">
              <button className="messagepanel-send" disabled={!canSend} onClick={handleSubmit}>
                {posting ? "发送中…" : "写留言"}
              </button>
            </div>
            {postMsg && <div className="messagepanel-postmsg">{postMsg}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageItem({ msg }) {
  const timeLabel = (function formatTime(t){
    try {
      if (!t) return "";
      const d = new Date(t);
      if (!isNaN(d.getTime())) return d.toLocaleString();
      return String(t);
    } catch { return ""; }
  })(msg?.createTime);

  return (
    <div className="messagepanel-item">
      <div className="messagepanel-item-avatar">
        {msg?.avatarUrl ? (
          <img src={msg.avatarUrl} alt={msg?.nickname || "avatar"} loading="lazy" decoding="async" />
        ) : (
          <div className="messagepanel-avatar-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="messagepanel-item-main">
        {/* 顶部：昵称 */}
        <div className="messagepanel-item-meta">
          <span className="messagepanel-item-nickname">{msg?.nickname || "匿名用户"}</span>
        </div>
        {/* 中部：内容 */}
        <div className="messagepanel-item-content">{msg?.content || ""}</div>
        {/* 底部：时间 */}
        <div className="messagepanel-item-time">{timeLabel}</div>
      </div>
    </div>
  );
}
