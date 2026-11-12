import { describe, expect, it } from 'vitest';
import {
  ALL_PORTALS,
  defaultLayout,
  portalHeight,
  resizedSize,
  resolveGridItems,
  swapPortals,
  togglePortalVisibility,
  visiblePortalIds
} from './portalGrid';

describe('portal layout', () => {
  it('shows every portal in listed order by default', () => {
    const layout = defaultLayout();
    expect(layout.order).toEqual(ALL_PORTALS.map((p) => p.id));
    expect(visiblePortalIds(layout)).toEqual(layout.order);
  });

  it('lists visible portals in the saved order', () => {
    expect(visiblePortalIds({ visible: ['actors', 'volume'], order: ['volume', 'sentiment', 'actors'] })).toEqual(['volume', 'actors']);
  });

  it('hides a visible portal and shows a hidden one, without changing the order', () => {
    const hidden = togglePortalVisibility(defaultLayout(), 'volume');
    expect(hidden.visible).not.toContain('volume');
    expect(hidden.order).toEqual(defaultLayout().order);
    expect(togglePortalVisibility(hidden, 'volume').visible).toContain('volume');
  });

  it('does not change the layout it was given', () => {
    const layout = defaultLayout();
    togglePortalVisibility(layout, 'volume');
    swapPortals(layout, 'volume', 'actors');
    expect(layout).toEqual(defaultLayout());
  });
});

describe('swapPortals', () => {
  it('swaps two portals in the order', () => {
    const swapped = swapPortals({ visible: [], order: ['a', 'b', 'c'] }, 'a', 'c');
    expect(swapped?.order).toEqual(['c', 'b', 'a']);
  });

  it('returns null when either portal is unknown', () => {
    expect(swapPortals({ visible: [], order: ['a', 'b'] }, 'a', 'zzz')).toBeNull();
    expect(swapPortals({ visible: [], order: ['a', 'b'] }, 'zzz', 'a')).toBeNull();
  });
});

describe('resolveGridItems and portalHeight', () => {
  it('uses the saved size and falls back to six by two', () => {
    const items = resolveGridItems(['a', 'b'], [{ id: 'a', x: 1, y: 2, w: 4, h: 3 }]);
    expect(items[0]).toEqual({ id: 'a', x: 1, y: 2, w: 4, h: 3 });
    expect(items[1]).toEqual({ id: 'b', x: 0, y: 0, w: 6, h: 2 });
    expect(portalHeight(items[0])).toBe(420);
  });
});

describe('resizedSize', () => {
  it('adds whole cells for the drag distance', () => {
    expect(resizedSize({ w: 6, h: 2 }, 200, 140, 1200)).toEqual({ w: 8, h: 3 });
  });

  it('uses an 80px column when the parent has no width', () => {
    expect(resizedSize({ w: 6, h: 2 }, 160, 0, undefined)).toEqual({ w: 8, h: 2 });
  });

  it('keeps the size within three to twelve columns and two to eight rows', () => {
    expect(resizedSize({ w: 6, h: 2 }, -5000, -5000, 1200)).toEqual({ w: 3, h: 2 });
    expect(resizedSize({ w: 6, h: 2 }, 5000, 5000, 1200)).toEqual({ w: 12, h: 8 });
  });
});
