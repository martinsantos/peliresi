/**
 * AnimatedCounter - Animated Number Display Component
 * Control Room 2077 Design System
 *
 * Features:
 * - Smooth counting animation with framer-motion
 * - Multiple format options (number, currency, percentage)
 * - Suffix/prefix support
 * - Neon glow effect on value change
 * - Responsive sizing
 */

import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import './AnimatedCounter.css';

export type CounterVariant = 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'blue' | 'default';
export type CounterSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type CounterFormat = 'number' | 'currency' | 'percentage' | 'decimal';

export interface AnimatedCounterProps {
  /** The target value to animate to */
  value: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Prefix text (e.g., "$") */
  prefix?: string;
  /** Suffix text (e.g., "kg", "%") */
  suffix?: string;
  /** Number format */
  format?: CounterFormat;
  /** Decimal places for decimal format */
  decimals?: number;
  /** Color variant */
  variant?: CounterVariant;
  /** Size variant */
  size?: CounterSize;
  /** Whether to show highlight animation on change */
  highlightOnChange?: boolean;
  /** Whether to show glow effect */
  glow?: boolean;
  /** Label text below the number */
  label?: string;
  /** Custom className */
  className?: string;
  /** Locale for number formatting */
  locale?: string;
}

const formatNumber = (
  num: number,
  format: CounterFormat,
  decimals: number,
  locale: string
): string => {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    case 'percentage':
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num / 100);
    case 'decimal':
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num);
    default:
      return new Intl.NumberFormat(locale).format(Math.round(num));
  }
};

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1.5,
  prefix = '',
  suffix = '',
  format = 'number',
  decimals = 1,
  variant = 'cyan',
  size = 'lg',
  highlightOnChange = true,
  glow = true,
  label,
  className = '',
  locale = 'es-AR',
}) => {
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  // Spring animation for smooth counting
  const springValue = useSpring(0, {
    stiffness: 100,
    damping: 30,
    duration: duration,
  });

  // Transform spring value to formatted string
  const displayValue = useTransform(springValue, (latest) =>
    formatNumber(latest, format, decimals, locale)
  );

  // Update spring target when value changes
  useEffect(() => {
    springValue.set(value);

    // Trigger highlight animation on value change
    if (highlightOnChange && value !== prevValue) {
      setIsHighlighted(true);
      const timer = setTimeout(() => setIsHighlighted(false), 600);
      setPrevValue(value);
      return () => clearTimeout(timer);
    }
  }, [value, springValue, highlightOnChange, prevValue]);

  return (
    <div
      className={`animated-counter animated-counter--${variant} animated-counter--${size} ${glow ? 'animated-counter--glow' : ''} ${className}`}
    >
      <motion.div
        className={`animated-counter__value ${isHighlighted ? 'animated-counter__value--highlight' : ''}`}
        animate={isHighlighted ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        {prefix && <span className="animated-counter__prefix">{prefix}</span>}
        <motion.span className="animated-counter__number">{displayValue}</motion.span>
        {suffix && <span className="animated-counter__suffix">{suffix}</span>}
      </motion.div>
      {label && <div className="animated-counter__label">{label}</div>}
    </div>
  );
};

/**
 * SimpleCounter - Lightweight counter without spring physics
 * For cases where simpler animation is preferred
 */
export interface SimpleCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  variant?: CounterVariant;
  size?: CounterSize;
  label?: string;
  className?: string;
}

export const SimpleCounter: React.FC<SimpleCounterProps> = ({
  value,
  prefix = '',
  suffix = '',
  variant = 'cyan',
  size = 'lg',
  label,
  className = '',
}) => {
  return (
    <div className={`animated-counter animated-counter--${variant} animated-counter--${size} ${className}`}>
      <motion.div
        className="animated-counter__value"
        key={value}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {prefix && <span className="animated-counter__prefix">{prefix}</span>}
        <span className="animated-counter__number">
          {new Intl.NumberFormat('es-AR').format(value)}
        </span>
        {suffix && <span className="animated-counter__suffix">{suffix}</span>}
      </motion.div>
      {label && <div className="animated-counter__label">{label}</div>}
    </div>
  );
};

/**
 * CountUpOnView - Counter that animates when scrolled into view
 */
export interface CountUpOnViewProps extends AnimatedCounterProps {
  /** Threshold for intersection observer (0-1) */
  threshold?: number;
}

export const CountUpOnView: React.FC<CountUpOnViewProps> = ({
  threshold = 0.5,
  ...props
}) => {
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (isInView && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [isInView, hasAnimated]);

  return (
    <motion.div
      onViewportEnter={() => setIsInView(true)}
      viewport={{ once: true, amount: threshold }}
    >
      <AnimatedCounter
        {...props}
        value={hasAnimated ? props.value : 0}
      />
    </motion.div>
  );
};

export default AnimatedCounter;
