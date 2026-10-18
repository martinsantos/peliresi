import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs, TabList, Tab } from '../../components/ui/Tabs';

describe('long tabs keep the selected destination visible without moving the page', () => {
  afterEach(() => vi.restoreAllMocks());

  function geometry() {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const left = this.getAttribute('role') === 'tablist' ? 10 : this.textContent === 'Último' ? 370 : 10;
      const width = this.getAttribute('role') === 'tablist' ? 200 : 100;
      return { x: left, y: 300, left, right: left + width, top: 300, bottom: 344, width, height: 44, toJSON: () => ({}) };
    });
    return vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  }

  const content = <><Tab id="one">Primero</Tab><Tab id="last">Último</Tab></>;

  it('reveals End-key selection by scrolling only the horizontal tab list', () => {
    const pageScroll = geometry();
    render(<Tabs defaultTab="one"><TabList>{content}</TabList></Tabs>);
    const one = screen.getByRole('tab', { name: 'Primero' });
    one.focus();
    fireEvent.keyDown(one, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Último' })).toHaveFocus();
    expect(screen.getByRole('tablist').scrollLeft).toBe(260);
    expect(pageScroll).not.toHaveBeenCalled();
  });

  it('reveals a controlled selected tab even when it changes without a pointer click', () => {
    const pageScroll = geometry();
    const { rerender } = render(<Tabs activeTab="one"><TabList>{content}</TabList></Tabs>);
    rerender(<Tabs activeTab="last"><TabList>{content}</TabList></Tabs>);
    expect(screen.getByRole('tab', { name: 'Último' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tablist').scrollLeft).toBe(260);
    expect(pageScroll).not.toHaveBeenCalled();
  });
});
