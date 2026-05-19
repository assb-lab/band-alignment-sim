interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner({ label, className = "" }: SpinnerProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
        aria-hidden="true"
      />
      {label && <p className="text-sm text-slate-700">{label}</p>}
    </div>
  );
}

/** Lightweight overlay for plot panels during async work. */
export function SpinnerOverlay({ label = "計算中…" }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/75 backdrop-blur-[1px]">
      <Spinner label={label} />
    </div>
  );
}
