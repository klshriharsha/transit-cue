type AppHeaderProps = {
  bootstrapping: boolean
  on: boolean
  isGranted: boolean
}

export function AppHeader({ bootstrapping, on, isGranted }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-[60] border-b border-sand-900 bg-sand-972/88 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-270 items-center gap-3.5 px-[clamp(16px,4vw,28px)]">
        <div className="flex items-center gap-2.5">
          <svg className="h-6.5 w-6.5" viewBox="0 0 512 512" role="img" aria-label="TransitCue">
            <rect width="512" height="512" rx="116" fill="#0f766e" />
            <g fill="#ffffff">
              <rect x="112" y="96" width="288" height="312" rx="58" />
              <rect x="142" y="392" width="54" height="40" rx="14" />
              <rect x="316" y="392" width="54" height="40" rx="14" />
            </g>
            <rect x="150" y="130" width="212" height="46" rx="15" fill="#e6902f" />
            <rect x="150" y="194" width="212" height="108" rx="26" fill="#0f766e" />
            <circle cx="178" cy="342" r="17" fill="#0f766e" />
            <circle cx="334" cy="342" r="17" fill="#0f766e" />
          </svg>
          <span className="text-lg font-bold tracking-[-0.02em]">TransitCue</span>
        </div>
        <span className="hidden pt-0.5 font-mono text-[11px] tracking-[0.1em] text-sand-600 uppercase min-[450px]:block">
          transit nudges
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 rounded-full border border-sand-900 bg-sand-1000 py-1.5 pr-3 pl-2.5">
          {bootstrapping ? (
            <>
              <div className="h-1.75 w-1.75 animate-pulse-soft rounded-full bg-sand-780" />
              <span className="h-3.25 w-21.5 animate-pulse-soft rounded bg-sand-920" />
            </>
          ) : (
            <>
              <div className={`h-1.75 w-1.75 rounded-full ${on ? 'bg-green-accent' : isGranted ? 'bg-amber-muted' : 'bg-sand-780'}`} />
              <span className="text-[13px] font-medium text-ink-420">
                {on ? 'Notifications on' : isGranted ? 'Paused' : 'Not enabled'}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
