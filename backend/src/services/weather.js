/**
 * Live and recent weather for Ahmedabad from Open-Meteo (no API key).
 * Cached for 15 minutes. Any failure yields null so planning never depends
 * on the weather service being up; callers report weather as unavailable.
 */

const URL =
  'https://api.open-meteo.com/v1/forecast?latitude=23.03&longitude=72.58&timezone=Asia%2FKolkata' +
  '&hourly=temperature_2m,apparent_temperature,precipitation&daily=temperature_2m_max,apparent_temperature_max,precipitation_sum' +
  '&past_days=7&forecast_days=2';
const TTL_MS = 15 * 60e3;
const SOURCE = 'Open-Meteo (open-meteo.com)';

let cache = { at: 0, data: null };

async function load() {
  if (cache.data && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = { at: Date.now(), data: await res.json() };
  } catch (err) {
    console.warn(`Weather unavailable: ${err.message}`);
    if (!cache.data) return null;
  }
  return cache.data;
}

/** IST "YYYY-MM-DDTHH:00" key for the hour containing `date`, matching Open-Meteo's local-time series. */
function istHourKey(date) {
  return new Date(date.getTime() + 330 * 60e3).toISOString().slice(0, 13) + ':00';
}

/** Weather for the hour containing `at`: { tempC, feelsLikeC, precipMm, time, source } or null. */
export async function weatherAt(at = new Date()) {
  const data = await load();
  const i = data?.hourly?.time?.indexOf(istHourKey(at)) ?? -1;
  if (i < 0) return null;
  return {
    time: data.hourly.time[i],
    tempC: data.hourly.temperature_2m[i],
    feelsLikeC: data.hourly.apparent_temperature[i],
    precipMm: data.hourly.precipitation[i],
    source: SOURCE,
  };
}

/** Daily summary for an IST date "YYYY-MM-DD" within the last 7 days or the next day, or null. */
export async function weatherOnDay(date) {
  const data = await load();
  const i = data?.daily?.time?.indexOf(date) ?? -1;
  if (i < 0) return null;
  return {
    date,
    maxTempC: data.daily.temperature_2m_max[i],
    maxFeelsLikeC: data.daily.apparent_temperature_max[i],
    precipMm: data.daily.precipitation_sum[i],
    source: SOURCE,
  };
}
