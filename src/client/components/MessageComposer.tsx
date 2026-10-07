import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AlertCircle, RotateCcw, Lock } from 'lucide-react';
import type { IConversation } from '../../shared/types.js';

interface MessageComposerProps {
  conversation: IConversation;
  onSendMessage: (text: string) => Promise<void>;
  onReopenConversation: () => Promise<void>;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  conversation,
  onSendMessage,
  onReopenConversation,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  useEffect(() => {
    setErrorMessage(null);
    if (conversation.mode !== 'CLOSED' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [conversation.id, conversation.mode]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    if (conversation.mode === 'CLOSED') return;

    setSending(true);
    setErrorMessage(null);

    try {
      await onSendMessage(text.trim());
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (conversation.mode === 'CLOSED') {
    return (
      <div className="p-3 bg-slate-100 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-xs text-slate-700 font-bold uppercase">
          <Lock className="w-3.5 h-3.5 text-black stroke-[2.5]" />
          <span>CONVERSATION IS CLOSED</span>
        </div>
        <button
          onClick={onReopenConversation}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase border border-black brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
        >
          <RotateCcw className="w-3 h-3 stroke-[2.5]" />
          <span>REOPEN TO REPLY</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 bg-white border-t-2 border-black">
      {errorMessage && (
        <div className="mb-2 flex items-center justify-between px-3 py-1.5 bg-rose-50 border border-black text-rose-950 font-mono text-xs">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
            <span className="truncate">{errorMessage}</span>
          </div>
          <button
            onClick={handleSend}
            disabled={sending}
            className="font-bold underline uppercase ml-2 text-rose-800"
          >
            RETRY
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 bg-slate-50 border-2 border-black focus-within:border-blue-600 focus-within:bg-white brutal-shadow-sm transition-all flex flex-col">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Reply to ${conversation.display_name}... (Enter to send, Shift+Enter for newline)`}
            rows={1}
            disabled={sending}
            className="w-full resize-none bg-transparent p-2 text-xs font-mono text-black placeholder:text-slate-400 focus:outline-hidden max-h-32 disabled:opacity-50"
          />
          <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-mono text-slate-500 select-none">
            <span>Shift+Enter for newline</span>
            <span className="font-bold text-blue-700 bg-blue-50 px-1 border border-blue-200">
              SIGNATURE: -ck
            </span>
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase border-2 border-black brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 shrink-0 flex items-center gap-1.5 self-stretch justify-center"
          title="Send message to Telegram"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
          ) : (
            <>
              <span className="hidden sm:inline">SEND</span>
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
