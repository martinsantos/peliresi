import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { Popup as LeafletPopup } from 'leaflet';
import { Popup } from 'react-leaflet';

/** Leaflet recalculates popup height when React updates its children. That
 * temporarily removes the height and resets the user's scroll position. */
export function MonitorPopup(props: React.ComponentProps<typeof Popup>) {
  const popup = useRef<LeafletPopup>(null);
  const previous = useRef<{ content: HTMLElement; top: number } | null>(null);

  // Layout effects run before React-Leaflet's passive popup update; the
  // parent's passive effect runs after it, without delaying the next paint.
  useLayoutEffect(() => {
    const content = popup.current?.getElement()?.querySelector<HTMLElement>('.leaflet-popup-content');
    previous.current = content ? { content, top: content.scrollTop } : null;
  });
  useEffect(() => {
    const snapshot = previous.current;
    if (snapshot?.content.isConnected && popup.current?.getElement()?.contains(snapshot.content)) {
      snapshot.content.scrollTop = snapshot.top;
    }
  });

  return <Popup {...props} ref={popup} />;
}
