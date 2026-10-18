import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapCategorySymbol, MapLayerToggle } from './MapLayerToggle';
import { ACTOR_COLORS, ACTOR_ICONS } from '../../utils/map-icons';

describe('Map controls and marker identity', () => {
  it.each(['generador', 'transportista', 'operador', 'inspeccion', 'enTransito'] as const)('keeps the %s glyph upright independently of its category background', category => {
    const { container } = render(<MapCategorySymbol category={category} />);
    const slot = container.querySelector('[data-map-symbol]')!;
    const background = slot.querySelector('[data-map-symbol-background]')!;
    const glyph = slot.querySelector('svg')!;
    expect(slot).toHaveAttribute('aria-hidden', 'true');
    expect(slot).not.toHaveStyle({ backgroundColor: ACTOR_COLORS[category] });
    expect(background).toHaveStyle({ backgroundColor: ACTOR_COLORS[category] });
    expect((slot as HTMLElement).style.transform).toBe('');
    expect((glyph as SVGElement).style.transform).toBe('');
    expect((background as HTMLElement).style.transform).toBe(category === 'transportista' ? 'rotate(45deg)' : '');
    expect(glyph).toHaveAttribute('width', '14');
    expect(glyph).toHaveAttribute('height', '14');
    expect(glyph).toHaveAttribute('fill', 'none');
  });

  it.each(['enTransito', 'enTransitoSelected'] as const)('matches the actual %s navigation arrow, not just its color', icon => {
    const { container } = render(<MapCategorySymbol category="enTransito" />);
    const marker = new DOMParser().parseFromString(String(ACTOR_ICONS[icon].options.html), 'text/html');
    expect(marker.querySelector('polygon')?.getAttribute('points')).toBe(container.querySelector('polygon')?.getAttribute('points'));
    expect(marker.querySelector('svg')?.getAttribute('fill')).toBe('none');
  });

  it('keeps the exact zero count and hidden state without manufacturing an action', () => {
    const toggle = vi.fn();
    render(<MapLayerToggle category="operador" label="Operadores" pressed={false} count={0} onToggle={toggle} />);
    const button = screen.getByRole('button', { name: 'Operadores' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAccessibleDescription('(0)');
    expect(button.querySelector('svg.lucide-eye-off')).not.toBeNull();
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('preserves the label and real count when switching the separate state indicator', () => {
    const toggle = vi.fn();
    const props = { category: 'transportista' as const, label: 'Transportistas', count: 12, onToggle: toggle };
    const { rerender } = render(<MapLayerToggle {...props} pressed={false} />);
    const button = screen.getByRole('button', { name: 'Transportistas' });
    const label = button.querySelector('[data-map-label]')!;
    const text = label.parentElement!;
    const state = button.querySelector('[data-map-state]')!;
    expect(text.querySelector('[data-map-count]')).toHaveTextContent('(12)');
    expect(text.contains(state)).toBe(false);
    expect(state.parentElement).toBe(button);
    expect(button).toHaveAccessibleDescription('(12)');
    expect(state.querySelector('svg.lucide-eye-off')).not.toBeNull();
    rerender(<MapLayerToggle {...props} pressed />);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAccessibleDescription('(12)');
    expect(label).toHaveTextContent('Transportistas');
    expect(state.querySelector('svg.lucide-check')).not.toBeNull();
    expect(state.querySelector('svg.lucide-eye-off')).toBeNull();
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledOnce();
  });
});
