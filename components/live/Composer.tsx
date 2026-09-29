import React, { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'

interface ComposerProps {
  placeholder: string
  disabled?: boolean
  autoFocus?: boolean
  /** Resolves true when the text was accepted and the box can be cleared. */
  onSubmit: (text: string) => Promise<boolean>
  onEscape?: () => void
}

const Composer: React.FC<ComposerProps> = ({
  placeholder,
  disabled,
  autoFocus,
  onSubmit,
  onEscape,
}) => {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  async function submit() {
    const text = value.trim()
    if (!text || sending || disabled) return
    setSending(true)
    const accepted = await onSubmit(text)
    setSending(false)
    if (accepted) setValue('')
  }

  return (
    <form
      className="relative"
      onSubmit={event => {
        event.preventDefault()
        void submit()
      }}
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={event => setValue(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            void submit()
          } else if (event.key === 'Escape') onEscape?.()
        }}
        placeholder={placeholder}
        className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 placeholder:dark:text-zinc-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm resize-none overflow-y-auto disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={!value.trim() || sending || disabled}
        className="absolute right-2 bottom-2.5 p-2 bg-accent-muted text-white rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title="Send (Enter)"
      >
        <Send size={15} />
      </button>
    </form>
  )
}

export default Composer
