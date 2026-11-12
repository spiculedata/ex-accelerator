import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import RangeSliderPair from './RangeSliderPair.svelte';

const props = (over: Record<string, unknown> = {}) => ({
  scaleMin: -10,
  scaleMax: 10,
  step: 0.1,
  range: [-10, 10],
  min: -10,
  max: 10,
  onApply: vi.fn(),
  ...over
});
const inputs = (container: HTMLElement) => ({
  sliders: Array.from(container.querySelectorAll('input[type="range"]')) as HTMLInputElement[],
  numbers: Array.from(container.querySelectorAll('input[type="number"]')) as HTMLInputElement[]
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('RangeSliderPair', () => {
  it('labels the scale and gives the inputs its limits', () => {
    const { container } = render(RangeSliderPair, props({ scaleMin: -50, scaleMax: 50, step: 0.5 }));
    expect(Array.from(container.querySelectorAll('span')).map((s) => s.textContent)).toEqual(['-50', '0', '+50']);
    const { sliders, numbers } = inputs(container);
    for (const input of [...sliders, ...numbers]) {
      expect(input.min).toBe('-50');
      expect(input.max).toBe('50');
      expect(input.step).toBe('0.5');
    }
  });

  it('applies a slider move after a pause, once, however often it moves', async () => {
    const p = props();
    const { container } = render(RangeSliderPair, p);
    const { sliders } = inputs(container);

    await fireEvent.input(sliders[0], { target: { value: '-5' } });
    await fireEvent.input(sliders[0], { target: { value: '-4' } });
    expect(p.onApply).not.toHaveBeenCalled();
    vi.advanceTimersByTime(199);
    expect(p.onApply).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(p.onApply).toHaveBeenCalledTimes(1);
  });

  it('does not apply after it is destroyed', async () => {
    const p = props();
    const { container, unmount } = render(RangeSliderPair, p);
    await fireEvent.input(inputs(container).sliders[0], { target: { value: '-5' } });
    unmount();
    vi.advanceTimersByTime(1000);
    expect(p.onApply).not.toHaveBeenCalled();
  });

  it('keeps the manual fields in step when the low handle passes the high one', async () => {
    const p = props({ range: [-10, 2], min: -10, max: 2 });
    const { container } = render(RangeSliderPair, p);
    const { sliders, numbers } = inputs(container);

    await fireEvent.input(sliders[0], { target: { value: '6' } });
    expect(numbers[0].value).toBe('2');
    expect(numbers[1].value).toBe('6');
  });

  it('clamps and orders a manual entry, then applies it at once', async () => {
    const p = props();
    const { container } = render(RangeSliderPair, p);
    const { numbers } = inputs(container);

    await fireEvent.input(numbers[0], { target: { value: '99' } });
    await fireEvent.input(numbers[1], { target: { value: '-3' } });
    await fireEvent.change(numbers[1]);

    expect(p.onApply).toHaveBeenCalledTimes(1);
    expect(numbers[0].value).toBe('-3');
    expect(numbers[1].value).toBe('10');
  });
});
