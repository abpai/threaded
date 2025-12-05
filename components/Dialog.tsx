import React from "react"
import { AlertCircle, CheckCircle, X } from "lucide-react"

export interface DialogState {
  isOpen: boolean
  type: "alert" | "confirm" | "success" | "error"
  title: string
  message: string
  onConfirm?: () => void
}

interface DialogProps {
  state: DialogState
  onClose: () => void
}

const Dialog: React.FC<DialogProps> = ({ state, onClose }) => {
  if (!state.isOpen) return null

  const handleConfirm = () => {
    state.onConfirm?.()
    onClose()
  }

  const icons = {
    alert: null,
    confirm: <AlertCircle className="text-amber-500" size={24} />,
    success: <CheckCircle className="text-emerald-500" size={24} />,
    error: <AlertCircle className="text-red-500" size={24} />,
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            {icons[state.type]}
            <h2 className="text-lg font-semibold text-slate-800 dark:text-neutral-100">
              {state.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 dark:text-neutral-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <p className="text-slate-600 dark:text-neutral-300 text-sm leading-relaxed">
            {state.message}
          </p>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50">
          {state.type === "confirm" ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dialog
