export function CalcInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}>
      <div className="animate-fade-in-up w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-semibold text-card-foreground">How Wealth Is Calculated</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="space-y-5 px-6 py-5 text-sm">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#ffae04]">Step 1 — AI Research</p>
            <p className="text-muted-foreground leading-relaxed">
              For each investment, AI searches the web for historical returns (YTD, 1Y, 3Y CAGR, 5Y CAGR, since inception).
              It estimates three forward-looking annual return rates. The expected rate blends the AI estimate (55%) with historical signals (45%).
            </p>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#2671f4]">Step 2 — Compound Growth</p>
            <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 font-mono text-xs text-foreground">
              <p>Value(year N) =</p>
              <p className="mt-1 pl-4">Previous × (1 + annual_rate) + Annual Contribution</p>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>• <strong>Monthly</strong> → multiplied ×12 per year</li>
              <li>• <strong>Yearly</strong> → added as-is each year</li>
              <li>• <strong>One-time</strong> → added to starting capital only, no ongoing contribution</li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Step 3 — Portfolio Total</p>
            <p className="text-muted-foreground leading-relaxed">
              Each investment is projected independently. The portfolio total each year is the sum of all individual values.
              The dashed white line shows the actual amount you've invested (no growth).
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { label: "Conservative", color: "#747474", desc: "Lower-bound rate" },
              { label: "Expected",     color: "#2671f4", desc: "AI + historical" },
              { label: "Aggressive",   color: "#ffae04", desc: "Upper-bound rate" },
            ].map(({ label, color, desc }) => (
              <div key={label} className="rounded-lg border p-2 text-center"
                style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
                <p className="font-semibold" style={{ color }}>{label}</p>
                <p className="mt-0.5 text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
