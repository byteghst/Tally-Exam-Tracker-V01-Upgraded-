interface TallyMarkProps {
  size?: number;
  className?: string;
}

/**
 * The Tally brand mark (3 bars + diagonal stroke), transparent background,
 * for use inline against the app's own surface color — e.g. the sidebar
 * header or onboarding screen. The boxed/backgrounded version lives in
 * design/icon-master.svg and public/icons/ for OS-level app icons.
 */
export function TallyMark({ size = 32, className }: TallyMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 320 290"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="69" y="50" width="38" height="205" fill="currentColor" />
      <rect x="135" y="50" width="38" height="205" fill="currentColor" />
      <rect x="201" y="50" width="38" height="205" fill="currentColor" />
      <line x1="27" y1="202" x2="294" y2="83" stroke="#284EFE" strokeWidth="34" strokeLinecap="square" />
    </svg>
  );
}
