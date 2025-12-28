import { useState, useCallback, Dispatch, SetStateAction } from 'react'
import { Quote } from '../types'

export interface UseQuotesResult {
  quotes: Quote[]
  addQuote: (text: string) => void
  deleteQuote: (quoteId: string) => void
  setQuotes: Dispatch<SetStateAction<Quote[]>>
}

export function useQuotes(initialQuotes: Quote[] = []): UseQuotesResult {
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes)

  const addQuote = useCallback((text: string) => {
    const newQuote: Quote = {
      id: Date.now().toString(),
      text,
      savedAt: Date.now(),
    }
    setQuotes(prev => [...prev, newQuote])
  }, [])

  const deleteQuote = useCallback((quoteId: string) => {
    setQuotes(prev => prev.filter(q => q.id !== quoteId))
  }, [])

  return { quotes, addQuote, deleteQuote, setQuotes }
}
