interface TallyMarkProps {
  size?: number;
  className?: string;
}

/**
 * The Tally logo, shown exactly as designed: the navy tile with the four
 * white bars and the blue diagonal stroke. It uses the same PNG files as the
 * app icon (public/icons/), so the logo inside the app can never drift from
 * the icon on the home screen — replace those files and both change together.
 *
 * icon-192.png is plenty for anything up to ~64px (even on 3x screens);
 * larger sizes use icon-512.png so the artwork stays sharp.
 */
export function TallyMark({ size = 32, className }: TallyMarkProps) {
  const src = size > 64 ? '/icons/icon-512.png' : '/icons/icon-192.png';
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={className}
    />
  );
}
