import type { NotificationPreviewState } from '@/hooks/useNotificationPreview'

type NotificationPreviewCardProps = {
  state: NotificationPreviewState
  onRefresh: () => void
}

function BusIcon() {
  return (
    <svg className="h-8.5 w-8.5 flex-none rounded-[9px]" viewBox="0 0 512 512" role="img" aria-label="TransitCue">
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
  )
}

export function NotificationPreviewCard({ state, onRefresh }: NotificationPreviewCardProps) {
  return (
    <div className="rounded-[16px] border border-teal-tint-border bg-teal-tint/50 p-3.5">
      <div className="mb-2.75 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-sand-1000 px-2.25 py-1 font-mono text-[10.5px] tracking-[0.12em] text-teal-tint-text uppercase">
          <span className="block h-1.5 w-1.5 rounded-full bg-teal-accent" />
          preview
        </span>
        <span className="text-[12px] text-teal-tint-text/80">what you&apos;d see right now</span>
        <div className="flex-1" />
        {state.status === 'ready' && (
          <button
            onClick={onRefresh}
            aria-label="Refresh preview"
            className="h-6.5 w-6.5 flex-none rounded-md border border-teal-tint-border bg-sand-1000 text-[13px] leading-none text-teal-tint-text hover:bg-sand-990"
          >
            ↻
          </button>
        )}
      </div>

      {(state.status === 'loading' || state.status === 'idle') && (
        <div className="flex items-start gap-3 rounded-[13px] border border-sand-900 bg-sand-1000 p-3">
          <div className="h-8.5 w-8.5 flex-none animate-pulse-soft rounded-[9px] bg-sand-920" />
          <div className="min-w-0 flex-1">
            <div className="h-3 w-[62%] animate-pulse-soft rounded bg-sand-920" />
            <div className="mt-2 h-2.75 w-[85%] animate-pulse-soft rounded bg-sand-930" />
            <div className="mt-1.5 h-2.75 w-[70%] animate-pulse-soft rounded bg-sand-930" />
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-[13px] border border-red-hover-border bg-sand-1000 p-3 text-[12.5px] text-red-hover-text">
          <span className="flex-1">{state.message}</span>
          <button
            onClick={onRefresh}
            className="rounded-md border border-red-hover-border bg-red-hover-bg px-2.5 py-1 text-[12px] font-medium text-red-hover-text"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === 'ready' && state.preview === null && (
        <div className="rounded-[13px] border border-dashed border-sand-880 bg-sand-1000 px-3 py-3.5 text-[12.5px] leading-[1.5] text-sand-620">
          No upcoming departures on this route right now — check back closer to your push time.
        </div>
      )}

      {state.status === 'ready' && state.preview && (
        <div className="animate-in-140 flex items-start gap-3 rounded-[13px] border border-sand-900 bg-sand-1000 p-3 shadow-dropdown">
          <BusIcon />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11.5px] font-semibold text-ink-450">TransitCue</span>
              <span className="font-mono text-[10px] text-sand-680">now</span>
            </div>
            <div className="mt-0.5 truncate text-[13.5px] font-semibold text-ink-260">{state.preview.title}</div>
            <div className="mt-1 font-mono text-[12px] leading-[1.55] whitespace-pre-line text-ink-500">{state.preview.body}</div>
          </div>
        </div>
      )}
    </div>
  )
}
