interface TallyMarkProps {
  size?: number;
  className?: string;
}

/**
 * The Tally mark: a tile with three bars and one diagonal stroke. Drawn as
 * inline SVG using the theme colours (ink tile, paper bars, persimmon stroke),
 * so it always matches the rest of the app in light and dark. The launcher
 * icon is built from the same geometry (design/icon-master.svg).
 */
export function TallyMark({ size = 32, className }: TallyMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden
      focusable="false"
      className={className}
    >
      <rect width="512" height="512" rx="112" style={{ fill: 'rgb(var(--ink))' }} />
      <g transform="translate(52.2 62.3) scale(1.27)">
        <rect x="69" y="50" width="38" height="205" style={{ fill: 'rgb(var(--surface))' }} />
        <rect x="135" y="50" width="38" height="205" style={{ fill: 'rgb(var(--surface))' }} />
        <rect x="201" y="50" width="38" height="205" style={{ fill: 'rgb(var(--surface))' }} />
        <line
          x1="27"
          y1="202"
          x2="294"
          y2="83"
          strokeWidth="34"
          strokeLinecap="square"
          style={{ stroke: 'rgb(var(--accent))' }}
        />
      </g>
    </svg>
  );
}
