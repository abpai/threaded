import React, { useRef, useEffect, useState } from 'react';
import { Send, X, Bot, User, Sparkles, ChevronLeft } from 'lucide-react';
import { Thread } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';

interface ThreadPanelProps {
  thread: Thread | null;
  isLoading: boolean;
  onClose: () => void;
  onBack: () => void;
  onSendMessage: (text: string) => void;
}

const ThreadPanel: React.FC<ThreadPanelProps> = ({ thread, isLoading, onClose, onBack, onSendMessage }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [thread?.messages, isLoading]);

  useEffect(() => {
    if (thread?.id) {
        // Focus input when a new thread is selected/created
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [thread?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue);
    setInputValue('');
  };

  if (!thread) {
    return null;
  }

  const isGeneralThread = thread.context === 'Entire Document';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 sticky top-0">
        <div className="flex items-center gap-3">
            <button 
                onClick={onBack}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors group"
                title="Back to all threads"
            >
                <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">Thread</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                    {isGeneralThread ? 'General Discussion' : `Re: ${thread.snippet}`}
                </p>
            </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 dark:bg-slate-950/50">
        {/* Context Card - Only show if not a general thread */}
        {!isGeneralThread && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-sm text-sm relative">
                <div className="absolute -left-3 top-4 w-3 h-px bg-slate-200 dark:bg-slate-700"></div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Selected Context</p>
                <blockquote className="text-slate-600 dark:text-slate-300 italic border-l-2 border-blue-400 pl-3">
                    "{thread.context}"
                </blockquote>
            </div>
        )}

        {thread.messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed shadow-sm overflow-hidden ${
              msg.role === 'user' 
                ? 'bg-slate-800 dark:bg-slate-700 text-white rounded-tr-none' 
                : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-none markdown-chat'
            }`}>
                {msg.role === 'user' ? (
                    msg.text
                ) : (
                    <div className="markdown-content !text-sm">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex, rehypeHighlight]}
                      >
                          {msg.text}
                      </ReactMarkdown>
                    </div>
                )}
            </div>
          </div>
        ))}
        
        {isLoading && (
           <div className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles size={16} />
             </div>
             <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms'}}></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isGeneralThread ? "Ask about the document..." : "Ask a follow-up..."}
            className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ThreadPanel;