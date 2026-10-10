import { MODES, FARE_SHARE, SETTINGS_DEFAULTS, applySettings } from '../../config.js';
import { readStorage, writeStorage } from './store.js';
import { checkSettings } from './validate.js';

const overrides = () => readStorage('settings.json', {});

/** Current fare-sharing settings, as applied to the live config objects. */
export function getSettings() {
  return {
    integrationDiscount: FARE_SHARE.integrationDiscount,
    fareWeight: FARE_SHARE.fareWeight,
    costWeights: Object.fromEntries(Object.entries(MODES).map(([k, m]) => [k, m.costWeight])),
    modes: Object.fromEntries(Object.entries(MODES).map(([k, m]) => [k, { label: m.label, operator: m.operator, color: m.color }])),
    defaults: SETTINGS_DEFAULTS,
    overrides: overrides(),
  };
}

export async function updateSettings(body) {
  const before = getSettings();
  const patch = checkSettings(body);
  const current = overrides();
  const next = { ...current, ...patch, costWeights: { ...current.costWeights, ...patch.costWeights } };
  await writeStorage('settings.json', next);
  applySettings(next);
  return { before, after: getSettings() };
}

export async function resetSettings() {
  await writeStorage('settings.json', {});
  applySettings({});
  return getSettings();
}
