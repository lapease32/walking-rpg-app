import { solarElevationDeg, isDaylight, HORIZON_ELEVATION_DEG } from '../../models/sun';

// Coordinates used below (lat, lng)
const LONDON = { lat: 51.5, lng: -0.13 };
const QUITO = { lat: -0.18, lng: -78.47 }; // equator
const LONGYEARBYEN = { lat: 78.22, lng: 15.63 }; // far inside the Arctic circle
const MCMURDO = { lat: -77.85, lng: 166.67 }; // Antarctica

// All dates are UTC, so the assertions don't depend on the machine's timezone.
const utc = (iso: string) => new Date(`${iso}Z`);

describe('solarElevationDeg', () => {
  it('puts the sun high overhead at equatorial solar noon', () => {
    // Quito is ~78.5°W → solar noon lands near 17:14 UTC.
    const elevation = solarElevationDeg(utc('2026-03-20T17:14:00'), QUITO.lat, QUITO.lng);
    expect(elevation).toBeGreaterThan(80);
  });

  it('puts the sun far below the horizon at equatorial midnight', () => {
    const elevation = solarElevationDeg(utc('2026-03-21T05:14:00'), QUITO.lat, QUITO.lng);
    expect(elevation).toBeLessThan(-80);
  });

  it('is symmetric about the horizon convention', () => {
    // The sunrise/sunset convention allows for refraction + the sun's radius.
    expect(HORIZON_ELEVATION_DEG).toBeCloseTo(-0.833, 3);
  });
});

describe('isDaylight', () => {
  it('is day at London noon and night at London midnight (midsummer)', () => {
    expect(isDaylight(utc('2026-06-21T12:00:00'), LONDON.lat, LONDON.lng)).toBe(true);
    expect(isDaylight(utc('2026-06-21T00:00:00'), LONDON.lat, LONDON.lng)).toBe(false);
  });

  it('is day at London noon and night at London midnight (midwinter)', () => {
    expect(isDaylight(utc('2026-12-21T12:00:00'), LONDON.lat, LONDON.lng)).toBe(true);
    expect(isDaylight(utc('2026-12-21T00:00:00'), LONDON.lat, LONDON.lng)).toBe(false);
  });

  // The reason this uses elevation rather than sunrise/sunset TIMES: inside the polar circles those
  // times may not exist on a given day, and a time-based implementation would have to special-case
  // them. Elevation is total.
  it('handles the midnight sun — daylight at local midnight in the high Arctic in June', () => {
    expect(isDaylight(utc('2026-06-21T23:00:00'), LONGYEARBYEN.lat, LONGYEARBYEN.lng)).toBe(true);
    expect(isDaylight(utc('2026-06-21T11:00:00'), LONGYEARBYEN.lat, LONGYEARBYEN.lng)).toBe(true);
  });

  it('handles polar night — dark at local noon in the high Arctic in December', () => {
    expect(isDaylight(utc('2026-12-21T11:00:00'), LONGYEARBYEN.lat, LONGYEARBYEN.lng)).toBe(false);
  });

  it('handles the southern hemisphere (Antarctica is dark at midsummer-north noon)', () => {
    expect(isDaylight(utc('2026-06-21T00:00:00'), MCMURDO.lat, MCMURDO.lng)).toBe(false);
  });
});
