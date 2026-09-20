import { useIosInstallHint } from '@/hooks/useIosInstallHint'

type OnboardingHeroProps = {
  onSubscribe: () => void
  busy: boolean
  error: string | null
  permissionDenied: boolean
}

export function OnboardingHero({ onSubscribe, busy, error, permissionDenied }: OnboardingHeroProps) {
  const showIosInstallHint = useIosInstallHint()

  return (
    <section className="mb-5 flex flex-wrap items-center gap-[clamp(18px,3vw,32px)] rounded-[20px] border border-sand-900 bg-sand-1000 p-[clamp(20px,4vw,32px)] shadow-card">
      <div className="min-w-0 flex-[1_1_300px]">
        <div className="inline-flex items-center gap-2 rounded-md bg-amber-tint px-2.5 py-1.25 font-mono text-[11px] tracking-[0.12em] text-amber-text uppercase">
          step 1 of 2
        </div>
        <h1 className="mt-3.5 mb-2.5 text-[clamp(26px,4.2vw,36px)] leading-[1.08] font-bold tracking-[-0.03em] text-balance">
          Never sprint for the bus again.
        </h1>
        <p className="max-w-[46ch] text-base leading-[1.55] text-ink-480 text-pretty">
          TransitCue pushes a notification at the exact minute you need to leave. Allow notifications once —
          everything after that lives on this device.
        </p>
        {showIosInstallHint ? (
          <div className="mt-5.5 max-w-[46ch] rounded-xl border border-amber-tint bg-amber-tint/40 p-3.5 text-[13px] leading-[1.5] text-amber-text">
            <p className="font-semibold">Add to Home Screen first</p>
            <p className="mt-1">
              iOS only delivers push notifications to installed apps. In Safari, tap Share →{' '}
              <span className="font-semibold">Add to Home Screen</span>, then open TransitCue from that icon and tap
              Enable notifications again.
            </p>
          </div>
        ) : (
          <div className="mt-5.5 flex flex-wrap items-center gap-2.5">
            <button
              onClick={onSubscribe}
              disabled={busy}
              className="rounded-xl border-0 bg-teal-deep py-3.5 px-5.5 text-[15px] font-semibold text-teal-on-accent shadow-cta hover:bg-teal-deep-hover"
            >
              Enable notifications
            </button>
            <span className="text-[13px] text-sand-600">
              {error ?? (permissionDenied ? 'Blocked in browser settings — re-allow there, then reload.' : 'One tap. No account, no email.')}
            </span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-[0_1_300px]">
        <div className="flex animate-in-400 items-start gap-3 rounded-2xl border border-sand-900 bg-sand-975 p-3.5">
          <div className="grid h-8.5 w-8.5 flex-none place-items-center rounded-[10px] bg-teal-accent font-mono text-[9px] font-bold tracking-[0.04em] text-teal-on-accent-alt">
            ON
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">Congress Ave → 4th &amp; Guadalupe</div>
            <div className="mt-0.5 whitespace-pre-line text-[13px] leading-[1.45] text-ink-450">
              {'20 · 8:15 · on time\n20 · 8:32 · on time\n3 · 8:41 · +4 min'}
            </div>
          </div>
        </div>
        <div className="mt-2.5 text-center font-mono text-[10px] tracking-[0.1em] text-sand-680 uppercase">
          example push
        </div>
      </div>
    </section>
  )
}
