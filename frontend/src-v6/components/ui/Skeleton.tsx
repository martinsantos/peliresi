/**
 * SITREP v6 - Skeleton Component
 * ==============================
 * Placeholder de carga con animación shimmer
 */

import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// TYPES
// ========================================
interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  count?: number;
  style?: React.CSSProperties;
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

interface SkeletonCardProps {
  hasHeader?: boolean;
  hasFooter?: boolean;
  lines?: number;
  className?: string;
}

// ========================================
// BASE SKELETON
// ========================================
export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  width,
  height,
  circle = false,
  count = 1,
  style: styleProp,
}) => {
  const style: React.CSSProperties = {
    width: width,
    height: height,
    ...styleProp,
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-neutral-200 animate-shimmer',
            'bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200',
            'bg-[length:200%_100%]',
            circle ? 'rounded-full' : 'rounded-lg',
            className
          )}
          style={style}
        />
      ))}
    </>
  );
};

// ========================================
// SKELETON TEXT
// ========================================
export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  className,
  lastLineWidth = '70%',
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          className={cn(
            i === lines - 1 && lastLineWidth !== '100%',
          )}
          style={{
            width: i === lines - 1 ? lastLineWidth : '100%',
          }}
        />
      ))}
    </div>
  );
};

// ========================================
// SKELETON CARD
// ========================================
export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  hasHeader = true,
  hasFooter = false,
  lines = 3,
  className,
}) => {
  return (
    <div className={cn('bg-white rounded-2xl p-6 border border-neutral-100', className)}>
      {hasHeader && (
        <div className="flex items-center gap-4 mb-6">
          <Skeleton circle width={48} height={48} />
          <div className="flex-1">
            <Skeleton height={20} width="60%" className="mb-2" />
            <Skeleton height={14} width="40%" />
          </div>
        </div>
      )}
      
      <SkeletonText lines={lines} />
      
      {hasFooter && (
        <div className="flex gap-3 mt-6 pt-6 border-t border-neutral-100">
          <Skeleton height={40} width={100} />
          <Skeleton height={40} width={100} />
        </div>
      )}
    </div>
  );
};

// ========================================
// SKELETON STATS
// ========================================
export const SkeletonStats: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} hasHeader={false} lines={2} />
      ))}
    </div>
  );
};

// ========================================
// SKELETON TABLE
// ========================================
export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
      {/* Header */}
      <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton
              key={i}
              height={16}
              width={i === 0 ? '30%' : `${20 + Math.random() * 20}%`}
            />
          ))}
        </div>
      </div>
      
      {/* Rows */}
      <div className="divide-y divide-neutral-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-6 py-4 flex gap-4">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                height={16}
                width={colIndex === 0 ? '30%' : `${20 + Math.random() * 20}%`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonStats,
  SkeletonTable,
};
