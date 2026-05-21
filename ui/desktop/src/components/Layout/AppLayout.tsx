import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import { defineMessages, useIntl } from '../../i18n';
import { Button } from '../ui/button';
import ChatSessionsContainer from '../ChatSessionsContainer';
import { useChatContext } from '../../contexts/ChatContext';
import { NavigationProvider, useNavigationContext } from './NavigationContext';
import { OscarSidebar } from '../oscar/OscarSidebar';
import RightPaneShell from '../oscar/rightPane/RightPaneShell';
import { useRightPaneVisibility } from '../oscar/rightPane/useRightPaneVisibility';
import { useActiveAreaSections } from '../oscar/rightPane/useActiveAreaSections';
import {
  NAV_DIMENSIONS,
  RIGHT_PANE_CHEVRON_RAIL_WIDTH,
  RIGHT_PANE_DIMENSIONS,
  Z_INDEX,
} from './constants';
import { cn } from '../../utils';
import { UserInput } from '../../types/message';

const i18n = defineMessages({
  closeNavigation: {
    id: 'appLayout.closeNavigation',
    defaultMessage: 'Close navigation',
  },
  openNavigation: {
    id: 'appLayout.openNavigation',
    defaultMessage: 'Open navigation',
  },
});

interface AppLayoutContentProps {
  activeSessions: Array<{
    sessionId: string;
    initialMessage?: UserInput;
  }>;
}

const AppLayoutContent: React.FC<AppLayoutContentProps> = ({ activeSessions }) => {
  const intl = useIntl();
  const location = useLocation();
  const safeIsMacOS = (window?.electron?.platform || 'darwin') === 'darwin';
  const chatContext = useChatContext();
  const isOnPairRoute = location.pathname === '/pair';

  const {
    isNavExpanded,
    setIsNavExpanded,
    effectiveNavigationMode,
    effectiveNavigationStyle,
    navigationPosition,
    isHorizontalNav,
    isCondensedIconOnly,
    isRightPaneExpanded,
    setIsRightPaneExpanded,
  } = useNavigationContext();

  const [navWidth, setNavWidth] = useState<number | null>(null);
  const navWidthRef = useRef<number | null>(null);

  useEffect(() => {
    window.electron.getSetting('navExpandedWidth').then((delta) => {
      if (delta !== null) {
        setNavWidth(
          Math.min(
            NAV_DIMENSIONS.MAX_NAV_WIDTH,
            Math.max(NAV_DIMENSIONS.MIN_NAV_WIDTH, NAV_DIMENSIONS.CONDENSED_WIDTH + delta)
          )
        );
      }
    });
  }, []);

  // Sprint M1 (ADR-069): right-pane width state. Absolute px (no
  // CONDENSED baseline). Loaded from electron settings on mount; persisted
  // on mouseup of the resize handle. Default DEFAULT_WIDTH on first launch.
  const [rightPaneWidth, setRightPaneWidth] = useState<number>(
    RIGHT_PANE_DIMENSIONS.DEFAULT_WIDTH
  );
  const rightPaneWidthRef = useRef<number>(RIGHT_PANE_DIMENSIONS.DEFAULT_WIDTH);

  useEffect(() => {
    window.electron.getSetting('rightPaneWidth').then((stored) => {
      if (stored !== null && stored !== undefined) {
        const clamped = Math.min(
          RIGHT_PANE_DIMENSIONS.MAX_WIDTH,
          Math.max(RIGHT_PANE_DIMENSIONS.MIN_WIDTH, stored)
        );
        setRightPaneWidth(clamped);
        rightPaneWidthRef.current = clamped;
      }
    });
  }, []);

  const paneVis = useRightPaneVisibility(isRightPaneExpanded);
  const paneSections = useActiveAreaSections(paneVis.areaId);

  const isResizable =
    !isHorizontalNav && !isCondensedIconOnly && effectiveNavigationMode === 'push' && isNavExpanded;

  const dragStateRef = useRef<{ startX: number; startWidth: number; direction: 1 | -1 } | null>(
    null
  );
  const navRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStateRef.current) return;
    const delta = (e.clientX - dragStateRef.current.startX) * dragStateRef.current.direction;
    const newWidth = Math.min(
      NAV_DIMENSIONS.MAX_NAV_WIDTH,
      Math.max(NAV_DIMENSIONS.MIN_NAV_WIDTH, dragStateRef.current.startWidth + delta)
    );
    navWidthRef.current = newWidth;
    setNavWidth(newWidth);
  }, []);

  const onMouseUp = useCallback(() => {
    dragStateRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    if (navWidthRef.current !== null) {
      window.electron.setSetting(
        'navExpandedWidth',
        navWidthRef.current - NAV_DIMENSIONS.CONDENSED_WIDTH
      );
    }
  }, [onMouseMove]);

  const onHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const currentWidth =
        navRef.current?.getBoundingClientRect().width ?? NAV_DIMENSIONS.CONDENSED_WIDTH;
      dragStateRef.current = {
        startX: e.clientX,
        startWidth: currentWidth,
        direction: navigationPosition === 'right' ? -1 : 1,
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [navigationPosition, onMouseMove, onMouseUp]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [onMouseMove, onMouseUp]);

  // Sprint M1 (ADR-069): right-pane drag system. Mirrors the sidebar's
  // drag/persist with direction: -1 (LEFT-drag widens the pane). Two
  // independent dragStateRefs keep the handlers clean — concurrent drags
  // on both edges would be impossible anyway (one mouse). Persists
  // absolute width (no CONDENSED baseline to subtract).
  const paneDragStateRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  const onPaneMouseMove = useCallback((e: MouseEvent) => {
    if (!paneDragStateRef.current) return;
    const delta = (e.clientX - paneDragStateRef.current.startX) * -1;
    const newWidth = Math.min(
      RIGHT_PANE_DIMENSIONS.MAX_WIDTH,
      Math.max(RIGHT_PANE_DIMENSIONS.MIN_WIDTH, paneDragStateRef.current.startWidth + delta)
    );
    rightPaneWidthRef.current = newWidth;
    setRightPaneWidth(newWidth);
  }, []);

  const onPaneMouseUp = useCallback(() => {
    paneDragStateRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onPaneMouseMove);
    window.removeEventListener('mouseup', onPaneMouseUp);
    void window.electron.setSetting('rightPaneWidth', rightPaneWidthRef.current);
  }, [onPaneMouseMove]);

  const onPaneHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      paneDragStateRef.current = {
        startX: e.clientX,
        startWidth: rightPaneWidthRef.current,
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onPaneMouseMove);
      window.addEventListener('mouseup', onPaneMouseUp);
    },
    [onPaneMouseMove, onPaneMouseUp]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onPaneMouseMove);
      window.removeEventListener('mouseup', onPaneMouseUp);
    };
  }, [onPaneMouseMove, onPaneMouseUp]);

  if (!chatContext) {
    throw new Error('AppLayoutContent must be used within ChatProvider');
  }

  const { setChat } = chatContext;

  // Hide the titlebar drag region when nav is at the top in push mode,
  // since the nav occupies that space and the drag region blocks interactions
  const isPushTopNav =
    effectiveNavigationMode === 'push' && navigationPosition === 'top' && isNavExpanded;
  React.useEffect(() => {
    const dragRegion = document.querySelector('.titlebar-drag-region') as HTMLElement | null;
    if (!dragRegion) return;
    if (isPushTopNav) {
      dragRegion.style.display = 'none';
    } else {
      dragRegion.style.display = '';
    }
    return () => {
      dragRegion.style.display = '';
    };
  }, [isPushTopNav]);

  const headerPadding = safeIsMacOS ? 'pl-[96px]' : 'pl-4';
  const headerTop = safeIsMacOS ? 'top-[15px]' : 'top-[11px]';

  // Determine flex direction based on navigation position (for push mode)
  const getLayoutClass = () => {
    if (effectiveNavigationMode === 'overlay') {
      return 'flex-row';
    }

    switch (navigationPosition) {
      case 'top':
        return 'flex-col';
      case 'bottom':
        return 'flex-col-reverse';
      case 'left':
        return 'flex-row';
      case 'right':
        return 'flex-row-reverse';
      default:
        return 'flex-row';
    }
  };

  // Main content area
  const mainContent = (
    <div className="flex-1 overflow-hidden min-h-0">
      <div className="h-full w-full bg-background-primary rounded-lg overflow-hidden">
        <Outlet />
        {/* Always render ChatSessionsContainer to keep SSE connections alive.
            When navigating away from /pair, hide it with CSS */}
        <div className={isOnPairRoute ? 'contents' : 'hidden'}>
          <ChatSessionsContainer setChat={setChat} activeSessions={activeSessions} />
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'flex flex-1 w-full h-full relative animate-fade-in bg-background-secondary',
        getLayoutClass()
      )}
    >
      {/* Header controls */}
      <div
        style={{ zIndex: Z_INDEX.HEADER }}
        className={cn(
          'absolute flex items-center gap-1',
          effectiveNavigationStyle === 'condensed' &&
            navigationPosition === 'bottom' &&
            effectiveNavigationMode === 'push'
            ? 'bottom-4 right-6'
            : cn(
                headerPadding,
                headerTop,
                navigationPosition === 'right' ? 'right-6 left-auto' : 'ml-1.5'
              )
        )}
      >
        {/* Navigation trigger */}
        <Button
          onClick={() => setIsNavExpanded(!isNavExpanded)}
          className="no-drag hover:!bg-background-tertiary"
          variant="ghost"
          size="xs"
          title={isNavExpanded ? intl.formatMessage(i18n.closeNavigation) : intl.formatMessage(i18n.openNavigation)}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* Main content with navigation */}
      <div className={cn('flex flex-1 w-full h-full min-h-0 p-[2px]', getLayoutClass())}>
        {/* Push mode navigation (inline) with animation */}
        {effectiveNavigationMode === 'push' && (
          <motion.div
            ref={navRef}
            key="push-nav"
            initial={false}
            animate={{
              width: isHorizontalNav
                ? '100%'
                : isNavExpanded
                  ? effectiveNavigationStyle === 'expanded'
                    ? (navWidth ?? '30%')
                    : isCondensedIconOnly
                      ? NAV_DIMENSIONS.CONDENSED_ICON_ONLY_WIDTH
                      : (navWidth ?? NAV_DIMENSIONS.CONDENSED_WIDTH)
                  : 0,
              height: isHorizontalNav
                ? isNavExpanded
                  ? effectiveNavigationStyle === 'expanded'
                    ? NAV_DIMENSIONS.EXPANDED_HEIGHT
                    : NAV_DIMENSIONS.CONDENSED_HEIGHT
                  : 0
                : '100%',
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 40,
            }}
            style={{
              maxWidth:
                !isHorizontalNav && effectiveNavigationStyle === 'expanded'
                  ? NAV_DIMENSIONS.MAX_NAV_WIDTH
                  : undefined,
              minWidth:
                !isHorizontalNav && effectiveNavigationStyle === 'condensed' && isNavExpanded
                  ? isCondensedIconOnly
                    ? NAV_DIMENSIONS.CONDENSED_ICON_ONLY_WIDTH
                    : NAV_DIMENSIONS.CONDENSED_WIDTH
                  : undefined,
              minHeight:
                isHorizontalNav && isNavExpanded
                  ? effectiveNavigationStyle === 'expanded'
                    ? NAV_DIMENSIONS.EXPANDED_HEIGHT
                    : NAV_DIMENSIONS.CONDENSED_HEIGHT
                  : undefined,
              height: !isHorizontalNav ? '100%' : undefined,
            }}
            className={cn(
              'relative flex-shrink-0 overflow-visible',
              isHorizontalNav ? 'w-full' : 'h-full'
            )}
          >
            <div
              className={cn(
                'w-full h-full',
                effectiveNavigationStyle === 'condensed' && !isHorizontalNav
                  ? 'overflow-visible'
                  : 'overflow-hidden'
              )}
            >
              <OscarSidebar />
            </div>
            {isResizable && (
              <div
                onMouseDown={onHandleMouseDown}
                className={cn(
                  'absolute top-0 w-2 h-full z-20 cursor-col-resize group flex items-center justify-center',
                  navigationPosition === 'right' ? '-left-1' : '-right-1'
                )}
              >
                <div className="w-px h-full bg-border-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </motion.div>
        )}

        {/* Main content */}
        {mainContent}

        {/* Sprint M1 (ADR-069): docked right pane. Renders only when on a
            matter-bound /pair session by default; sticky toggle overrides.
            Resize handle on the LEFT edge (between chat and pane). */}
        {paneVis.isMounted && (
          <motion.div
            key="right-pane"
            initial={false}
            animate={{
              width: paneVis.isExpanded
                ? rightPaneWidth
                : RIGHT_PANE_CHEVRON_RAIL_WIDTH,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            style={{
              maxWidth: RIGHT_PANE_DIMENSIONS.MAX_WIDTH,
              minWidth: paneVis.isExpanded
                ? RIGHT_PANE_DIMENSIONS.MIN_WIDTH
                : RIGHT_PANE_CHEVRON_RAIL_WIDTH,
              height: '100%',
            }}
            className="relative flex-shrink-0 overflow-visible h-full"
          >
            <RightPaneShell
              isExpanded={paneVis.isExpanded}
              onToggle={() => setIsRightPaneExpanded(!paneVis.isExpanded)}
              sections={paneSections}
              areaId={paneVis.areaId}
              slug={paneVis.slug}
              sessionId={paneVis.sessionId}
            />
            {paneVis.isExpanded && (
              <div
                onMouseDown={onPaneHandleMouseDown}
                data-testid="oscar-right-pane-handle"
                className="absolute top-0 -left-1 w-2 h-full z-20 cursor-col-resize group flex items-center justify-center"
              >
                <div className="w-px h-full bg-border-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Overlay mode navigation */}
      {effectiveNavigationMode === 'overlay' && <OscarSidebar />}
    </div>
  );
};

interface AppLayoutProps {
  activeSessions: Array<{
    sessionId: string;
    initialMessage?: UserInput;
  }>;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ activeSessions }) => {
  return (
    <NavigationProvider>
      <AppLayoutContent activeSessions={activeSessions} />
    </NavigationProvider>
  );
};
