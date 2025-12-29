import React from 'react'
import { ArrowLeft, X, BookOpen } from 'lucide-react'
import { Quote } from '../types'
import { formatRelativeTime } from '../lib/formatTime'

interface QuotesViewProps {
  quotes: Quote[]
  onBack: () => void
  onDeleteQuote: (quoteId: string) => void
}

const QuotesView: React.FC<QuotesViewProps> = ({ quotes, onBack, onDeleteQuote }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 transition-colors duration-300">
      <div className="max-w-3xl mx-auto px-8 py-16">
        <header className="mb-12 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back to Document</span>
          </button>

          <h1 className="text-xl font-serif font-semibold text-slate-800 dark:text-neutral-200">
            Saved Quotes
          </h1>

          <div className="w-[140px]" />
        </header>

        {quotes.length === 0 ? (
          <div className="text-center py-24">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-neutral-800 mb-6">
              <BookOpen size={28} className="text-slate-400 dark:text-neutral-500" />
            </div>
            <h2 className="text-lg font-medium text-slate-700 dark:text-neutral-300 mb-2">
              No saved quotes yet
            </h2>
            <p className="text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
              Highlight text in your document and click <strong>Save</strong> to start collecting
              meaningful passages.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {quotes.map(quote => (
              <div key={quote.id} className="group relative">
                <div className="flex gap-4">
                  <span className="text-5xl font-serif text-slate-200 dark:text-neutral-700 leading-none select-none">
                    "
                  </span>
                  <div className="flex-1 pt-2">
                    <blockquote className="text-lg font-serif text-slate-700 dark:text-neutral-300 leading-relaxed">
                      {quote.text}
                    </blockquote>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-slate-400 dark:text-neutral-500">
                        Saved {formatRelativeTime(quote.savedAt)}
                      </span>
                      <button
                        onClick={() => onDeleteQuote(quote.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-neutral-800 text-slate-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400 transition-all"
                        title="Delete quote"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-6 border-b border-slate-200 dark:border-neutral-800" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default QuotesView
