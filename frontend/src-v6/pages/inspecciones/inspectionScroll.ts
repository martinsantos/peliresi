/** Deep links scroll only inspection content, never every ancestor. */
export function revealInspectionAnchor(element: HTMLElement | null): void {
  const region = element?.closest<HTMLElement>('[data-inspection-scroll]');
  if (!element || !region) return;
  region.style.removeProperty('--inspection-scroll-reserve');
  const offset = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  region.scrollTop += element.getBoundingClientRect().top - region.getBoundingClientRect().top - offset;
}

/** Keep a clicked row in place when another expanded row above it collapses. */
export function preserveInspectionAnchor(element: HTMLElement | null): (() => void) | null {
  const region = element?.closest<HTMLElement>('[data-inspection-scroll]');
  if (!element || !region) return null;
  // Scroll padding is for explicit navigation, not an accordion click. Applying
  // it here moved a control that was already visible under the sticky heading.
  const top = element.getBoundingClientRect().top;
  return () => {
    region.style.removeProperty('--inspection-scroll-reserve');
    const desired = region.scrollTop + element.getBoundingClientRect().top - top;
    // Collapsing a long category can leave less than one viewport below its
    // heading. Reserve only the missing scroll range, otherwise the browser
    // clamps scrollTop and moves the heading despite the correction above.
    const missing = desired - Math.max(0, region.scrollHeight - region.clientHeight);
    if (missing > 0) region.style.setProperty('--inspection-scroll-reserve', `${missing}px`);
    region.scrollTop = desired;
  };
}
