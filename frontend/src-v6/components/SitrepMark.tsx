import React from 'react';

/** Shared green cycle mark. Place on the white institutional masthead, never a colored tile. */
export const SitrepMark: React.FC<{ size?: number; className?: string; appearance?: 'tile' | 'green' }> = ({ size = 36, className = '' }) => (
  <img
    src={`${import.meta.env.BASE_URL}sitrep-mark-green.svg`}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    data-sitrep-mark=""
    className={`shrink-0 ${className}`}
  />
);

/** Product wordmark stays the same green as its mark, independent of role/theme colors. */
export const SitrepWordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span data-sitrep-wordmark="" className={className} style={{ color: '#1B5E3C' }}>SITREP</span>
);
