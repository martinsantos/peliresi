/**
 * Single source of truth for every SITREP basemap.
 * The standard OpenStreetMap raster endpoint is public and does not require an
 * application key. Keeping it central prevents a single screen from silently
 * switching to a key-gated provider.
 */
export const BASE_MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const BASE_MAP_ATTRIBUTION = '&copy; OpenStreetMap contributors';
export const BASE_MAP_MAX_ZOOM = 19;
