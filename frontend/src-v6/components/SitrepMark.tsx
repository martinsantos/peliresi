import React from 'react';

/** Approved cycle geometry; the public masthead can use green on a transparent ground. */
export const SitrepMark: React.FC<{ size?: number; className?: string; appearance?: 'tile' | 'green' }> = ({ size = 36, className = '', appearance = 'tile' }) => (
  <img
    src={`${import.meta.env.BASE_URL}${appearance === 'green' ? 'sitrep-mark-green.svg' : 'favicon.svg'}`}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    data-sitrep-mark=""
    className={`shrink-0 ${className}`}
  />
);
