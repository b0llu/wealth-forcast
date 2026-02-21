export function GenerateButton({ isGenerating, disabled, onClick }: { isGenerating: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={["relative inline-flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200",
        "bg-foreground text-background hover:opacity-90 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        !disabled && !isGenerating ? "shadow-lg hover:shadow-xl" : ""].join(" ")}>
      {isGenerating ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Generating…
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 12L6.5 7L9.5 10L14 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Generate Forecast
        </>
      )}
    </button>
  );
}
