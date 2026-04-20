import { MILESTONES, getCurrentMilestone, getRandomMessage } from "@/lib/engagement";

interface JourneyPathProps {
  points: number;
  className?: string;
}

/**
 * Curved SVG path with progressive milestones, inspired by the WAY MAKER logo flow.
 * Filled markers represent milestones already reached.
 */
export function JourneyPath({ points, className }: JourneyPathProps) {
  const { current, next, progressToNext } = getCurrentMilestone(points);
  const message = getRandomMessage();

  // Layout constants
  const width = 800;
  const height = 200;
  const padding = 60;

  // Generate positions for each milestone along a sinuous curve
  const positions = MILESTONES.map((m, i) => {
    const t = i / (MILESTONES.length - 1);
    const x = padding + t * (width - padding * 2);
    // Sine wave for organic flow
    const y = height / 2 + Math.sin(t * Math.PI * 2.2) * 38;
    return { x, y, milestone: m, reached: points >= m.points };
  });

  // Build smooth curve through points (Catmull-Rom-ish via cubic bezier)
  const buildPath = (pts: typeof positions) => {
    if (pts.length < 2) return "";
    const d: string[] = [`M ${pts[0].x} ${pts[0].y}`];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
    }
    return d.join(" ");
  };

  const fullPath = buildPath(positions);

  // Find current position along the path interpolated between milestones
  const reachedCount = positions.filter((p) => p.reached).length;
  const lastReachedIdx = Math.max(0, reachedCount - 1);
  const currentPos = positions[lastReachedIdx];
  const nextPos = positions[Math.min(positions.length - 1, lastReachedIdx + 1)];
  const cursorX = currentPos.x + (nextPos.x - currentPos.x) * progressToNext;
  const cursorY = currentPos.y + (nextPos.y - currentPos.y) * progressToNext;

  return (
    <div className={`card-elevated p-6 ${className ?? ""}`}>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-display text-base font-medium text-foreground">Sua Jornada</h3>
          <p className="text-sm text-muted-foreground mt-1 italic">"{message}"</p>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-semibold text-foreground">{points}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">passos</div>
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="journey-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="oklch(0.55 0.19 260)" stopOpacity="1" />
              <stop offset="100%" stopColor="oklch(0.65 0.2 300)" stopOpacity="1" />
            </linearGradient>
            <filter id="journey-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background path (full journey) */}
          <path
            d={fullPath}
            fill="none"
            stroke="oklch(0.92 0.005 240)"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Progress overlay path: clip to current position */}
          <path
            d={fullPath}
            fill="none"
            stroke="url(#journey-gradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${cursorX + cursorY} 9999`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />

          {/* Milestone markers */}
          {positions.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={p.reached ? 12 : 9}
                fill={p.reached ? "url(#journey-gradient)" : "oklch(1 0 0)"}
                stroke={p.reached ? "oklch(1 0 0)" : "oklch(0.85 0.005 240)"}
                strokeWidth="3"
              />
              {p.reached && i === lastReachedIdx && (
                <circle cx={p.x} cy={p.y} r="18" fill="none" stroke="url(#journey-gradient)" strokeWidth="2" opacity="0.4">
                  <animate attributeName="r" values="14;22;14" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite" />
                </circle>
              )}
              <text
                x={p.x}
                y={p.y + (i % 2 === 0 ? -22 : 32)}
                textAnchor="middle"
                fontSize="11"
                fontWeight={p.reached ? 600 : 400}
                fill={p.reached ? "oklch(0.22 0.02 260)" : "oklch(0.55 0.02 260)"}
              >
                {p.milestone.label}
              </text>
              <text
                x={p.x}
                y={p.y + (i % 2 === 0 ? -36 : 46)}
                textAnchor="middle"
                fontSize="9"
                fill="oklch(0.55 0.02 260)"
              >
                {p.milestone.points}
              </text>
            </g>
          ))}

          {/* Animated cursor showing current position */}
          <circle cx={cursorX} cy={cursorY} r="6" fill="oklch(1 0 0)" stroke="url(#journey-gradient)" strokeWidth="3" filter="url(#journey-glow)" />
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Marco atual</div>
          <div className="font-medium text-foreground mt-1">{current.label}</div>
        </div>
        {next && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Próximo</div>
            <div className="font-medium text-foreground mt-1">
              {next.label} <span className="text-muted-foreground">({next.points - points} restantes)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
