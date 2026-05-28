'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Zap, Sparkles, ChevronRight, Copy, Check, RefreshCw } from 'lucide-react';
import { useGame } from '../components/GameContext';
import { LowXpAlert } from '@/components/LowXpAlert';
import { getXpCost } from '@/lib/gamification/xp-costs';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  xpGain?: number;
  timestamp: Date;
}

const quickActions = [
  { label: 'Improve my ATS score' },
  { label: 'What skills should I learn?' },
  { label: 'What salary can I expect?' },
  { label: 'Build my roadmap' },
];

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  // Process **bold**, *italic*, and `code` inline.
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Italic: *text* (not preceded by another *)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    // Code: `text`
    const codeMatch = remaining.match(/`([^`]+)`/);

    const candidates = [
      boldMatch ? { idx: boldMatch.index!, len: boldMatch[0].length, type: 'bold', inner: boldMatch[1] } : null,
      italicMatch ? { idx: italicMatch.index!, len: italicMatch[0].length, type: 'italic', inner: italicMatch[1] } : null,
      codeMatch ? { idx: codeMatch.index!, len: codeMatch[0].length, type: 'code', inner: codeMatch[1] } : null,
    ].filter(Boolean) as { idx: number; len: number; type: string; inner: string }[];

    if (candidates.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = candidates.reduce((a, b) => (a.idx <= b.idx ? a : b));

    if (first.idx > 0) {
      parts.push(remaining.slice(0, first.idx));
    }

    if (first.type === 'bold') {
      parts.push(<strong key={key++} style={{ fontWeight: 700, color: 'var(--cp-text-primary)' }}>{first.inner}</strong>);
    } else if (first.type === 'italic') {
      parts.push(<em key={key++} style={{ fontStyle: 'italic' }}>{first.inner}</em>);
    } else {
      parts.push(
        <code key={key++} style={{
          background: 'rgba(124,58,237,0.18)',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: '4px',
          padding: '1px 5px',
          fontFamily: 'monospace',
          fontSize: '0.82em',
          color: '#c4b5fd',
        }}>
          {first.inner}
        </code>
      );
    }

    remaining = remaining.slice(first.idx + first.len);
  }

  return parts;
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let listBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let blockCodeBuffer: string[] = [];
  let inCodeBlock = false;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    elements.push(
      <Tag key={`list-${i}`} style={{ margin: '4px 0 6px', paddingLeft: '1.4em' }}>
        {listBuffer.map((item, idx) => (
          <li key={idx} style={{ margin: '2px 0', color: 'var(--cp-text-primary)', fontSize: '0.875rem', lineHeight: 1.55 }}>
            {renderInline(item)}
          </li>
        ))}
      </Tag>
    );
    listBuffer = [];
    listType = null;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        blockCodeBuffer = [];
        i++;
        continue;
      } else {
        inCodeBlock = false;
        const codeText = blockCodeBuffer.join('\n');
        elements.push(
          <pre key={`code-${i}`} className="cp-code-block" style={{ margin: '6px 0' }}>
            <code>{codeText}</code>
          </pre>
        );
        i++;
        continue;
      }
    }

    if (inCodeBlock) {
      blockCodeBuffer.push(line);
      i++;
      continue;
    }

    // Headings
    if (/^#{1,3}\s/.test(line)) {
      flushList();
      const lvl = line.match(/^(#{1,3})/)?.[1].length ?? 1;
      const text = line.replace(/^#{1,3}\s+/, '');
      const sizes = ['1.05rem', '0.95rem', '0.88rem'];
      elements.push(
        <p key={`h-${i}`} style={{
          color: 'var(--cp-text-primary)',
          fontWeight: 700,
          fontSize: sizes[lvl - 1] ?? '1rem',
          margin: `${lvl === 1 ? '10' : '6'}px 0 3px`,
          letterSpacing: '-0.01em',
        }}>
          {renderInline(text)}
        </p>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushList();
      elements.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid var(--cp-border)', margin: '8px 0' }} />);
      i++;
      continue;
    }

    // Unordered list item
    const ulMatch = line.match(/^[-*+]\s+(.*)/);
    if (ulMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listBuffer.push(ulMatch[1]);
      i++;
      continue;
    }

    // Ordered list item
    const olMatch = line.match(/^\d+\.\s+(.*)/);
    if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listBuffer.push(olMatch[1]);
      i++;
      continue;
    }

    // Normal paragraph / blank
    flushList();
    if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} style={{ height: '5px' }} />);
    } else {
      elements.push(
        <p key={`p-${i}`} style={{ margin: '2px 0', color: 'var(--cp-text-primary)', fontSize: '0.875rem', lineHeight: 1.55 }}>
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }

  flushList();
  return <div>{elements}</div>;
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy response"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px 4px',
        borderRadius: '6px',
        opacity: 0.55,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.55')}
    >
      {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} color="var(--cp-text-muted)" />}
    </button>
  );
}

// ─── Mentor component ─────────────────────────────────────────────────────────

export function Mentor() {
  const { user, xp, level, levelName, streak, refresh } = useGame();
  const mentorXpCost = getXpCost('AI_MENTOR');
  const [xpError, setXpError] = useState<{ required?: number; balance?: number; suggestions?: string[] } | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      content: `Hey ${user.name}! 👋 I'm your **Elevate Mentor** — I know your profile inside out.\n\nYou're a **${user.currentRole || 'professional'}** with ${user.experience || 'some'} of experience, targeting **${user.targetRole || 'your next role'}**. You're at Level ${level} (${levelName}) with ${xp} XP and a 🔥 ${streak}-day streak!\n\nI'm here to accelerate your career. What would you like to work on today?`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastAiMsgId, setLastAiMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!user.email?.trim()) return;

    void (async () => {
      try {
        const convRes = await fetch('/api/v1/ai/mentor/conversations', { credentials: 'include' });
        const convJson = await convRes.json().catch(() => ({}));
        if (!convRes.ok) return;

        const conversations = convJson?.data?.conversations;
        const firstConvId = Array.isArray(conversations) && conversations.length
          ? conversations[0]?.conversationId
          : null;

        if (!firstConvId) return;
        setConversationId(firstConvId);

        const msgsRes = await fetch(`/api/v1/ai/mentor/conversations/${firstConvId}/messages`, { credentials: 'include' });
        const msgsJson = await msgsRes.json().catch(() => ({}));
        if (!msgsRes.ok) return;

        const msgs = Array.isArray(msgsJson?.data?.messages) ? msgsJson.data.messages : [];
        if (msgs.length === 0) return;

        setMessages(
          msgs.map((m: Record<string, unknown>) => ({
            id: String(m.id),
            role: m.role === 'assistant' ? 'ai' : 'user',
            content: String(m.content ?? ''),
            timestamp: new Date(String(m.createdAt)),
          })),
        );
      } catch {
        // Non-fatal: keep default greeting.
      }
    })();
  }, [user.email]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isTyping) return;

    const userText = content.trim();
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: userText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setXpError(null);

    try {
      const res = await fetch('/api/v1/ai/mentor/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: userText, conversationId: conversationId ?? undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error((json as { message?: string })?.message || 'Mentor request failed') as Error & {
          code?: string;
          details?: { required?: number; balance?: number; suggestions?: string[] };
        };
        err.code = (json as { code?: string })?.code;
        err.details = (json as { details?: { required?: number; balance?: number; suggestions?: string[] } })?.details;
        throw err;
      }

      const assistant = (json as { data?: { message?: { id?: unknown; content?: unknown }; conversationId?: string } })?.data?.message;
      const newConversationId = (json as { data?: { conversationId?: string } })?.data?.conversationId;

      if (newConversationId) setConversationId(newConversationId);

      const aiId = String(assistant?.id ?? Date.now() + 1);
      const aiMsg: Message | null = assistant?.content
        ? {
          id: aiId,
          role: 'ai',
          content: String(assistant.content ?? ''),
          timestamp: new Date(),
        }
        : null;

      if (aiMsg) {
        setMessages(prev => [...prev, aiMsg]);
        setLastAiMsgId(aiId);
        void refresh({ silent: true });
      }
    } catch (err) {
      const e = err as Error & { code?: string; details?: { required?: number; balance?: number; suggestions?: string[] } };
      if (e.code === 'INSUFFICIENT_XP' && e.details) {
        setXpError(e.details);
      }
      const msg = e.message || 'Mentor request failed';
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: 'ai',
          content: `Sorry — ${msg}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, conversationId, refresh]);

  const regenerate = useCallback(() => {
    // Find the last user message and re-send it
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    // Remove the last AI response so we can regenerate
    setMessages(prev => {
      const idx = [...prev].reverse().findIndex(m => m.role === 'ai');
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.slice(0, realIdx);
    });
    void sendMessage(lastUser.content);
  }, [messages, sendMessage]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="app-page flex flex-col" style={{ fontFamily: "'Space Grotesk', sans-serif", height: 'calc(100dvh - 64px)' }}>
      {/* Header */}
      <div className="section-pad pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center glow-purple"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
              <span style={{ fontSize: '1.4rem' }}>🤖</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 bg-green-400"
              style={{ borderColor: 'var(--cp-bg-base)' }} />
          </div>
          <div>
            <h1 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>Elevate Mentor</h1>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span style={{ color: '#10b981', fontSize: '0.75rem' }}>Active & personalized</span>
            </div>
          </div>
          <div className="ml-auto glass-card rounded-xl px-3 py-1.5 flex items-center gap-1.5">
            <Sparkles size={13} color="#a78bfa" />
            <span style={{ color: '#a78bfa', fontSize: '0.75rem', fontWeight: 600 }}>Gemini</span>
          </div>
        </div>

        {/* Mentor stats */}
        <div className="flex gap-2 mt-3">
          {[
            { label: 'Career IQ', value: '847', color: '#7c3aed' },
            { label: 'Conversations', value: String(Math.max(messages.filter(m => m.role === 'user').length, 1)), color: '#06b6d4' },
            { label: 'XP via Elevate', value: `${xp}`, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} className="flex-1 glass-card rounded-xl px-2 py-2 text-center">
              <div style={{ color: s.color, fontWeight: 700, fontSize: '0.9rem' }}>{s.value}</div>
              <div style={{ color: 'var(--cp-text-faint)', fontSize: '0.6rem' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto section-pad" style={{ paddingBottom: '40px' }}>
        <div className="space-y-4 pb-2">
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 15, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 self-end"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                    <span style={{ fontSize: '0.9rem' }}>🤖</span>
                  </div>
                )}

                <div style={{ maxWidth: '82%' }}>
                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                        : 'var(--cp-bg-elevated)',
                      border: msg.role === 'ai' ? '1px solid var(--cp-border)' : 'none',
                      color: 'var(--cp-text-primary)',
                      lineHeight: '1.55',
                    }}
                  >
                    {msg.role === 'ai'
                      ? <MarkdownMessage content={msg.content} />
                      : <p style={{ margin: 0, fontSize: '0.875rem' }}>{msg.content}</p>
                    }
                  </div>

                  {/* Metadata row */}
                  <div className={`flex items-center gap-2 mt-1 ${msg.role === 'user' ? 'justify-end mr-1' : 'ml-1'}`}>
                    <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.62rem' }}>
                      {formatTime(msg.timestamp)}
                    </span>
                    {msg.role === 'ai' && msg.xpGain && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex items-center gap-1"
                      >
                        <Zap size={10} color="#f59e0b" />
                        <span style={{ color: '#f59e0b', fontSize: '0.62rem', fontWeight: 600 }}>+{msg.xpGain} XP</span>
                      </motion.div>
                    )}
                    {msg.role === 'ai' && <CopyButton text={msg.content} />}
                    {msg.role === 'ai' && msg.id === lastAiMsgId && (
                      <button
                        onClick={regenerate}
                        disabled={isTyping}
                        title="Regenerate response"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '6px',
                          opacity: isTyping ? 0.3 : 0.55,
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => { if (!isTyping) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.55')}
                      >
                        <RefreshCw size={13} color="var(--cp-text-muted)" />
                      </button>
                    )}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 self-end"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
                    <span style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem' }}>
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}

            {isTyping && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                  <span style={{ fontSize: '0.9rem' }}>🤖</span>
                </div>
                <div className="rounded-2xl px-4 py-3 flex items-center gap-1.5"
                  style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)' }}>
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.55, repeat: Infinity, delay: i * 0.14 }}
                      className="w-2 h-2 rounded-full"
                      style={{ background: '#7c3aed' }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick actions */}
      {messages.length < 3 && (
        <div className="section-pad mb-3 shrink-0">
          <div className="flex flex-wrap gap-2">
            {quickActions.map(action => (
              <button
                key={action.label}
                onClick={() => void sendMessage(action.label)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', color: '#a78bfa', cursor: 'pointer' }}
              >
                {action.label}
                <ChevronRight size={13} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input — extra bottom padding for mobile nav + safe area */}
      <div
        className="section-pad shrink-0"
        style={{
          position: 'sticky',
          // bottom: '0.3rem',
          width: '95%',
          margin: '0 auto',
        }}
      >
        {xpError && <LowXpAlert {...xpError} className="mb-3" />}
        <div className="flex gap-3 rounded-2xl p-2"
          style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="Ask your Elevate Mentor anything... (Shift+Enter for newline)"
            rows={1}
            className="flex-1 outline-none bg-transparent px-2 py-1.5 resize-none"
            style={{ color: 'var(--cp-text-primary)', fontSize: '0.9rem', lineHeight: 1.5, maxHeight: '120px', overflowY: 'auto' }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <motion.button
            onClick={() => void sendMessage(input)}
            whileTap={{ scale: 0.88 }}
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 self-end"
            style={{
              background: input.trim() && !isTyping ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.06)',
              border: 'none',
              cursor: input.trim() && !isTyping ? 'pointer' : 'default',
            }}
          >
            <Send size={17} color={input.trim() && !isTyping ? 'white' : '#475569'} />
          </motion.button>
        </div>
        <p style={{ color: 'var(--cp-text-faint)', fontSize: '0.68rem', textAlign: 'center', marginTop: '6px' }}>
          ⚡ Each message costs −{mentorXpCost} XP · Powered by Gemini
        </p>
      </div>
    </div>
  );
}
