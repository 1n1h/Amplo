// Animated rotating conic-gradient border. Adapted from the spec — pure CSS
// animation under the hood (no framer-motion, no React state), but accepts
// props so the look can be tuned per-instance.
//
// Astro renders this without a `client:` directive: SSR'd to static HTML,
// and the CSS animation runs in the browser without any hydration JS.
import * as React from 'react';
import './BorderRotate.css';

export type AnimationMode = 'auto-rotate' | 'rotate-on-hover' | 'stop-rotate-on-hover';

export interface BorderRotateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'className'> {
  children: React.ReactNode;
  className?: string;
  animationMode?: AnimationMode;
  /** Seconds for one full 360° rotation. Default 5. */
  animationSpeed?: number;
  gradientColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  backgroundColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  style?: React.CSSProperties;
}

const defaultGradientColors = {
  primary: '#8a6f30', // deep bronze (dark gold)
  secondary: '#c9a961', // brand gold
  accent: '#e7d8a4', // light gold
};

function animationClass(mode: AnimationMode): string {
  switch (mode) {
    case 'auto-rotate':
      return 'gradient-border-auto';
    case 'rotate-on-hover':
      return 'gradient-border-hover';
    case 'stop-rotate-on-hover':
      return 'gradient-border-stop-hover';
    default:
      return '';
  }
}

export function BorderRotate({
  children,
  className = '',
  animationMode = 'auto-rotate',
  animationSpeed = 5,
  gradientColors = defaultGradientColors,
  backgroundColor = '#13234a', // navy-elevated default
  borderWidth = 2,
  borderRadius = 18,
  style = {},
  ...rest
}: BorderRotateProps) {
  const combinedStyle = {
    '--gradient-primary': gradientColors.primary,
    '--gradient-secondary': gradientColors.secondary,
    '--gradient-accent': gradientColors.accent,
    '--bg-color': backgroundColor,
    '--border-width': `${borderWidth}px`,
    '--border-radius': `${borderRadius}px`,
    '--animation-duration': `${animationSpeed}s`,
    border: `${borderWidth}px solid transparent`,
    borderRadius: `${borderRadius}px`,
    backgroundImage: `
      linear-gradient(${backgroundColor}, ${backgroundColor}),
      conic-gradient(
        from var(--gradient-angle, 0deg),
        ${gradientColors.primary} 0%,
        ${gradientColors.secondary} 37%,
        ${gradientColors.accent} 30%,
        ${gradientColors.secondary} 33%,
        ${gradientColors.primary} 40%,
        ${gradientColors.primary} 50%,
        ${gradientColors.secondary} 77%,
        ${gradientColors.accent} 80%,
        ${gradientColors.secondary} 83%,
        ${gradientColors.primary} 90%
      )
    `,
    backgroundClip: 'padding-box, border-box',
    backgroundOrigin: 'padding-box, border-box',
    ...style,
  } as React.CSSProperties;

  return (
    <div
      className={`gradient-border-component ${animationClass(animationMode)} ${className}`}
      style={combinedStyle}
      {...rest}
    >
      {children}
    </div>
  );
}
