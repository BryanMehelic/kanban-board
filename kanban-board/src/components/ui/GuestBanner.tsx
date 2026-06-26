import { useAuth } from '../../contexts/AuthContext'

interface GuestBannerProps {
  onUpgrade: () => void
  onSignIn: () => void
}

export function GuestBanner({ onUpgrade, onSignIn }: GuestBannerProps) {
  const { isGuest } = useAuth()

  if (!isGuest) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <p>
        You&apos;re using a guest session. Sign in or upgrade to save your work permanently and
        unlock teams.
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onSignIn}
          className="rounded-md border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={onUpgrade}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400"
        >
          Upgrade account
        </button>
      </div>
    </div>
  )
}
