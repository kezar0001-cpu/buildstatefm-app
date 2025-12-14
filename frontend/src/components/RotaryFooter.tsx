import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Dashboard as DashboardIcon,
  Home as HomeIcon,
  Assignment as AssignmentIcon,
  Build as BuildIcon,
  RequestPage as ServiceRequestIcon,
  Lightbulb as RecommendationIcon,
  Subscriptions as PlansIcon,
} from '@mui/icons-material';
import { useCurrentUser } from '../context/UserContext';
import { getDefaultRouteForRole, getNavigationForRole } from '../utils/navigationConfig';

type RotaryNavItem = {
  key: string;
  label: string;
  href: string;
  Icon: React.ElementType;
};

export type RotaryFooterProps = {
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

const ITEM_WIDTH = 72;
const VISIBLE_ITEMS = 5;
const BASE_CONTAINER_WIDTH = ITEM_WIDTH * VISIBLE_ITEMS;

function normalizeIndex(index: number, len: number) {
  if (len <= 0) return 0;
  return ((index % len) + len) % len;
}

function shortestWrappedOffset(from: number, to: number, total: number) {
  if (total <= 0) return 0;
  const half = total / 2;
  let diff = to - from;
  diff = ((diff + half) % total + total) % total - half;
  return diff;
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect?.width != null) {
        setWidth(entry.contentRect.width);
      }
    });

    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);

    return () => ro.disconnect();
  }, []);

  return { ref, width } as const;
}

function resolveFooterItemsForRole(role: string | undefined): RotaryNavItem[] {
  const dashboardHref = getDefaultRouteForRole(role || 'PROPERTY_MANAGER');

  const ordered: RotaryNavItem[] = [
    { key: 'dashboard', label: 'Dashboard', href: dashboardHref, Icon: DashboardIcon },
    { key: 'properties', label: 'Properties', href: '/properties', Icon: HomeIcon },
    { key: 'tenant-home', label: 'My Home', href: '/tenant/home', Icon: HomeIcon },
    { key: 'inspections', label: 'Inspections', href: '/inspections', Icon: AssignmentIcon },
    { key: 'jobs', label: 'Jobs', href: '/jobs', Icon: BuildIcon },
    { key: 'service-requests', label: 'Service Requests', href: '/service-requests', Icon: ServiceRequestIcon },
    { key: 'recommendations', label: 'Recommendations', href: '/recommendations', Icon: RecommendationIcon },
    { key: 'plans', label: 'Plans', href: '/plans', Icon: PlansIcon },
  ];

  if (!role) return ordered;

  const allowed = getNavigationForRole(role);
  const allowedHrefs = new Set(allowed.map((i) => (i.href === '/dashboard' ? dashboardHref : i.href)));

  return ordered.filter((item) => {
    if (role === 'TENANT' && item.key === 'dashboard') return false;
    return allowedHrefs.has(item.href);
  });
}

function RotaryWheelItem({
  item,
  index,
  totalItems,
  rotation,
  activeIndex,
  onClick,
}: {
  item: RotaryNavItem;
  index: number;
  totalItems: number;
  rotation: ReturnType<typeof useSpring>;
  activeIndex: number;
  onClick: () => void;
}) {
  const offset = useTransform(rotation, (v) => {
    const center = -v / ITEM_WIDTH;
    return shortestWrappedOffset(center, index, totalItems);
  });
  const absOffset = useTransform(offset, (o) => Math.abs(o));

  const xPos = useTransform(offset, (o) => o * ITEM_WIDTH);
  const yPos = useTransform(absOffset, (a) => (a === 0 ? 0 : Math.pow(a, 1.35) * 6 + a * 1.5));
  const rotateX = useTransform(absOffset, (a) => a * -6);

  const scale = useTransform(absOffset, (a) => {
    if (a < 0.5) return 1.2;
    if (a < 1.5) return 0.9;
    if (a < 2.5) return 0.72;
    if (a < 3.5) return 0.55;
    return 0.3;
  });

  const opacity = useTransform(absOffset, (a) => {
    if (a < 0.5) return 1;
    if (a < 1.5) return 0.7;
    if (a < 2.5) return 0.5;
    if (a < 3.5) return 0.3;
    return 0.15;
  });

  const zIndex = useTransform(absOffset, (a) => {
    if (a < 0.5) return 50;
    if (a < 1.5) return 30;
    if (a < 2.5) return 20;
    if (a < 3.5) return 15;
    return 10;
  });

  const isActive = index === activeIndex;

  return (
    <motion.div
      style={{
        x: xPos,
        y: yPos,
        scale,
        opacity,
        rotateX,
        zIndex,
        position: 'absolute',
        left: '50%',
        marginLeft: -ITEM_WIDTH / 2,
        transformOrigin: 'center center',
      }}
      className="flex items-center justify-center"
      onClick={onClick}
    >
      <div
        className="relative flex flex-col items-center justify-center pointer-events-auto"
        style={{ width: ITEM_WIDTH, height: ITEM_WIDTH }}
      >
        <motion.div
          className={`relative z-10 transition-colors duration-200 ${isActive ? 'text-orange-600' : 'text-gray-500 dark:text-gray-400'
            }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <item.Icon sx={{ fontSize: 26 }} />
        </motion.div>

        <div
          className={`mt-1 w-[72px] text-center text-[10px] leading-none font-medium truncate transition-colors duration-200 ${isActive ? 'text-orange-600' : 'text-gray-500 dark:text-gray-400'
            }`}
        >
          {item.label}
        </div>
      </div>
    </motion.div>
  );
}

export default function RotaryFooter({ className, collapsed = false, onCollapsedChange }: RotaryFooterProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser() as unknown as { user?: { role?: string } };

  const items = useMemo(() => resolveFooterItemsForRole(user?.role), [user?.role]);
  const { ref: containerRef } = useElementWidth<HTMLDivElement>();

  const [activeIndex, setActiveIndex] = useState(0);
  const rotation = useMotionValue(0);
  const springRotation = useSpring(rotation, { stiffness: 200, damping: 25, mass: 0.5 });
  const panStartRotation = useRef(0);
  const panStartX = useRef(0);
  const isPanning = useRef(false);
  const suppressNextClick = useRef(false);
  const rafId = useRef<number | null>(null);
  const pendingRotation = useRef<number | null>(null);

  const handleToggleCollapsed = useCallback(() => {
    onCollapsedChange?.(!collapsed);
  }, [collapsed, onCollapsedChange]);

  const scheduleRotationUpdate = useCallback(
    (next: number) => {
      pendingRotation.current = next;
      if (rafId.current != null) return;
      rafId.current = window.requestAnimationFrame(() => {
        rafId.current = null;
        const value = pendingRotation.current;
        if (value == null) return;
        rotation.set(value);
      });
    },
    [rotation]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (items.length === 0) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button')) return;

      isPanning.current = true;
      suppressNextClick.current = false;
      panStartX.current = e.clientX;
      panStartRotation.current = rotation.get();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    [items.length, rotation]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanning.current || items.length === 0) return;
      const sensitivity = 0.55;
      const dx = e.clientX - panStartX.current;
      if (Math.abs(dx) > 4) {
        suppressNextClick.current = true;
      }
      const next = panStartRotation.current + dx * sensitivity;
      scheduleRotationUpdate(next);

      const idx = normalizeIndex(-Math.round(next / ITEM_WIDTH), items.length);
      setActiveIndex((prev) => (prev === idx ? prev : idx));
    },
    [items.length, scheduleRotationUpdate]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanning.current) return;
      isPanning.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (suppressNextClick.current) {
        window.setTimeout(() => {
          suppressNextClick.current = false;
        }, 0);
      }
    },
    [rotation]
  );

  const handleItemClick = useCallback(
    (idx: number) => {
      if (suppressNextClick.current) return;
      const item = items[idx];
      if (!item) return;
      setActiveIndex(idx);
      navigate(item.href);
    },
    [items, navigate, rotation]
  );

  useEffect(() => {
    if (items.length === 0) return;

    const idx = items.findIndex(
      (item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
    );

    const initial = idx >= 0 ? idx : 0;
    setActiveIndex(initial);
    rotation.set(-initial * ITEM_WIDTH);
  }, [items, location.pathname, rotation]);

  if (items.length === 0) return null;

  return (
    <div className={`md:hidden ${className || ''}`}>
      <div className="fixed bottom-0 left-0 right-0 z-[60] pointer-events-none">
        {collapsed ? (
          <div
            className="pointer-events-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
          >
            <div className="flex justify-center px-3 pt-2">
              <button
                type="button"
                onClick={handleToggleCollapsed}
                className="bg-white/85 backdrop-blur-xl border border-gray-200 rounded-full shadow-lg px-4 py-2 text-xs font-semibold text-gray-700"
              >
                Open navigation
              </button>
            </div>
          </div>
        ) : (
          <div
            className="pointer-events-auto bg-white/85 backdrop-blur-xl border-t border-gray-200"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
          >
            <div className="flex justify-center px-3 pt-2">
              <div
                ref={containerRef}
                className="relative bg-white/80 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-xl overflow-visible max-w-[calc(100vw-1.5rem)]"
                style={{ height: 74, width: BASE_CONTAINER_WIDTH }}
              >
                <button
                  type="button"
                  onClick={handleToggleCollapsed}
                  className="absolute -top-3 right-3 z-[70] bg-white/90 border border-gray-200 rounded-full shadow px-2 py-1 text-[10px] font-semibold text-gray-700"
                >
                  Hide
                </button>

                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white/80 via-white/40 to-transparent z-40 pointer-events-none rounded-l-2xl" />
                <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white/80 via-white/40 to-transparent z-40 pointer-events-none rounded-r-2xl" />

                <motion.div
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="absolute inset-0 cursor-grab active:cursor-grabbing"
                  style={{ touchAction: 'pan-y' }}
                >
                  <div className="relative h-full flex items-center justify-center">
                    {items.map((item, index) => (
                      <RotaryWheelItem
                        key={item.key}
                        item={item}
                        index={index}
                        totalItems={items.length}
                        rotation={springRotation}
                        activeIndex={activeIndex}
                        onClick={() => handleItemClick(index)}
                      />
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
