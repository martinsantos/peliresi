/**
 * GlowCard - Premium Card Component with Neon Effects
 * Control Room 2077 Design System
 *
 * Features:
 * - Neon glow border animation
 * - Framer Motion hover effects
 * - Multiple color variants
 * - Glass morphism background
 */

import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import './GlowCard.css';

export type GlowVariant = 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'blue' | 'default';

// Generic icon component type that works with lucide-react and other icon libraries
type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

export interface GlowCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  /** Card content */
  children: React.ReactNode;
  /** Color variant for the glow effect */
  variant?: GlowVariant;
  /** Whether the card should pulse */
  pulse?: boolean;
  /** Icon component to display */
  icon?: IconComponent;
  /** Icon color override */
  iconColor?: string;
  /** Title text */
  title?: string;
  /** Subtitle text */
  subtitle?: string;
  /** Main value (for stat cards) */
  value?: string | number;
  /** Whether to show the animated border */
  glowBorder?: boolean;
  /** Hover lift effect intensity: none, subtle, normal, strong */
  hoverLift?: 'none' | 'subtle' | 'normal' | 'strong';
  /** Additional class names */
  className?: string;
}

const liftValues = {
  none: 0,
  subtle: -2,
  normal: -4,
  strong: -8,
};

export const GlowCard: React.FC<GlowCardProps> = ({
  children,
  variant = 'default',
  pulse = false,
  icon: Icon,
  iconColor,
  title,
  subtitle,
  value,
  glowBorder = true,
  hoverLift = 'normal',
  className = '',
  ...motionProps
}) => {
  const cardVariants = {
    rest: {
      y: 0,
      scale: 1,
    },
    hover: {
      y: liftValues[hoverLift],
      scale: hoverLift !== 'none' ? 1.01 : 1,
      transition: {
        duration: 0.3,
        ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
      },
    },
    tap: {
      scale: 0.98,
      transition: { duration: 0.1 },
    },
  };

  const iconVariants = {
    rest: { scale: 1, rotate: 0 },
    hover: {
      scale: 1.1,
      rotate: 5,
      transition: { duration: 0.3 },
    },
  };

  const valueVariants = {
    rest: { scale: 1 },
    hover: {
      scale: 1.02,
      transition: { duration: 0.2 },
    },
  };

  return (
    <motion.div
      className={`glow-card glow-card--${variant} ${pulse ? 'glow-card--pulse' : ''} ${glowBorder ? 'glow-card--border' : ''} ${className}`}
      variants={cardVariants}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      {...motionProps}
    >
      {/* Animated glow border overlay */}
      {glowBorder && <div className="glow-card__border-glow" />}

      {/* Scan line effect */}
      <div className="glow-card__scanline" />

      {/* Content */}
      <div className="glow-card__content">
        {/* Header with icon */}
        {(Icon || title) && (
          <div className="glow-card__header">
            {Icon && (
              <motion.div
                className="glow-card__icon"
                variants={iconVariants}
                style={iconColor ? { color: iconColor } : undefined}
              >
                <Icon size={24} />
              </motion.div>
            )}
            {(title || subtitle) && (
              <div className="glow-card__titles">
                {title && <h3 className="glow-card__title">{title}</h3>}
                {subtitle && <p className="glow-card__subtitle">{subtitle}</p>}
              </div>
            )}
          </div>
        )}

        {/* Main value */}
        {value !== undefined && (
          <motion.div className="glow-card__value" variants={valueVariants}>
            {value}
          </motion.div>
        )}

        {/* Children content */}
        {children}
      </div>
    </motion.div>
  );
};

/**
 * GlowStatCard - Specialized stat card with GlowCard
 */
export interface GlowStatCardProps {
  label: string;
  value: string | number;
  icon: IconComponent;
  variant?: GlowVariant;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  pulse?: boolean;
  onClick?: () => void;
}

export const GlowStatCard: React.FC<GlowStatCardProps> = ({
  label,
  value,
  icon,
  variant = 'cyan',
  trend,
  pulse = false,
  onClick,
}) => {
  return (
    <GlowCard
      variant={variant}
      icon={icon}
      pulse={pulse}
      hoverLift="normal"
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="glow-stat">
        <div className="glow-stat__value">{value}</div>
        <div className="glow-stat__label">{label}</div>
        {trend && (
          <div className={`glow-stat__trend glow-stat__trend--${trend.direction}`}>
            {trend.direction === 'up' && '↑'}
            {trend.direction === 'down' && '↓'}
            {trend.direction === 'neutral' && '→'}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
    </GlowCard>
  );
};

export default GlowCard;
