import { describe, expect, it } from 'vitest';
import { fitTransform } from './fit';
import { NODE_W } from './layout';

const view = { width: 1200, height: 800 };

describe('fitTransform', () => {
  it('scales a horizontal span to fit, never past 1', () => {
    expect(fitTransform({ x0: 0, x1: 1920, y: 0 }, view).k).toBeCloseTo((1200 - 80) / (1920 + NODE_W));
    expect(fitTransform({ x0: 0, x1: 100, y: 0 }, view).k).toBe(1);
  });

  it('centres a range that fits', () => {
    const f = fitTransform({ x0: -300, x1: 300, y: 0, y0: -100, y1: 100 }, view);
    expect(f).toEqual({ x: 600, y: 400, k: 1 });
  });

  it('keeps the old 0.4 floor by default, centring the range', () => {
    expect(fitTransform({ x0: 0, x1: 0, y: 0, y0: -4000, y1: 4000 }, view)).toEqual({ x: 600, y: 400, k: 0.4 });
  });

  it('stops at a readable scale and centres on the anchor point when the range is too big', () => {
    // 2,000 rows tall: fitting would need k ≈ 0.01. Stay at 0.85 and centre on the centre node.
    const f = fitTransform({ x0: -640, x1: 640, x: 0, y: 0, y0: -2000 * 26, y1: 400 }, view, { minK: 0.85 });
    expect(f.k).toBe(0.85);
    expect(f.y).toBe(400); // y = 0 sits mid-viewport
    expect(f.x).toBe(600); // x = 0, the anchor, sits mid-viewport
  });

  it('still centres horizontally on the whole span when only the height overflows', () => {
    const f = fitTransform({ x0: -100, x1: 300, x: 0, y: 50, y0: -5000, y1: 5000 }, view, { minK: 0.85 });
    expect(f.k).toBe(0.85);
    expect(f.x).toBe(600 - 100 * 0.85); // middle of -100..300
    expect(f.y).toBe(400 - 50 * 0.85);
  });
});
