// Sun position from the NOAA solar calculator equations (accurate to well under 0.1° for our purpose).
// No dependencies, so it also runs in Node for testing against pvlib.

const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAY_OF_MONTH = 21;  // representative day used for each month (near solstices/equinoxes)

function julianDay(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

/**
 * @param {number} month 1-12, @param {number} day, @param {number} hour local clock time (decimal hours)
 * @param {{lat:number, lon:number, timezone:number}} site
 * @returns {{azimuth:number, elevation:number}} degrees; azimuth clockwise from north; elevation without refraction
 */
export function sunPosition(month, day, hour, site, year = 2025) {
  const jd = julianDay(year, month, day) + (hour - site.timezone) / 24;
  const jc = (jd - 2451545) / 36525;
  const L0 = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const C = Math.sin(rad(M)) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
          + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * jc) + Math.sin(rad(3 * M)) * 0.000289;
  const omega = 125.04 - 1934.136 * jc;
  const appLong = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const obliq0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const obliq = obliq0 + 0.00256 * Math.cos(rad(omega));
  const decl = deg(Math.asin(Math.sin(rad(obliq)) * Math.sin(rad(appLong))));
  const y = Math.tan(rad(obliq / 2)) ** 2;
  const eqTime = 4 * deg(y * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M))
    + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) - 0.5 * y * y * Math.sin(4 * rad(L0))
    - 1.25 * e * e * Math.sin(2 * rad(M)));
  const tst = ((hour * 60 + eqTime + 4 * site.lon - 60 * site.timezone) % 1440 + 1440) % 1440;
  const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;
  const cosZ = Math.sin(rad(site.lat)) * Math.sin(rad(decl)) + Math.cos(rad(site.lat)) * Math.cos(rad(decl)) * Math.cos(rad(ha));
  const zen = deg(Math.acos(Math.min(1, Math.max(-1, cosZ))));
  const den = Math.cos(rad(site.lat)) * Math.sin(rad(zen));
  let az;
  if (Math.abs(den) < 1e-9) az = 180;
  else {
    const a = deg(Math.acos(Math.min(1, Math.max(-1, (Math.sin(rad(site.lat)) * Math.cos(rad(zen)) - Math.sin(rad(decl))) / den))));
    az = ha > 0 ? (a + 180) % 360 : (540 - a) % 360;
  }
  return { azimuth: az, elevation: 90 - zen };
}

// Sunrise and sunset (local decimal hours) for a day: when the sun's centre is 0.833° below the horizon.
export function sunTimes(month, day, site) {
  const h0 = -0.833, f = t => sunPosition(month, day, t, site).elevation - h0;
  const find = (a, b) => { for (let i = 0; i < 40; i++) { const m = (a + b) / 2; (f(a) < 0) === (f(m) < 0) ? a = m : b = m; } return (a + b) / 2; };
  let noon = 12, best = -99;
  for (let t = 9; t <= 15; t += 0.05) { const e = f(t); if (e > best) { best = e; noon = t; } }
  return { sunrise: find(0, noon), noon, sunset: find(noon, 24) };
}

// Points along the day's path, every `step` hours from sunrise to sunset (for drawing the arc).
export function sunPath(month, day, site, step = 1 / 6) {
  const { sunrise, sunset } = sunTimes(month, day, site), pts = [];
  for (let t = sunrise; t < sunset; t += step) pts.push({ t, ...sunPosition(month, day, t, site) });
  pts.push({ t: sunset, ...sunPosition(month, day, sunset, site) });
  return pts;
}

export const fmtClock = h => { const m = Math.round(h * 60); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const compassName = az => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((az % 360) + 360) % 360 / 45) % 8];
