import React from 'react';

/** Original transparent PNGs from the Government's 2023–2027 brand assets.
 * Source: mendoza.gov.ar/wp-content/uploads/sites/5/2023/12/{marca_gov,gob_escudo_footer}.png
 * Use the secondary (white lettering) artwork on the blue institutional panel.
 */
export const MendozaBrand: React.FC<{ className?: string; appearance?: 'light' | 'dark' }> = ({ className = '', appearance = 'light' }) => (
  <img
    src={`${import.meta.env.BASE_URL}mendoza-marca-${appearance === 'dark' ? 'secundaria' : 'horizontal'}-transparente.png`}
    width={appearance === 'dark' ? 79 : 178}
    height={appearance === 'dark' ? 126 : 57}
    alt="Mendoza — Gobierno de la Provincia"
    className={`mendoza-brand ${className}`}
    fetchPriority="high"
  />
);
