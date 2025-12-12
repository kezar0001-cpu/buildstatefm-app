import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'framer-motion';
import {
  Building2,
  ClipboardList,
  Gauge,
  Lightbulb,
  NotebookTabs,
  ReceiptText,
  ScrollText,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useCurrentUser } from '../context/UserContext';
import { getDefaultRouteForRole, getNavigationForRole } from '../utils/navigationConfig';

type RotaryNavItem = {
  key: string;
  label: string;
  href: string;
  Icon: LucideIcon;
};

export type RotaryFooterProps = {
  className?: string;
};

const ITEM_SPACING = 84;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getActiveIndexFromX(x: number, centerOffset: number, itemSpacing: number, itemCount: number) {
  if (itemCount <= 0) return 0;
  const idx = Math.round((centerOffset - x) / itemSpacing);
  return clamp(idx, 0, itemCount - 1);
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
    { key: 'dashboard', label: 'Dashboard', href: dashboardHref, Icon: Gauge },
    { key: 'properties', label: 'Properties', href: '/properties', Icon: Building2 },
    { key: 'inspections', label: 'Inspections', href: '/inspections', Icon: ClipboardList },
    { key: 'jobs', label: 'Jobs', href: '/jobs', Icon: Wrench },
    { key: 'service-requests', label: 'Service Requests', href: '/service-requests', Icon: ReceiptText },
    { key: 'recommendations', label: 'Recommendations', href: '/recommendations', Icon: Lightbulb },
    { key: 'reports', label: 'Reports', href: '/reports', Icon: ScrollText },
    { key: 'plans', label: 'Plans', href: '/plans', Icon: NotebookTabs },
  ];

  if (!role) return ordered;

  const allowed = getNavigationForRole(role);
  const allowedHrefs = new Set(allowed.map((i) => (i.href === '/dashboard' ? dashboardHref : i.href)));

  return ordered.filter((item) => allowedHrefs.has(item.href));
}

function RotaryItem({
  item,
  index,
  x,
  centerOffset,
  activeIndex,
  onSelect,
}: {
  item: RotaryNavItem;
  index: number;
  x: ReturnType<typeof useMotionValue<number>>;
  centerOffset: number;
  activeIndex: number;
  onSelect: (idx: number) => void;
}) {
  const targetX = centerOffset - index * ITEM_SPACING;
  const distance = useTransform(x, (v) => Math.abs(v - targetX));

  const scale = useTransform(distance, [0, ITEM_SPACING, ITEM_SPACING * 2], [1.3, 0.9, 0.7], {
    clamp: true,
  });

  const opacity = useTransform(distance, [0, ITEM_SPACING, ITEM_SPACING * 2], [1, 0.75, 0.5], {
    clamp: true,
  });

  const isActive = index === activeIndex;

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className="w-[84px] shrink-0 select-none outline-none"
      aria-current={isActive ? 'page' : undefined}
    >
      <motion.div
        style={{ scale, opacity }}
        className="flex flex-col items-center justify-center"
      >
        <div
          className={
            isActive
              ? 'text-orange-500'
              : 'text-slate-700/70 dark:text-slate-200/70'
          }
        >
          <item.Icon size={26} strokeWidth={2.2} />
        </div>

        <div className="mt-1 h-4">
          {isActive && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              className="text-[11px] font-semibold text-orange-500"
            >
              {item.label}
            </motion.div>
          )}
        </div>
      </motion.div>
    </button>
  );
}

export default function RotaryFooter({ className }: RotaryFooterProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser() as unknown as { user?: { role?: string } };

  const items = useMemo(() => resolveFooterItemsForRole(user?.role), [user?.role]);

  const { ref: containerRef, width: containerWidth } = useElementWidth<HTMLDivElement>();
  const centerOffset = Math.max(0, containerWidth / 2 - ITEM_SPACING / 2);

  const x = useMotionValue(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const bounds = useMemo(() => {
    const maxX = centerOffset;
    const minX = centerOffset - Math.max(0, (items.length - 1) * ITEM_SPACING);
    return { left: minX, right: maxX };
  }, [centerOffset, items.length]);

  const snapToIndex = useCallback(
    (idx: number, opts?: { immediate?: boolean }) => {
      const clamped = clamp(idx, 0, Math.max(0, items.length - 1));
      const target = centerOffset - clamped * ITEM_SPACING;

      setActiveIndex(clamped);

      if (opts?.immediate) {
        x.set(target);
        return;
      }

      animate(x, target, {
        type: 'spring',
        stiffness: 550,
        damping: 45,
      });
    },
    [centerOffset, items.length, x]
  );

  useEffect(() => {
    if (containerWidth <= 0 || items.length === 0) return;

    const idx = items.findIndex(
      (item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
    );

    snapToIndex(idx >= 0 ? idx : 0, { immediate: true });
  }, [containerWidth, items, location.pathname, snapToIndex]);

  useMotionValueEvent(x, 'change', (latest) => {
    if (items.length === 0) return;
    const idx = getActiveIndexFromX(latest, centerOffset, ITEM_SPACING, items.length);
    setActiveIndex((prev) => (prev === idx ? prev : idx));
  });

  const handleDragEnd = useCallback(() => {
    const idx = getActiveIndexFromX(x.get(), centerOffset, ITEM_SPACING, items.length);
    snapToIndex(idx);
  }, [centerOffset, items.length, snapToIndex, x]);

  const handleSelect = useCallback(
    (idx: number) => {
      const item = items[idx];
      if (!item) return;

      snapToIndex(idx);
      navigate(item.href);
    },
    [items, navigate, snapToIndex]
  );

  if (items.length === 0) return null;

  return (
    <div className={`md:hidden ${className || ''}`}>
      <div className="fixed bottom-4 left-1/2 z-[60] w-[min(380px,calc(100vw-2rem))] -translate-x-1/2">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-full border border-white/20 bg-white/70 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/60"
        >
          <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-black/5 dark:ring-white/5" />

          <motion.div
            drag="x"
            dragElastic={0.08}
            dragConstraints={bounds}
            onDragEnd={handleDragEnd}
            style={{ x }}
            className="flex items-center px-2 py-2"
          >
            {items.map((item, index) => (
              <RotaryItem
                key={item.key}
                item={item}
                index={index}
                x={x}
                centerOffset={centerOffset}
                activeIndex={activeIndex}
                onSelect={handleSelect}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
