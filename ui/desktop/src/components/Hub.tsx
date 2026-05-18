import type { View, ViewOptions } from '../utils/navigationUtils';

export default function Hub({
  setView: _setView,
}: {
  setView: (view: View, viewOptions?: ViewOptions) => void;
}) {
  return (
    <div className="oscar-terminal flex flex-col items-center justify-center h-full min-h-0">
      <h1 className="oscar-terminal__title">Oscar GC</h1>
      <p className="oscar-terminal__subtitle">In-house legal agent platform</p>
    </div>
  );
}
