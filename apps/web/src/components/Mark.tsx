/** The Zeryth mark: a six-armed frost crystal around a gold core. */
export function Mark({ size = 28, tone = "ink" }: { size?: number; tone?: "ink" | "frost" }) {
  const stroke = tone === "ink" ? "var(--ink)" : "var(--frost)";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="mark">
      <g stroke={stroke} strokeWidth="2.2" strokeLinecap="round" fill="none">
        {[0, 60, 120].map((a) => (
          <g key={a} transform={`rotate(${a} 16 16)`}>
            <path d="M16 3.5v25" />
            <path d="M12.6 6.6 16 9.6l3.4-3" />
            <path d="M12.6 25.4 16 22.4l3.4 3" />
          </g>
        ))}
      </g>
      <circle cx="16" cy="16" r="3.6" fill="var(--sun)" stroke={stroke} strokeWidth="1.6" />
    </svg>
  );
}
