import {
  counterBeatMs,
  COUNTER_BEAT_MAX_MS,
  COUNTER_BEAT_MIN_MS,
  COUNTER_BEAT_RAMP_TURNS,
} from '../../models/combatPacing';

describe('counterBeatMs', () => {
  it('is the max (longest, most readable) for a brand-new player', () => {
    expect(counterBeatMs(0)).toBe(COUNTER_BEAT_MAX_MS);
  });

  it('reaches the min (snappy) at the ramp count and stays there after', () => {
    expect(counterBeatMs(COUNTER_BEAT_RAMP_TURNS)).toBe(COUNTER_BEAT_MIN_MS);
    expect(counterBeatMs(COUNTER_BEAT_RAMP_TURNS + 100)).toBe(COUNTER_BEAT_MIN_MS);
  });

  it('sits strictly between max and min partway through the ramp', () => {
    const mid = counterBeatMs(COUNTER_BEAT_RAMP_TURNS / 2);
    expect(mid).toBeLessThan(COUNTER_BEAT_MAX_MS);
    expect(mid).toBeGreaterThan(COUNTER_BEAT_MIN_MS);
  });

  it('eases monotonically (never increases) as turns accumulate', () => {
    let prev = counterBeatMs(0);
    for (let t = 1; t <= COUNTER_BEAT_RAMP_TURNS + 5; t++) {
      const cur = counterBeatMs(t);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });

  it('clamps negative / non-finite input to the max', () => {
    expect(counterBeatMs(-5)).toBe(COUNTER_BEAT_MAX_MS);
    expect(counterBeatMs(NaN)).toBe(COUNTER_BEAT_MAX_MS);
  });
});
