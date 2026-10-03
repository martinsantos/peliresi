import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapCategorySymbol, MapLayerToggle } from './MapLayerToggle';
import { ACTOR_ICONS } from '../../utils/map-icons';

describe('Map controls and marker identity', () => {
  it.each(['enTransito', 'enTransitoSelected'] as const)('matches the actual %s navigation arrow, not just its color', icon => {
    const { container } = render(<MapCategorySymbol category="enTransito" />);
    const marker = new DOMParser().parseFromString(String(ACTOR_ICONS[icon].options.html), 'text/html');
    expect(marker.querySelector('polygon')?.getAttribute('points')).toBe(container.querySelector('polygon')?.getAttribute('points'));
    expect(marker.querySelector('svg')?.getAttribute('fill')).toBe('none');
  });

  it('keeps the exact zero count and hidden state without manufacturing an action', () => {
    const toggle = vi.fn();
    render(<MapLayerToggle category="operador" label="Operadores" pressed={false} count={0} onToggle={toggle} />);
    const button = screen.getByRole('button', { name: 'Operadores', exact: true });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAccessibleDescription('(0)');
    expect(button.querySelector('svg.lucide-eye-off')).not.toBeNull();
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledOnce();
  });
});
