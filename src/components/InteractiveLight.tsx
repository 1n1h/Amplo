// Adapted from Ruixen's interactive-light component (light_header.md).
// A glowing orb with a long shine trail that follows the cursor. We restrain
// the original's loud yellow + jumpy intro into something atmospheric for the
// hero — brand gold at lower opacity, slower transitions, no tilt drift.
import { useEffect, useRef, useState } from 'react';

interface InteractiveLightProps {
  /** Hex shine color. Defaults to brand gold. */
  shineColor?: string;
  /** Orb height (CSS length). */
  lampHeight?: string;
  /** Orb width (CSS length). */
  lampWidth?: string;
  /** Optional directional tilt of the shine based on cursor motion. */
  enableTilt?: boolean;
  /** Tracking transition duration (ms). Higher = smoother / lazier. */
  transitionDuration?: number;
  /** Confine cursor tracking to this element's bounding box. If false, tracks
   * across the whole viewport. Default: true (so the light only reacts while
   * the cursor is over the hero). */
  scoped?: boolean;
  /** Orb base opacity. Default 0.50 — toned down 5% from the original. */
  opacity?: number;
}

function lightenColor(color: string, percent: number) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const newR = Math.min(255, Math.floor(r + ((255 - r) * percent) / 100));
  const newG = Math.min(255, Math.floor(g + ((255 - g) * percent) / 100));
  const newB = Math.min(255, Math.floor(b + ((255 - b) * percent) / 100));
  return `rgb(${newR}, ${newG}, ${newB})`;
}

type Direction = 'left' | 'right' | 'top' | 'bottom' | 'center';

function getLampBoxShadow(direction: Direction, shineColor: string) {
  const light20 = lightenColor(shineColor, 20);
  const light10 = lightenColor(shineColor, 10);
  const light5 = lightenColor(shineColor, 5);
  switch (direction) {
    case 'left':
      return `
        0 0 1vh 0.5vh ${light20},
        -1vh 0 2vh 1vh ${light20},
        -4vh 0 5vh 1vh ${light10},
        -10vh 0 10vh 1vh ${light5},
        -13vh 0 15vh 1vh ${shineColor},
        -15vh 0 20vh 1vh ${shineColor},
        -25vh 0 25vh 0 ${shineColor},
        -50vh 0 50vh 0 ${shineColor}
      `;
    case 'right':
      return `
        0 0 1vh 0.5vh ${light20},
        1vh 0 2vh 1vh ${light20},
        4vh 0 5vh 1vh ${light10},
        10vh 0 10vh 1vh ${light5},
        13vh 0 15vh 1vh ${shineColor},
        15vh 0 20vh 1vh ${shineColor},
        25vh 0 25vh 0 ${shineColor},
        50vh 0 50vh 0 ${shineColor}
      `;
    case 'top':
      return `
        0 0 1vh 0.5vh ${light20},
        0 -1vh 2vh 1vh ${light20},
        0 -4vh 5vh 1vh ${light10},
        0 -10vh 10vh 1vh ${light5},
        0 -13vh 15vh 1vh ${shineColor},
        0 -15vh 20vh 1vh ${shineColor},
        0 -25vh 25vh 0 ${shineColor},
        0 -50vh 50vh 0 ${shineColor}
      `;
    case 'bottom':
      return `
        0 0 1vh 0.5vh ${light20},
        0 1vh 2vh 1vh ${light20},
        0 4vh 5vh 1vh ${light10},
        0 10vh 10vh 1vh ${light5},
        0 13vh 15vh 1vh ${shineColor},
        0 15vh 20vh 1vh ${shineColor},
        0 25vh 25vh 0 ${shineColor},
        0 50vh 50vh 0 ${shineColor}
      `;
    default:
      return `
        0 0 1vh 0.5vh ${light20},
        0 0 2vh 1vh ${light20},
        0 0 5vh 1vh ${light10},
        0 0 10vh 1vh ${light5},
        0 0 15vh 1vh ${shineColor},
        0 0 20vh 1vh ${shineColor},
        0 0 25vh 1vh ${shineColor},
        0 0 50vh 1vh ${shineColor}
      `;
  }
}

export function InteractiveLight({
  shineColor = '#c9a961',
  lampHeight = '8vh',
  lampWidth = '8vh',
  enableTilt = false,
  transitionDuration = 720,
  scoped = true,
  opacity = 0.5,
}: InteractiveLightProps) {
  const lampRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<Direction>('center');
  const [ready, setReady] = useState(false);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);

  useEffect(() => {
    const lamp = lampRef.current;
    const container = containerRef.current;
    if (!lamp || !container) return;

    const trackTo = (xPos: number, yPos: number) => {
      lamp.style.transform = `translate(${xPos - lamp.offsetWidth / 2}px, ${yPos - lamp.offsetHeight / 2}px)`;
    };

    // Intro animation: orb sweeps from off-stage right, then settles top-center.
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height * 0.35;

    trackTo(rect.width * 1.4, cy);

    const t1 = window.setTimeout(() => {
      trackTo(cx, cy);
    }, 80);
    const t2 = window.setTimeout(() => setReady(true), 1100);

    const handleMove = (e: MouseEvent) => {
      if (!ready) return;
      const r = container.getBoundingClientRect();
      const xPos = e.clientX - r.left;
      const yPos = e.clientY - r.top;

      if (scoped && (xPos < 0 || xPos > r.width || yPos < 0 || yPos > r.height)) {
        // Cursor left the hero — drift back toward center top.
        trackTo(r.width / 2, r.height * 0.35);
        return;
      }

      if (enableTilt) {
        const lastX = lastXRef.current;
        const lastY = lastYRef.current;
        const dx = xPos - lastX;
        const dy = yPos - lastY;
        if (Math.abs(dx) > Math.abs(dy)) {
          setDirection(dx > 1 ? 'right' : dx < -1 ? 'left' : 'center');
        } else {
          setDirection(dy > 1 ? 'bottom' : dy < -1 ? 'top' : 'center');
        }
      }

      trackTo(xPos, yPos);
      lastXRef.current = xPos;
      lastYRef.current = yPos;
    };

    document.addEventListener('mousemove', handleMove);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [ready, enableTilt, scoped]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="il-container"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        ref={lampRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: lampHeight,
          width: lampWidth,
          backgroundColor: '#fff',
          borderRadius: `calc(${lampWidth} / 2)`,
          boxShadow: getLampBoxShadow(direction, shineColor),
          transition: `transform ${transitionDuration}ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 600ms ease`,
          opacity,
          willChange: 'transform',
        }}
      />
    </div>
  );
}
