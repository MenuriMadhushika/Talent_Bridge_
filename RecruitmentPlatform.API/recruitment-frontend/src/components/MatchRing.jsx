// The recurring visual motif for this app: every AI-scored moment (a
// candidate's match to a job, later an evaluation score) reads through the
// same ring, so a recruiter learns to scan for it at a glance.
export default function MatchRing({ score, size = 40, label }) {
  if (score === null || score === undefined) {
    return (
      <span className="match-ring">
        <svg width={size} height={size} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="var(--line)" strokeWidth="4" />
        </svg>
        <span className="label">Not scored yet</span>
      </span>
    );
  }

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const color = clamped >= 75 ? "var(--primary)" : clamped >= 45 ? "var(--accent)" : "var(--danger)";

  return (
    <span className="match-ring">
      <svg width={size} height={size} viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={radius} fill="none" stroke="var(--line)" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span>
        <span className="value">{Math.round(clamped)}%</span>
        {label && <span className="label" style={{ display: "block" }}>{label}</span>}
      </span>
    </span>
  );
}
