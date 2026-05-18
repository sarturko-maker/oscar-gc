import type { View, ViewOptions } from '../utils/navigationUtils';
import OscarHubBanner from './oscar/OscarHubBanner';

export default function Hub({
  setView: _setView,
}: {
  setView: (view: View, viewOptions?: ViewOptions) => void;
}) {
  return (
    <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
      <div className="flex flex-col max-w-2xl flex-1 justify-center">
        <OscarHubBanner />
        <div className="oscar__eyebrow">Office of the General Counsel</div>
        <h1 className="oscar__hero">
          Oscar <span className="oscar__hero-em">GC.</span>
        </h1>
        <hr className="oscar__rule" />
        <p className="oscar__subtitle">
          In-house legal agent platform. Practice areas as primary units,
          memory as the spine.
        </p>
      </div>
    </div>
  );
}
