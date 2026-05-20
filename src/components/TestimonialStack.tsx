// Adapted from Ruixen's CardStack — 3D fan-out carousel with drag + spring animation.
// Original uses next/link + lucide-react + image content; we strip both and replace
// the card content with testimonial quote + author for Amplo's editorial tone.
import * as React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import './TestimonialStack.css';

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
  rating: number;
}

interface TestimonialStackProps {
  items: Testimonial[];
  maxVisible?: number;
  cardWidth?: number;
  cardHeight?: number;
  overlap?: number;
  spreadDeg?: number;
  perspectivePx?: number;
  depthPx?: number;
  tiltXDeg?: number;
  activeLiftPx?: number;
  activeScale?: number;
  inactiveScale?: number;
  springStiffness?: number;
  springDamping?: number;
  autoAdvance?: boolean;
  intervalMs?: number;
  pauseOnHover?: boolean;
}

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ');
}

function wrapIndex(n: number, len: number) {
  if (len <= 0) return 0;
  return ((n % len) + len) % len;
}

function signedOffset(i: number, active: number, len: number, loop: boolean) {
  const raw = i - active;
  if (!loop || len <= 1) return raw;
  const alt = raw > 0 ? raw - len : raw + len;
  return Math.abs(alt) < Math.abs(raw) ? alt : raw;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function TestimonialStack({
  items,
  maxVisible = 5,
  cardWidth = 480,
  cardHeight = 360,
  overlap = 0.55,
  spreadDeg = 36,
  perspectivePx = 1200,
  depthPx = 130,
  tiltXDeg = 10,
  activeLiftPx = 16,
  activeScale = 1.02,
  inactiveScale = 0.93,
  springStiffness = 280,
  springDamping = 28,
  autoAdvance = true,
  intervalMs = 4000,
  pauseOnHover = true,
}: TestimonialStackProps) {
  const reduceMotion = useReducedMotion();
  const len = items.length;
  const loop = true;

  const [active, setActive] = React.useState(0);
  // "interacting" covers mouse hover, touch, and drag — anything that signals
  // the visitor is currently engaging with the stack. Auto-advance pauses
  // while this is true.
  const [interacting, setInteracting] = React.useState(false);

  React.useEffect(() => {
    setActive((a) => wrapIndex(a, len));
  }, [len]);

  const maxOffset = Math.max(0, Math.floor(maxVisible / 2));
  const cardSpacing = Math.max(10, Math.round(cardWidth * (1 - overlap)));
  const stepDeg = maxOffset > 0 ? spreadDeg / maxOffset : 0;

  const prev = React.useCallback(() => {
    if (!len) return;
    setActive((a) => wrapIndex(a - 1, len));
  }, [len]);

  const next = React.useCallback(() => {
    if (!len) return;
    setActive((a) => wrapIndex(a + 1, len));
  }, [len]);

  // Keyboard navigation when stage focused
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  };

  // Auto-advance (paused while the visitor is interacting)
  React.useEffect(() => {
    if (!autoAdvance || reduceMotion || !len) return;
    if (pauseOnHover && interacting) return;
    const id = window.setInterval(() => next(), Math.max(700, intervalMs));
    return () => window.clearInterval(id);
  }, [autoAdvance, intervalMs, interacting, pauseOnHover, reduceMotion, len, next]);

  if (!len) return null;

  return (
    <div
      className="ts-shell"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onTouchStart={() => setInteracting(true)}
      onTouchEnd={() => setInteracting(false)}
      onTouchCancel={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={() => setInteracting(false)}
    >
      <div
        className="ts-stage"
        style={{ height: Math.max(420, cardHeight + 100) }}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-roledescription="carousel"
        aria-label="Client testimonials"
      >
        <div className="ts-perspective" style={{ perspective: `${perspectivePx}px` }}>
          <AnimatePresence initial={false}>
            {items.map((item, i) => {
              const off = signedOffset(i, active, len, loop);
              const abs = Math.abs(off);
              const visible = abs <= maxOffset;
              if (!visible) return null;

              const rotateZ = off * stepDeg;
              const x = off * cardSpacing;
              const y = abs * 8;
              const z = -abs * depthPx;
              const isActive = off === 0;
              const scale = isActive ? activeScale : inactiveScale;
              const lift = isActive ? -activeLiftPx : 0;
              const rotateX = isActive ? 0 : tiltXDeg;
              const zIndex = 100 - abs;

              const dragProps = isActive
                ? {
                    drag: 'x' as const,
                    dragConstraints: { left: 0, right: 0 },
                    dragElastic: 0.18,
                    onDragEnd: (
                      _e: PointerEvent | TouchEvent | MouseEvent,
                      info: { offset: { x: number }; velocity: { x: number } }
                    ) => {
                      if (reduceMotion) return;
                      const travel = info.offset.x;
                      const v = info.velocity.x;
                      const threshold = Math.min(160, cardWidth * 0.22);
                      if (travel > threshold || v > 650) prev();
                      else if (travel < -threshold || v < -650) next();
                    },
                  }
                : {};

              return (
                <motion.div
                  key={`${item.name}-${i}`}
                  className={cn('ts-card', isActive ? 'is-active' : 'is-stacked')}
                  style={{
                    width: cardWidth,
                    height: cardHeight,
                    zIndex,
                    transformStyle: 'preserve-3d',
                  }}
                  initial={
                    reduceMotion
                      ? false
                      : { opacity: 0, y: y + 40, x, rotateZ, rotateX, scale }
                  }
                  animate={{ opacity: 1, x, y: y + lift, rotateZ, rotateX, scale }}
                  transition={{
                    type: 'spring',
                    stiffness: springStiffness,
                    damping: springDamping,
                  }}
                  onClick={() => setActive(i)}
                  {...dragProps}
                >
                  <div
                    className="ts-card-inner"
                    style={{ transform: `translateZ(${z}px)`, transformStyle: 'preserve-3d' }}
                  >
                    <TestimonialCard item={item} />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Dot navigation */}
      <div className="ts-dots" role="tablist" aria-label="Testimonial navigation">
        {items.map((it, idx) => (
          <button
            key={`${it.name}-dot-${idx}`}
            onClick={() => setActive(idx)}
            className={cn('ts-dot', idx === active && 'is-on')}
            aria-label={`Show testimonial from ${it.name}`}
            aria-selected={idx === active}
            role="tab"
            type="button"
          />
        ))}
      </div>
    </div>
  );
}

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <article className="tc">
      <div className="tc-stars" aria-label={`Rated ${item.rating} out of 5`}>
        {Array.from({ length: item.rating }).map((_, i) => (
          <svg
            key={i}
            viewBox="0 0 20 20"
            fill="currentColor"
            className="tc-star"
            aria-hidden="true"
          >
            <path d="M10 1.5l2.61 5.29 5.84.85-4.22 4.12.99 5.81L10 14.84l-5.22 2.74.99-5.81L1.55 7.64l5.84-.85L10 1.5z" />
          </svg>
        ))}
      </div>

      <p className="tc-quote">{item.quote}</p>

      <div className="tc-footer">
        <span className="tc-avatar" aria-hidden="true">
          {initials(item.name)}
        </span>
        <div className="tc-meta">
          <p className="tc-name">{item.name}</p>
          <p className="tc-role">{item.role}</p>
          <p className="tc-company">{item.company}</p>
        </div>
      </div>
    </article>
  );
}
