interface ErrorBannerProps {
  message: string
  onRetry?: () => void
  onDismiss?: () => void
}

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      <p>{message}</p>
      <div className="flex shrink-0 gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-rose-500/20 px-2 py-1 text-xs font-medium hover:bg-rose-500/30"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
