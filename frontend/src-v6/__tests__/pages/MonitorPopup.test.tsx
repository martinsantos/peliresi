import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MonitorPopup } from '../../pages/monitor/components/MonitorPopup';

// React-Leaflet updates popup layout in a passive effect when children
// change. Model its height recalculation, which resets browser scrollTop.
vi.mock('react-leaflet', async () => {
  const { forwardRef, useEffect, useImperativeHandle, useRef } = await import('react');
  return { Popup: forwardRef(({ children }: { children: React.ReactNode }, ref) => {
    const root = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => ({ getElement: () => root.current }));
    useEffect(() => {
      const content = root.current?.querySelector<HTMLElement>('.leaflet-popup-content');
      if (content) content.scrollTop = 0;
    }, [children]);
    return <div ref={root}><div className="leaflet-popup-content">{children}</div></div>;
  }) };
});

it('keeps the reading position when popup data updates', () => {
  const { container, rerender } = render(<MonitorPopup><span>Antes</span></MonitorPopup>);
  const content = container.querySelector<HTMLElement>('.leaflet-popup-content')!;
  content.scrollTop = 58;
  rerender(<MonitorPopup><span>Después</span></MonitorPopup>);
  expect(screen.getByText('Después')).toBeVisible();
  expect(content.scrollTop).toBe(58);
});
