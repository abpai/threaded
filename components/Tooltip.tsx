import React from 'react';
import { MessageSquarePlus, Copy, Sparkles } from 'lucide-react';

interface TooltipProps {
  rect: DOMRect;
  onAction: (action: 'discuss' | 'summarize') => void;
}

const Tooltip: React.FC<TooltipProps> = ({ rect, onAction }) => {
  // Calculate position: Centered above the selection
  const top = rect.top - 50 + window.scrollY;
  const left = rect.left + rect.width / 2;

  return (
    <div
      className="fixed z-50 flex items-center gap-1 p-1 bg-slate-900 dark:bg-slate-800 text-white rounded-lg shadow-xl transform -translate-x-1/2 animate-in fade-in zoom-in duration-200 border border-slate-700"
      style={{ top: `${top}px`, left: `${left}px` }}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
    >
      <button
        onClick={() => onAction('discuss')}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 rounded-md transition-colors text-sm font-medium"
      >
        <MessageSquarePlus size={16} />
        <span>Discuss</span>
      </button>
      
      <div className="w-px h-4 bg-slate-700 mx-1"></div>

      <button
        onClick={() => onAction('summarize')}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 rounded-md transition-colors text-sm font-medium"
      >
        <Sparkles size={16} className="text-yellow-400" />
        <span>Explain</span>
      </button>
      
      <div className="w-px h-4 bg-slate-700 mx-1"></div>
      
       <button
        onClick={() => {
           // Simple copy fallback
           document.execCommand('copy');
        }}
        className="p-1.5 hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-white"
        title="Copy"
      >
        <Copy size={16} />
      </button>
      
      {/* Down arrow */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900 dark:border-t-slate-800"></div>
    </div>
  );
};

export default Tooltip;