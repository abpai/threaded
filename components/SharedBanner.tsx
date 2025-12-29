import React from 'react'
import { X, GitFork } from 'lucide-react'

interface SharedBannerProps {
  onDismiss: () => void
}

const SharedBanner: React.FC<SharedBannerProps> = ({ onDismiss }) => {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
        <GitFork size={16} />
        <span>You're viewing a shared session. Any edits will create your own copy.</span>
      </div>
      <button
        onClick={onDismiss}
        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded text-blue-500 dark:text-blue-400 transition-colors"
        title="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export default SharedBanner
