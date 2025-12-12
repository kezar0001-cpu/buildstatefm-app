import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { animate, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
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

const ITEM_WIDTH = 80;
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

function RotaryWheelItem({
  item,
  index,
  totalItems,
  rotation,
  onClick,
}: {
  item: RotaryNavItem;
  index: number;
  totalItems: number;
  rotation: ReturnType<typeof useSpring>;
  onClick: () => void;
}) {
  const offset = useTransform(rotation, (v) => {
    const center = -v / ITEM_WIDTH;
    return shortestWrappedOffset(center, index, totalItems);
  });
  const absOffset = useTransform(offset, (o) => Math.abs(o));

  const xPos = useTransform(offset, (o) => o * ITEM_WIDTH);
  const yPos = useTransform(absOffset, (a) => (a === 0 ? 0 : Math.pow(a, 1.4) * 10 + a * 2));
  const rotateX = useTransform(absOffset, (a) => a * -6);

  const scale = useTransform(absOffset, (a) => {
    if (a < 0.5) return 1.3;
    if (a < 1.5) return 0.85;
    if (a < 2.5) return 0.65;
    if (a < 3.5) return 0.45;
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

  const isActive = useTransform(absOffset, (a) => a < 0.5);

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
          style={{ opacity: useTransform(isActive, (v) => (v ? 1 : 0)) }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="h-16 w-16 rounded-full bg-orange-500/10 border-2 border-orange-500/40" />
          </motion.div>
        </motion.div>

        <motion.div
          className="relative z-10 transition-colors duration-200"
          style={{
            color: useTransform(isActive, (v) => (v ? '#ea580c' : 'rgba(107, 114, 128, 1)')),
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            style={{
              scale: useTransform(isActive, (v) => (v ? 1.0 : 0.9)),
            }}
          >
            <item.Icon size={30} strokeWidth={2.3} />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function RotaryFooter({ className }: RotaryFooterProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser() as unknown as { user?: { role?: string } };

  const items = useMemo(() => resolveFooterItemsForRole(user?.role), [user?.role]);
  const { ref: containerRef } = useElementWidth<HTMLDivElement>();

  const [activeIndex, setActiveIndex] = useState(0);
  const rotation = useMotionValue(0);
  const springRotation = useSpring(rotation, { stiffness: 200, damping: 25, mass: 0.5 });
  const dragStartRotation = useRef(0);

  const snapToNearest = useCallback(() => {
    if (items.length === 0) return;
    const current = rotation.get();
    const snapped = Math.round(current / ITEM_WIDTH) * ITEM_WIDTH;
    const idx = normalizeIndex(-Math.round(snapped / ITEM_WIDTH), items.length);

    animate(rotation, snapped, {
      type: 'spring',
      stiffness: 200,
      damping: 25,
      mass: 0.5,
      onComplete: () => {
        const cycle = ITEM_WIDTH * items.length;
        const normalized = ((snapped % cycle) + cycle) % cycle;
        rotation.set(normalized);
      },
    });

    setActiveIndex(idx);
  }, [items.length, rotation]);

  const handleDragStart = useCallback(() => {
    dragStartRotation.current = rotation.get();
  }, [rotation]);

  const handleDrag = useCallback(
    (_: unknown, info: { offset: { x: number } }) => {
      if (items.length === 0) return;
      const sensitivity = 0.55;
      const next = dragStartRotation.current + info.offset.x * sensitivity;
      rotation.set(next);

      const idx = normalizeIndex(-Math.round(next / ITEM_WIDTH), items.length);
      setActiveIndex((prev) => (prev === idx ? prev : idx));
    },
    [items.length, rotation]
  );

  const handleItemClick = useCallback(
    (idx: number) => {
      const item = items[idx];
      if (!item) return;
      setActiveIndex(idx);
      const target = -idx * ITEM_WIDTH;
      animate(rotation, target, {
        type: 'spring',
        stiffness: 200,
        damping: 25,
        mass: 0.5,
        onComplete: () => {
          const cycle = ITEM_WIDTH * items.length;
          const normalized = ((target % cycle) + cycle) % cycle;
          rotation.set(normalized);
        },
      });
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
      <div className="fixed bottom-0 left-1/2 z-[60] w-full -translate-x-1/2 pb-8 pt-6 pointer-events-none">
        <div className="pointer-events-auto">
          <div className="text-center mb-5">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-orange-600 text-base font-semibold"
            >
              {items[activeIndex]?.label}
            </motion.div>
          </div>

          <div className="flex justify-center px-4">
            <div
              ref={containerRef}
              className="relative bg-white/90 backdrop-blur-xl border border-gray-200 rounded-full shadow-2xl overflow-visible w-[400px] max-w-[calc(100vw-2rem)]"
              style={{ height: 90, width: BASE_CONTAINER_WIDTH }}
            >
              <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white/90 via-white/60 to-transparent z-40 pointer-events-none rounded-l-full" />
              <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white/90 via-white/60 to-transparent z-40 pointer-events-none rounded-r-full" />

              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.05}
                dragMomentum
                onDragStart={handleDragStart}
                onDrag={handleDrag}
                onDragEnd={snapToNearest}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
              >
                <div className="relative h-full flex items-center justify-center">
                  {items.map((item, index) => (
                    <RotaryWheelItem
                      key={item.key}
                      item={item}
                      index={index}
                      totalItems={items.length}
                      rotation={springRotation}
                      onClick={() => handleItemClick(index)}
                    />
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          <div className="flex justify-center gap-1.5 mt-6">
            {items.map((item, index) => (
              <button
                key={item.key}
                onClick={() => handleItemClick(index)}
                className="group transition-all"
                aria-label={`Go to ${item.label}`}
                type="button"
              >
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === activeIndex
                      ? 'bg-orange-500 w-6'
                      : 'bg-gray-300 w-1.5 group-hover:bg-gray-400 group-hover:w-3'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
