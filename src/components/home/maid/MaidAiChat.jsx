import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

export default function MaidAiChat({ visible, onClose }) {
  const [messages, setMessages] = useState([]); // {role: 'user'|'assistant', text}
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    // greet message
    setMessages((m) => {
      if (m.length === 0) return [{ role: 'assistant', text: '你好，我是你的看板娘 AI 助手，有什么可以帮忙的吗？' }];
      return m;
    });
  }, [visible]);

  useEffect(() => {
    // scroll to bottom on new message
    const el = listRef.current;
    if (!el) return;
    try {
      // guard against environments where element may not support these props
      if (typeof el.scrollTop === 'number' && typeof el.scrollHeight === 'number') {
        el.scrollTop = el.scrollHeight;
      } else if (typeof el.scrollTo === 'function') {
        el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
      }
    } catch (err) {
      // Log the error to help debugging instead of silently swallowing it
      // (Avoid throwing to keep UI resilient)
      console.warn('MaidAiChat: failed to scroll messages', err);
    }
  }, [messages]);

  const send = async () => {
    const t = String(text || '').trim();
    if (!t) return;
    setSending(true);
    setError('');
    setMessages((m) => [...m, { role: 'user', text: t }]);
    setText('');
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: t }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`请求失败 ${res.status}: ${txt}`);
      }
      const data = await res.json();
      // Normalize reply: backend may return a string in data.reply or a structured object.
      const raw = data?.reply ?? data;
      let replyText = '';
      if (raw == null) {
        replyText = '';
      } else if (typeof raw === 'string') {
        replyText = raw;
      } else if (typeof raw === 'object') {
        // Try common shapes: OpenAI-compatible responses
        try {
          const choices = raw.choices || raw.result || raw.outputs;
          if (Array.isArray(choices) && choices.length > 0) {
            const first = choices[0];
            if (first?.message?.content) replyText = first.message.content;
            else if (first?.text) replyText = first.text;
            else if (first?.content) replyText = first.content;
            else replyText = JSON.stringify(raw);
          } else if (raw?.message && typeof raw.message === 'string') {
            replyText = raw.message;
          } else if (raw?.content && typeof raw.content === 'string') {
            replyText = raw.content;
          } else {
            replyText = JSON.stringify(raw);
          }
        } catch {
          replyText = String(raw);
        }
      } else {
        replyText = String(raw);
      }
      setMessages((m) => [...m, { role: 'assistant', text: replyText }]);
    } catch (e) {
      console.error(e);
      setError(e?.message || '发送失败');
      setMessages((m) => [...m, { role: 'assistant', text: '抱歉，出错了：' + (e?.message || '') }]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  if (!visible) return null;

  return (
    <div className="maid-ai-panel" role="dialog" aria-label="看板娘 AI 助手">
      <div className="maid-ai-header">
        <strong>看板娘 AI 助手</strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {sending && <span className="maid-ai-sending">发送中…</span>}
          <button className="maid-iconbtn" onClick={onClose} title="关闭助手">关闭</button>
        </div>
      </div>
      <div className="maid-ai-messages" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`maid-ai-msg ${m.role === 'user' ? 'user' : 'assistant'}`}>
            <div className="maid-ai-msg-text">
              {/* Render message as Markdown so code blocks render nicely */}
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{String(m.text || '')}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
      <div className="maid-ai-input-row">
        <textarea
          className="maid-ai-input"
          placeholder="向看板娘提问，按 Enter 发送（Shift+Enter 换行）"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
        />
        <button className="maid-iconbtn" onClick={() => void send()} disabled={sending || !text.trim()} title="发送">发送</button>
      </div>
      {error && <div className="maid-ai-error">{error}</div>}
    </div>
  );
}
