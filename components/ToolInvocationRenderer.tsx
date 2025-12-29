import { AlertCircle, CheckCircle, ExternalLink, Globe, Loader2, Search } from 'lucide-react'
import React from 'react'
import { ToolInvocationPart } from '../types'

interface ToolInvocationRendererProps {
  part: ToolInvocationPart
}

// Tool display metadata
const toolMetadata: Record<string, { displayName: string; icon: React.ReactNode }> = {
  web_search: {
    displayName: 'Web Search',
    icon: <Search size={14} />,
  },
  google_search: {
    displayName: 'Google Search',
    icon: <Globe size={14} />,
  },
}

const isSafeUrl = (value?: string) => {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const getErrorMessage = (result: unknown): string | null => {
  if (!result) return null
  if (typeof result === 'object') {
    const errorValue = (result as { error?: unknown }).error
    if (errorValue === true) {
      return (
        (result as { message?: string }).message ||
        (result as { error?: string }).error ||
        'Search failed'
      )
    }
    if (typeof errorValue === 'string') return errorValue
  }
  return null
}

interface SearchResult {
  title?: string
  url?: string
  snippet?: string
  description?: string
}

interface SearchToolResult {
  results?: SearchResult[]
  sources?: SearchResult[]
  content?: string
}

const ToolInvocationRenderer: React.FC<ToolInvocationRendererProps> = ({ part }) => {
  const meta = toolMetadata[part.toolName] || {
    displayName: part.toolName,
    icon: <Search size={14} />,
  }

  const errorMessage = getErrorMessage(part.result)
  const isLoading = part.state === 'partial-call' || part.state === 'call'
  const hasResult = part.state === 'result' && part.result !== undefined
  const isError = hasResult && errorMessage !== null

  // Extract search query from args
  const query = (part.args as { query?: string })?.query || ''

  // Parse search results from the result
  const searchResults: SearchResult[] = []
  if (hasResult && !isError) {
    const result = part.result as SearchToolResult
    if (result?.results) {
      searchResults.push(...result.results.slice(0, 3))
    } else if (result?.sources) {
      searchResults.push(...result.sources.slice(0, 3))
    }
  }

  return (
    <div className="my-3 rounded-lg border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-dark-surface border-b border-slate-200 dark:border-dark-border">
        <span className="text-accent">{meta.icon}</span>
        <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">
          {meta.displayName}
        </span>
        {isLoading && <Loader2 size={12} className="animate-spin text-slate-400" />}
        {hasResult && !isError && <CheckCircle size={12} className="text-green-500" />}
        {isError && <AlertCircle size={12} className="text-red-500" />}
      </div>

      {/* Query display */}
      {query && (
        <div className="px-3 py-2 text-sm border-b border-slate-100 dark:border-dark-border">
          <span className="text-slate-500 dark:text-zinc-400">Query: </span>
          <span className="text-slate-700 dark:text-zinc-200">{query}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="px-3 py-3 text-sm text-slate-500 dark:text-zinc-400 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Searching...
        </div>
      )}

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="px-3 py-2">
          <div className="text-xs text-slate-500 dark:text-zinc-400 mb-2">Results:</div>
          <div className="space-y-2">
            {searchResults.map((result, idx) => (
              <div key={result.url || `result-${idx}`} className="text-sm">
                {isSafeUrl(result.url) ? (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-accent hover:underline font-medium"
                  >
                    {result.title || result.url}
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="font-medium text-slate-700 dark:text-zinc-200">
                    {result.title || result.url || 'Result'}
                  </span>
                )}
                {(result.snippet || result.description) && (
                  <p className="text-slate-600 dark:text-zinc-400 text-xs mt-0.5 line-clamp-2">
                    {result.snippet || result.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content result (for Google Search grounding) */}
      {hasResult &&
        !isError &&
        !searchResults.length &&
        (part.result as SearchToolResult)?.content && (
          <div className="px-3 py-2 text-sm text-slate-600 dark:text-zinc-300">
            {(part.result as SearchToolResult).content}
          </div>
        )}

      {/* Error state */}
      {isError && (
        <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage || 'Search failed'}
        </div>
      )}
    </div>
  )
}

export default ToolInvocationRenderer
