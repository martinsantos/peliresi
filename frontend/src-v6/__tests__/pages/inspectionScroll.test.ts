import { afterEach, describe, expect, it } from 'vitest';
import { preserveInspectionAnchor, revealInspectionAnchor } from '../../pages/inspecciones/inspectionScroll';

function fixture(top: number) {
  const region = document.createElement('div');
  region.setAttribute('data-inspection-scroll', '');
  region.style.scrollPaddingTop = '56px';
  region.scrollTop = 300;
  region.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
  const item = document.createElement('div');
  item.style.scrollMarginTop = '56px';
  item.getBoundingClientRect = () => ({ top } as DOMRect);
  region.append(item);
  document.body.append(region);
  return { region, item, move: (next: number) => { top = next; } };
}
describe('inspection scroll boundaries', () => {
  afterEach(() => document.body.replaceChildren());
  it('never moves an outer page or a missing anchor', () => {
    expect(preserveInspectionAnchor(null)).toBeNull();
    expect(preserveInspectionAnchor(document.createElement('div'))).toBeNull();
    revealInspectionAnchor(null);
    revealInspectionAnchor(document.createElement('div'));
    expect(document.documentElement.scrollTop).toBe(0);
  });
  it('uses the heading offset only for explicit deep-link navigation', () => {
    const { region, item } = fixture(240);
    revealInspectionAnchor(item);
    expect(region.scrollTop).toBe(384);
  });
  it('does not relocate an already visible row to satisfy scroll padding', () => {
    const { region, item } = fixture(112);
    preserveInspectionAnchor(item)!();
    expect(region.scrollTop).toBe(300);
  });
  it('compensates both expansion and collapse above the clicked control', () => {
    const { region, item, move } = fixture(220);
    const restore = preserveInspectionAnchor(item)!;
    move(120);
    restore();
    expect(region.scrollTop).toBe(200);
    const next = preserveInspectionAnchor(item)!;
    move(320);
    next();
    expect(region.scrollTop).toBe(400);
  });
  it('allows anchors without a configured scroll margin', () => {
    const { region, item } = fixture(240);
    item.style.scrollMarginTop = '';
    revealInspectionAnchor(item);
    expect(region.scrollTop).toBe(440);
  });
  it('reserves only the missing range after collapse and clears it for explicit navigation', () => {
    const { region, item, move } = fixture(140);
    Object.defineProperty(region, 'scrollHeight', { value: 600 });
    Object.defineProperty(region, 'clientHeight', { value: 500 });
    const restore = preserveInspectionAnchor(item)!;
    region.scrollTop = 100;
    move(220);
    restore();
    expect(region.style.getPropertyValue('--inspection-scroll-reserve')).toBe('80px');
    expect(region.scrollTop).toBe(180);
    revealInspectionAnchor(item);
    expect(region.style.getPropertyValue('--inspection-scroll-reserve')).toBe('');
  });
  it('does not add empty space when enough content remains below the control', () => {
    const { region, item } = fixture(140);
    Object.defineProperty(region, 'scrollHeight', { value: 1200 });
    Object.defineProperty(region, 'clientHeight', { value: 500 });
    preserveInspectionAnchor(item)!();
    expect(region.scrollTop).toBe(300);
    expect(region.style.getPropertyValue('--inspection-scroll-reserve')).toBe('');
  });
});
