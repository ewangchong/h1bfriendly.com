'use client';

import { useEffect, useMemo, useState } from 'react';

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

type ChatStatus = {
  enabled: boolean;
  model?: string;
  rate_limit_per_min?: number;
};

type ChatClientProps = {
  mode?: 'page' | 'modal';
  onClose?: () => void;
};

export default function ChatClient({ mode = 'page', onClose }: ChatClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Hi! I am your H1B data assistant. Ask me about sponsor trends, approvals, salary benchmarks, or company-title patterns.',
    },
  ]);
  const [input, setInput] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [chatStatus, setChatStatus] = useState<ChatStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const res = await fetch('/api/v1/chat/status', {
          headers: { Accept: 'application/json' },
        });
        const payload = await res.json();

        if (!res.ok || !payload?.success) {
          throw new Error(payload?.message || 'Failed to load chat status');
        }

        if (!cancelled) {
          setChatStatus(payload.data);
          if (!payload.data?.enabled) {
            setError('Chat is currently disabled on this server. Set GEMINI_API_KEY in the backend environment and restart the backend container.');
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load chat status.');
        }
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading && !statusLoading && chatStatus?.enabled === true,
    [chatStatus?.enabled, input, loading, statusLoading]
  );

  async function onSend() {
    const text = input.trim();
    if (!text || loading || chatStatus?.enabled !== true) return;

    const nextMessages = [...messages, { role: 'user' as const, text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          year: year ? Number(year) : undefined,
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Chat request failed');
      }

      const answer = payload?.data?.answer;
      if (!answer) throw new Error('Empty answer from assistant');

      setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    } catch (e: any) {
      const message = e?.message || 'Something went wrong.';
      if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota') || message.includes('billing')) {
        setError(`Gemini API is configured but unavailable: ${message}`);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  const isModal = mode === 'modal';

  return (
    <div className={isModal ? 'chat-shell chat-shell-modal' : 'chat-shell'}>
      <div className="chat-head">
        <div>
          <h1 className="chat-title">{isModal ? 'AI Chat' : 'H1B AI Chatbot'}</h1>
          <p className="chat-subtitle">
            Ask questions in English. The bot answers using H1B dataset-backed context.
          </p>
        </div>
        {isModal && onClose ? (
          <button type="button" onClick={onClose} className="chat-close" aria-label="Close chat">
            Close
          </button>
        ) : null}
      </div>

      {statusLoading ? (
        <p className="chat-meta">Checking chat availability...</p>
      ) : chatStatus?.enabled ? (
        <p className="chat-meta">
          Model: {chatStatus.model} {chatStatus.rate_limit_per_min ? `· Rate limit: ${chatStatus.rate_limit_per_min}/min` : ''}
        </p>
      ) : (
        <p className="chat-meta chat-meta-error">
          Chat is disabled on this server until `GEMINI_API_KEY` is configured for the backend.
        </p>
      )}

      <div className="chat-toolbar">
        <label htmlFor={isModal ? 'chat-year-modal' : 'chat-year'} className="chat-label">Fiscal Year</label>
        <input
          id={isModal ? 'chat-year-modal' : 'chat-year'}
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          placeholder="e.g. 2025"
          className="chat-year-input"
        />
      </div>

      <div className={`chat-messages ${isModal ? 'chat-messages-modal' : ''}`}>
        <div className="chat-message-list">
          {messages.map((m, idx) => (
            <div
              key={`${idx}-${m.role}`}
              className={m.role === 'user' ? 'chat-bubble chat-bubble-user' : 'chat-bubble chat-bubble-assistant'}
            >
              {m.text}
            </div>
          ))}
          {loading ? <div className="chat-thinking">Thinking...</div> : null}
        </div>
      </div>

      <div className="chat-compose">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={chatStatus?.enabled === false ? 'Chat is disabled on this server.' : 'Ask anything about H1B sponsor data...'}
          rows={isModal ? 4 : 3}
          className="chat-textarea"
          disabled={chatStatus?.enabled === false || statusLoading}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void onSend();
            }
          }}
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void onSend()}
          className="chat-send"
        >
          {statusLoading ? 'Checking...' : 'Send'}
        </button>
      </div>

      <div className="chat-tip">Tip: press Ctrl/Cmd + Enter to send.</div>

      {error ? <div className="chat-error">{error}</div> : null}
    </div>
  );
}
