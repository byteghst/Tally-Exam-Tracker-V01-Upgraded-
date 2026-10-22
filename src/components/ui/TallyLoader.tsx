import { useId } from 'react';

// The Tally mark as a loading animation: the four bars grow up one by one, the
// orange slash wipes in from the upper right, then the mark fades and repeats.
// Same geometry and motion as the website hero. Honors "reduce motion" by
// showing the finished mark with no movement.
const CSS = `
.tl-b{fill:rgb(var(--ink));transform-box:fill-box;transform-origin:bottom;transform:scaleY(0)}
.tl-b1{animation:tl-b1 2.8s cubic-bezier(.2,.8,.2,1) infinite}
.tl-b2{animation:tl-b2 2.8s cubic-bezier(.2,.8,.2,1) infinite}
.tl-b3{animation:tl-b3 2.8s cubic-bezier(.2,.8,.2,1) infinite}
.tl-b4{animation:tl-b4 2.8s cubic-bezier(.2,.8,.2,1) infinite}
.tl-w{stroke:#fff;stroke-width:520;fill:none;stroke-dasharray:1;stroke-dashoffset:1;animation:tl-w 2.8s cubic-bezier(.3,.7,.2,1) infinite}
.tl-g{animation:tl-f 2.8s linear infinite}
@keyframes tl-b1{0%{transform:scaleY(0)}22%,100%{transform:scaleY(1)}}
@keyframes tl-b2{0%,3%{transform:scaleY(0)}25%,100%{transform:scaleY(1)}}
@keyframes tl-b3{0%,6%{transform:scaleY(0)}28%,100%{transform:scaleY(1)}}
@keyframes tl-b4{0%,9%{transform:scaleY(0)}31%,100%{transform:scaleY(1)}}
@keyframes tl-w{0%,38%{stroke-dashoffset:1}62%,100%{stroke-dashoffset:0}}
@keyframes tl-f{0%,88%{opacity:1}97%,100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.tl-b{transform:none;animation:none}.tl-w{animation:none;stroke-dashoffset:0}.tl-g{animation:none}}
`;

interface TallyLoaderProps {
  /** Width in pixels. */
  size?: number;
  label?: string;
}

export function TallyLoader({ size = 96, label = 'Loading' }: TallyLoaderProps) {
  const maskId = 'tl' + useId().replace(/:/g, '');
  return (
    <div role="status" aria-label={label} style={{ width: size }}>
      <style>{CSS}</style>
      <svg viewBox="227 295 800 652" className="tl-g" aria-hidden="true" style={{ display: 'block', width: '100%' }}>
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
            <path className="tl-w" d="M1050 411 210 773" pathLength={1} />
          </mask>
        </defs>
        <rect className="tl-b tl-b1" x="376" y="315" width="92" height="612" />
        <rect className="tl-b tl-b2" x="515" y="315" width="90" height="612" />
        <rect className="tl-b tl-b3" x="651" y="315" width="89" height="612" />
        <rect className="tl-b tl-b4" x="787" y="315" width="92" height="612" />
        <polygon
          points="247,701 1007,374 1007,475 247,801"
          mask={`url(#${maskId})`}
          style={{ fill: 'rgb(var(--accent))' }}
        />
      </svg>
    </div>
  );
}
