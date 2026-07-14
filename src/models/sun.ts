/**
 * Solar position — is the sun up where the player is standing?
 *
 * Drives the day/night theme (and, later, the day/night creature roster). Pure maths from
 * date + latitude + longitude: NO network, NO API, and no extra permissions (the app already has
 * the player's coordinates for the walking loop).
 *
 * We compute the sun's ELEVATION rather than sunrise/sunset times, because elevation is total: it
 * degrades gracefully inside the polar circles, where "sunrise" and "sunset" may simply not exist
 * on a given day (midnight sun / polar night). A time-based approach would have to special-case
 * those; this one just reports that the sun is up (or isn't) and the theme follows.
 *
 * Accuracy is far beyond what a day/night flip needs (well under a degree).
 */

const RAD = Math.PI / 180;
const J2000 = 2451545; // Julian day for 2000-01-01 12:00 TT

/** Days since the J2000.0 epoch. */
function daysSinceJ2000(date: Date): number {
  return date.valueOf() / 86400000 - 0.5 + 2440588 - J2000;
}

/**
 * The sun's elevation above the horizon, in degrees. Negative = below the horizon.
 * Standard low-precision solar position (mean anomaly → ecliptic longitude → declination → hour angle).
 */
export function solarElevationDeg(date: Date, latitude: number, longitude: number): number {
  const d = daysSinceJ2000(date);

  const meanAnomaly = (357.529 + 0.98560028 * d) * RAD;
  const meanLongitude = (280.459 + 0.98564736 * d) * RAD;
  // Equation of centre → true ecliptic longitude.
  const eclipticLongitude =
    meanLongitude + (1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;

  const obliquity = (23.439 - 0.00000036 * d) * RAD;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );

  // Greenwich mean sidereal time (hours) → local hour angle.
  const gmstHours = (18.697374558 + 24.06570982441908 * d) % 24;
  const localSiderealTime = (gmstHours * 15 + longitude) * RAD;
  const hourAngle = localSiderealTime - rightAscension;

  const lat = latitude * RAD;
  const sinElevation =
    Math.sin(lat) * Math.sin(declination) +
    Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);

  return Math.asin(Math.max(-1, Math.min(1, sinElevation))) / RAD;
}

/**
 * The standard sunrise/sunset elevation: the sun's centre sits slightly BELOW the horizon at the
 * moment its upper limb appears, because of atmospheric refraction (~34') plus the sun's own
 * radius (~16'). This is the same −0.833° convention almanacs use.
 */
export const HORIZON_ELEVATION_DEG = -0.833;

/** True when the sun is up at this place and moment. */
export function isDaylight(date: Date, latitude: number, longitude: number): boolean {
  return solarElevationDeg(date, latitude, longitude) > HORIZON_ELEVATION_DEG;
}
