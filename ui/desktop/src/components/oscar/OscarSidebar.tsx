import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../utils';
import { PRACTICE_AREAS } from './practiceAreas';

export function OscarSidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="oscar-terminal oscar-terminal__sidebar flex flex-col w-full h-full min-h-0">
      <nav className="oscar-terminal__sidebar-list flex-1 overflow-y-auto">
        {PRACTICE_AREAS.map((area) => {
          const path = `/practice/${area.id}`;
          const isActive = pathname === path;
          return (
            <Link
              key={area.id}
              to={path}
              className={cn(
                'oscar-terminal__sidebar-item',
                isActive && 'oscar-terminal__sidebar-item--active'
              )}
            >
              {area.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
