import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { PenTool, LayoutTemplate, ArrowRight, MessageCircle, Moon, Sun, Download, Settings as SettingsIcon } from 'lucide-react';

import { Thread, TextSelection, ViewState, AppSettings } from './types';
import Tooltip from './components/Tooltip';
import ThreadPanel from './components/ThreadPanel';
import ThreadList from './components/ThreadList';
import SettingsModal from './components/SettingsModal';
import { generateThreadResponse } from './services/aiService';

// Default starter text if user doesn't paste anything
const DEFAULT_TEXT = `# The Future of Contextual Interfaces

The overnight success is a myth that has been thoroughly debunked over recent years, especially as it applies to tech. Knowing this, it’s still hard not to think of LLMs as an overnight success given how rapidly they spread throughout Silicon Valley.

**The Problem:** Turn-by-turn chat interfaces fundamentally limit how we work with AI. Real planning, learning, and decision-making isn't linear—it requires exploring multiple paths. Standard horizontal only chat forces you into a single timeline where context gets buried and alternative approaches are lost.

Here is an example of code that could be better visualized:

\`\`\`javascript
function calculateSuccess(effort, luck) {
  return effort * 0.8 + luck * 0.2;
}
\`\`\`

And a mathematical representation of the problem space:

$$
P(Success) = \\sum_{i=1}^{n} (Effort_i \\times Weight_i) + \\epsilon
$$

Unfortunately as these would-be founders quickly discovered, there’s a lot more to starting a community site than the idea and technical execution.

## A Better Way
Imagine a document-centric interface. You paste in a starting markdown text to kick-off a conversation. No LLM call is made on the initial setup paste but the pasted text becomes formatted like a beautiful article. 

You should be able to highlight text and bring up a tooltip to branch to a right panel and task a clarifying question. This preserves the original context while allowing for deep dives into specific topics without cluttering the main view.

This "branching" model mirrors how humans actually think: we hold a core idea in our head (the document) while briefly exploring tangents (the threads) before returning to the main flow.
`;

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'google',
  apiKey: process.env.API_KEY || '', // Fallback for demo
  modelId: 'gemini-1.5-flash',
};

const App: React.FC = () => {
  // --- State ---
  const [viewState, setViewState] = useState<ViewState>(ViewState.START);
  const [markdownContent, setMarkdownContent] = useState(DEFAULT_TEXT);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  
  // Appearance & UI State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  
  // Settings State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [generalInputValue, setGeneralInputValue] = useState('');
  
  // Refs
  const contentRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Load Settings from LocalStorage
  useEffect(() => {
    const storedSettings = localStorage.getItem('threaded-settings');
    if (storedSettings) {
      try {
        setSettings(JSON.parse(storedSettings));
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  // Save Settings to LocalStorage
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('threaded-settings', JSON.stringify(newSettings));
  };

  // Handle Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Handle Text Selection
  useEffect(() => {
    const handleSelectionChange = () => {
      if (viewState !== ViewState.READING) return;

      const currentSelection = window.getSelection();
      
      // Basic validation: Check if selection is within our content area
      if (
        !currentSelection || 
        currentSelection.isCollapsed || 
        !contentRef.current?.contains(currentSelection.anchorNode)
      ) {
         // Don't clear immediately to allow button clicks in tooltip
         // We handle clearing in onMouseDown of document
        return; 
      }

      const text = currentSelection.toString().trim();
      if (text.length > 0) {
        const range = currentSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelection({ text, rect });
      }
    };

    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange); // For keyboard selection

    return () => {
      document.removeEventListener('mouseup', handleSelectionChange);
      document.removeEventListener('keyup', handleSelectionChange);
    };
  }, [viewState]);

  // --- Handlers ---

  const handleStart = () => {
    if (markdownContent.trim()) {
      setViewState(ViewState.READING);
    }
  };

  const handleDocumentMouseDown = (e: React.MouseEvent) => {
    // If we click outside the tooltip, clear selection
    const target = e.target as HTMLElement;
    if (!target.closest('button') && !target.closest('input')) { 
       setSelection(null);
       window.getSelection()?.removeAllRanges();
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleExport = () => {
    let exportText = markdownContent + "\n\n# Discussions (Exported)\n\n";
    threads.forEach(t => {
      exportText += `## Thread: ${t.snippet}\n`;
      exportText += `> **Context**: ${t.context}\n\n`;
      t.messages.forEach(m => {
        exportText += `**${m.role === 'user' ? 'User' : 'AI'}**: ${m.text}\n\n`;
      });
      exportText += "---\n\n";
    });
    
    const blob = new Blob([exportText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threaded-export-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createThread = async (action: 'discuss' | 'summarize') => {
    if (!selection) return;

    const newThreadId = Date.now().toString();
    const snippet = selection.text.length > 30 
      ? selection.text.substring(0, 30) + '...' 
      : selection.text;
    
    if (action === 'discuss') {
      const newThread: Thread = {
        id: newThreadId,
        context: selection.text,
        messages: [], 
        createdAt: Date.now(),
        snippet
      };

      setThreads(prev => [...prev, newThread]);
      setActiveThreadId(newThreadId);
      setIsSidebarOpen(true);
      setSelection(null); 
      window.getSelection()?.removeAllRanges();
      return;
    }

    // For summarize
    const initialUserMessage = "Please explain this section in simple terms.";
    const newThread: Thread = {
      id: newThreadId,
      context: selection.text,
      messages: [
          { role: 'user', text: initialUserMessage, timestamp: Date.now() }
      ],
      createdAt: Date.now(),
      snippet
    };

    setThreads(prev => [...prev, newThread]);
    setActiveThreadId(newThreadId);
    setIsSidebarOpen(true);
    setSelection(null); 
    window.getSelection()?.removeAllRanges();

    setIsAiLoading(true);
    const aiResponse = await generateThreadResponse(
        newThread.context,
        markdownContent,
        newThread.messages,
        initialUserMessage,
        settings
    );

    setThreads(prev => prev.map(t => {
        if (t.id === newThreadId) {
            return {
                ...t,
                messages: [...t.messages, { role: 'model', text: aiResponse, timestamp: Date.now() }]
            };
        }
        return t;
    }));
    setIsAiLoading(false);
  };

  const handleCreateGeneralThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalInputValue.trim()) return;

    const initialMessage = generalInputValue;
    setGeneralInputValue(''); 

    const newThreadId = Date.now().toString();
    const newThread: Thread = {
        id: newThreadId,
        context: 'Entire Document',
        messages: [
            { role: 'user', text: initialMessage, timestamp: Date.now() }
        ],
        createdAt: Date.now(),
        snippet: 'General Discussion'
    };

    setThreads(prev => [...prev, newThread]);
    setActiveThreadId(newThreadId);
    setIsSidebarOpen(true);

    setIsAiLoading(true);
    const aiResponse = await generateThreadResponse(
        newThread.context,
        markdownContent,
        newThread.messages,
        initialMessage,
        settings
    );

    setThreads(prev => prev.map(t => {
        if (t.id === newThreadId) {
            return {
                ...t,
                messages: [...t.messages, { role: 'model', text: aiResponse, timestamp: Date.now() }]
            };
        }
        return t;
    }));
    setIsAiLoading(false);
  }

  const handleSendMessage = async (text: string) => {
    if (!activeThreadId) return;

    setThreads(prev => prev.map(t => {
        if (t.id === activeThreadId) {
            return {
                ...t,
                messages: [...t.messages, { role: 'user', text, timestamp: Date.now() }]
            };
        }
        return t;
    }));

    setIsAiLoading(true);
    
    const currentThread = threads.find(t => t.id === activeThreadId);
    if (!currentThread) return;

    const aiResponse = await generateThreadResponse(
        currentThread.context,
        markdownContent,
        [...currentThread.messages, { role: 'user', text, timestamp: Date.now() }],
        text,
        settings
    );

    setThreads(prev => prev.map(t => {
        if (t.id === activeThreadId) {
            return {
                ...t,
                messages: [...t.messages, { role: 'model', text: aiResponse, timestamp: Date.now() }]
            };
        }
        return t;
    }));
    setIsAiLoading(false);
  };

  const handleViewThreadList = () => {
    setActiveThreadId(null);
    setIsSidebarOpen(true);
  };

  // --- Render ---

  if (viewState === ViewState.START) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
         <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors">
                <SettingsIcon size={20} />
            </button>
            <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
         </div>
        
        <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-600 p-3 rounded-xl text-white">
                <LayoutTemplate size={24} />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-serif">Threaded Reader</h1>
                <p className="text-slate-500 dark:text-slate-400">Contextual AI analysis for your documents.</p>
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Paste your Markdown content here
            </label>
            <textarea
              className="w-full h-64 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm resize-none"
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              placeholder="# Enter your markdown here..."
            />
          </div>

          <button
            onClick={handleStart}
            disabled={!markdownContent.trim()}
            className="w-full py-4 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Start Reading</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <p className="mt-6 text-slate-400 dark:text-slate-600 text-sm">
          Powered by {settings.provider.charAt(0).toUpperCase() + settings.provider.slice(1)}
        </p>

        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentSettings={settings}
          onSave={handleSaveSettings}
        />
      </div>
    );
  }

  const activeThread = threads.find(t => t.id === activeThreadId) || null;

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-300">
      {/* Left Pane: Document View Container */}
      <div 
        className={`flex-1 h-full relative flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-1/2' : 'w-full'}`}
        onMouseDown={handleDocumentMouseDown}
      >
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto w-full">
            <div className="max-w-[720px] mx-auto px-8 py-16">
            <header className="mb-12 flex items-center justify-between sticky top-0 z-10 py-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm -mx-4 px-4">
                <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors" onClick={() => setViewState(ViewState.START)}>
                        <PenTool size={16} />
                        <span className="text-sm font-medium">Edit Source</span>
                    </div>
                     <div className="flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors" onClick={handleExport}>
                        <Download size={16} />
                        <span className="text-sm font-medium">Export</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                     <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors" title="Settings">
                        <SettingsIcon size={18} />
                    </button>
                    <button onClick={toggleDarkMode} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors">
                        {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    </button>

                    {threads.length > 0 && (
                        <button 
                        onClick={handleViewThreadList}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full font-medium transition-colors"
                        >
                            {threads.length} active threads
                        </button>
                    )}
                </div>
            </header>

            <div ref={contentRef} className="markdown-content font-serif text-slate-800 dark:text-slate-200">
                <ReactMarkdown 
                  remarkPlugins={[remarkMath]} 
                  rehypePlugins={[rehypeKatex, rehypeHighlight]}
                >
                  {markdownContent}
                </ReactMarkdown>
            </div>
            
            <div className="h-32"></div> {/* Bottom padding for floating bar */}
            </div>
        </div>

        {/* Floating General Chat Input */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center px-4 pointer-events-none z-10">
            <div className={`transition-all duration-300 ${isSidebarOpen ? 'max-w-sm' : 'max-w-xl'} w-full pointer-events-auto`}>
                <form onSubmit={handleCreateGeneralThread} className="relative group">
                    <div className="absolute inset-0 bg-slate-900/5 dark:bg-slate-100/5 rounded-full blur-md transform translate-y-2 group-hover:translate-y-1 transition-transform"></div>
                    <div className="relative bg-white dark:bg-slate-900 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 flex items-center p-1.5 transition-all focus-within:border-blue-500 focus-within:shadow-blue-100 dark:focus-within:shadow-none">
                         <div className="pl-4 pr-2 text-slate-400">
                            <MessageCircle size={20} />
                         </div>
                         <input 
                            type="text" 
                            value={generalInputValue}
                            onChange={(e) => setGeneralInputValue(e.target.value)}
                            placeholder="Ask a question about the whole document..."
                            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 py-2.5"
                         />
                         <button 
                            type="submit"
                            disabled={!generalInputValue.trim()}
                            className="p-2 bg-slate-900 dark:bg-slate-700 text-white rounded-full hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                         >
                            <ArrowRight size={16} />
                         </button>
                    </div>
                </form>
            </div>
        </div>

        {selection && selection.rect && (
          <Tooltip 
            rect={selection.rect} 
            onAction={createThread} 
          />
        )}
      </div>

      {/* Right Pane: Thread Sidebar */}
      <div 
        className={`fixed inset-y-0 right-0 w-[450px] transform transition-transform duration-300 ease-in-out shadow-2xl z-40 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {activeThreadId ? (
            <ThreadPanel 
              thread={activeThread}
              isLoading={isAiLoading}
              onClose={() => setIsSidebarOpen(false)}
              onBack={() => setActiveThreadId(null)}
              onSendMessage={handleSendMessage}
            />
        ) : (
            <ThreadList 
                threads={threads}
                onSelectThread={setActiveThreadId}
                onClose={() => setIsSidebarOpen(false)}
            />
        )}
      </div>

      <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentSettings={settings}
          onSave={handleSaveSettings}
      />
    </div>
  );
};

export default App;