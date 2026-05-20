import { Link, useLocation } from 'react-router-dom';
import { Plug, Settings, Sparkles } from 'lucide-react';
import { cn } from '../../utils';
import { usePracticeAreas } from './hooks/usePracticeAreas';
import QuickChatButton from './quickchat/QuickChatButton';

export function OscarSidebar() {
  const { pathname } = useLocation();
  const areas = usePracticeAreas();

  return (
    <aside className="oscar oscar__sidebar flex flex-col w-full h-full min-h-0">
      {/* Sprint 12 (ADR-039): Forge header zone — meta-agent for skill +
          practice-area authoring. Sprint 17 (ADR-060): Integrations entry
          added alongside Forge as the second system-affordance surface.
          Sprint 19 (ADR-066 D3): Quick chat sits above Forge so unscoped
          chat is one click from any view. */}
      <div className="oscar__sidebar-header">
        <QuickChatButton variant="sidebar" />
        <Link
          to="/forge"
          className={cn(
            'oscar__sidebar-item oscar__sidebar-item--utility',
            pathname.startsWith('/forge') && 'oscar__sidebar-item--active'
          )}
          aria-label="Forge"
        >
          <Sparkles className="oscar__sidebar-item-icon" size={16} />
          Forge
        </Link>
        <Link
          to="/integrations"
          className={cn(
            'oscar__sidebar-item oscar__sidebar-item--utility',
            pathname.startsWith('/integrations') && 'oscar__sidebar-item--active'
          )}
          aria-label="Integrations"
        >
          <Plug className="oscar__sidebar-item-icon" size={16} />
          Integrations
        </Link>
      </div>
      <nav className="oscar__sidebar-list flex-1 overflow-y-auto">
        <div className="oscar__eyebrow oscar__sidebar-eyebrow">Practice Areas</div>
        {areas.map((area, idx) => {
          const path = `/practice/${area.id}`;
          const isActive = pathname === path;
          return (
            <Link
              key={area.id}
              to={path}
              className={cn(
                'oscar__sidebar-item',
                isActive && 'oscar__sidebar-item--active'
              )}
            >
              <span className="oscar__sidebar-item-num">
                {String(idx + 1).padStart(2, '0')}
              </span>
              {area.name}
            </Link>
          );
        })}
      </nav>
      {/* Sprint 10: Settings affordance — upstream Goose's settings surface
          was unrouted in the Oscar GC rebrand. Restore from the sidebar footer. */}
      <div className="oscar__sidebar-footer">
        <Link
          to="/settings"
          className={cn(
            'oscar__sidebar-item oscar__sidebar-item--utility',
            pathname.startsWith('/settings') && 'oscar__sidebar-item--active'
          )}
          aria-label="Settings"
        >
          <Settings className="oscar__sidebar-item-icon" size={16} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
