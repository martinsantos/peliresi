import React from 'react';

/** Single vector asset shared by the public entrance and both application shells. */
export const SitrepMark: React.FC<{ size?: number; className?: string }> = ({ size = 36, className = '' }) => (
  <img
    src={`${import.meta.env.BASE_URL}favicon.svg`}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    data-sitrep-mark=""
    className={`shrink-0 ${className}`}
  />
);
