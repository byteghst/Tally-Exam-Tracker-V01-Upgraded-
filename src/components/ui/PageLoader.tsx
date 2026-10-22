import { TallyLoader } from './TallyLoader';

/** Centered Tally loader for a section or page that is waiting on its first data. */
export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex justify-center py-12">
      <TallyLoader size={88} label={label} />
    </div>
  );
}
