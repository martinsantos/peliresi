import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { Popup, PopupEvent } from 'leaflet';

/** Leaflet's content maxHeight excludes the wrapper, tip and margin. Bound
 * the whole detail to the currently visible map, including the sticky header
 * and attribution clearance; do not enlarge or scroll the page to hide it. */
export function MonitorPopupBounds() {
  const map = useMap();
  useEffect(() => {
    let active: Popup | null = null;
    let content: HTMLElement | null = null;
    let originalTabIndex: string | null = null;
    const scrollKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
    const stopMapPan = (event: KeyboardEvent) => {
      if (scrollKeys.has(event.key)) event.stopPropagation();
      // Keep the browser's native scrolling and form/key activation intact.
    };
    const releaseContent = () => {
      if (!content) return;
      content.removeEventListener('keydown', stopMapPan);
      if (originalTabIndex === null) content.removeAttribute('tabindex');
      else content.setAttribute('tabindex', originalTabIndex);
      content = null;
    };
    const constrain = () => {
      const element = active?.getElement();
      const nextContent = element?.querySelector<HTMLElement>('.leaflet-popup-content');
      if (!element || !nextContent || !active) return;
      if (nextContent !== content) {
        releaseContent(); content = nextContent; originalTabIndex = content.getAttribute('tabindex');
        content.tabIndex = 0; content.addEventListener('keydown', stopMapPan);
      }
      const container = map.getContainer(), box = container.getBoundingClientRect();
      const header = container.closest('.wr-layout')?.querySelector('.wr-layout-header')?.getBoundingClientRect();
      const viewportTop = window.visualViewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (window.visualViewport?.height ?? innerHeight);
      const topPadding = Math.max(12, Math.max(viewportTop, header?.bottom ?? viewportTop) - box.top + 12);
      const bottomPadding = Math.max(32, box.bottom - viewportBottom + 32);
      const margin = parseFloat(getComputedStyle(element).marginBottom) || 0;
      const chromeHeight = Math.max(0, element.offsetHeight - nextContent.offsetHeight) + margin;
      const available = map.getSize().y - topPadding - bottomPadding - chromeHeight;
      active.options.maxHeight = Math.min(220, Math.max(44, Math.floor(available)));
      active.options.autoPanPaddingTopLeft = [12, topPadding];
      active.options.autoPanPaddingBottomRight = [12, bottomPadding];
      active.update();
    };
    const handlers = {
      popupopen: (event: PopupEvent) => { active = event.popup; constrain(); },
      popupclose: (event: PopupEvent) => { if (event.popup === active) { active = null; releaseContent(); } },
      resize: constrain,
    };
    map.on(handlers);
    window.visualViewport?.addEventListener('resize', constrain);
    return () => {
      map.off(handlers); window.visualViewport?.removeEventListener('resize', constrain);
      active = null; releaseContent();
    };
  }, [map]);
  return null;
}
