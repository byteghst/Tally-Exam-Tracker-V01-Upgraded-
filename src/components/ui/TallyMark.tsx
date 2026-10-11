interface TallyMarkProps {
  size?: number;
  className?: string;
}

/**
 * The Tally logo, exactly as designed: a black tile with four white bars and
 * one orange stroke. Drawn as inline SVG from the same measurements as the
 * launcher icon (scripts/build-icons.mjs), so the logo inside the app and the
 * icon on the home screen can never drift apart.
 */
export function TallyMark({ size = 32, className }: TallyMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 1254 1254" aria-hidden focusable="false" className={className}>
      <rect width="1254" height="1254" rx="274" fill="#000000" />
      <rect x="376" y="316" width="92" height="611" fill="#FFFFFF" />
      <rect x="515" y="316" width="89" height="611" fill="#FFFFFF" />
      <rect x="651" y="316" width="88" height="611" fill="#FFFFFF" />
      <rect x="787" y="316" width="91" height="611" fill="#FFFFFF" />
      <polygon points="248,702 1006,374 1006,474 248,801" fill="#FE5018" />
    </svg>
  );
}
