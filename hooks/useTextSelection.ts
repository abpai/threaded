import { useState, useEffect, useCallback, RefObject } from 'react'
import { TextSelection } from '../types'

export interface UseTextSelectionResult {
  selection: TextSelection | null
  clearSelection: () => void
}

export function useTextSelection(
  contentRef: RefObject<HTMLElement | null>,
  isEnabled: boolean
): UseTextSelectionResult {
  const [selection, setSelection] = useState<TextSelection | null>(null)

  const clearSelection = useCallback(() => {
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [])

  useEffect(() => {
    if (!isEnabled) return

    const handleSelectionChange = () => {
      const currentSelection = window.getSelection()

      if (
        !currentSelection ||
        currentSelection.isCollapsed ||
        !contentRef.current?.contains(currentSelection.anchorNode)
      ) {
        return
      }

      const text = currentSelection.toString().trim()
      if (text.length > 0) {
        const range = currentSelection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setSelection({ text, rect })
      }
    }

    document.addEventListener('mouseup', handleSelectionChange)
    document.addEventListener('keyup', handleSelectionChange)

    return () => {
      document.removeEventListener('mouseup', handleSelectionChange)
      document.removeEventListener('keyup', handleSelectionChange)
    }
  }, [isEnabled, contentRef])

  return { selection, clearSelection }
}
