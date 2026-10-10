import { MODES, FARE_SHARE, SETTINGS_DEFAULTS, applySettings, readSettingsFile } from '../../config.js';
import { getState } from '../../state.js';
import { writeStorage } from './store.js';
import { checkSettings } from './validate.js';

/** Current fare-sharing settings, as applied to the live config objects. */
export function getSettings() {
  return {
    integrationDiscount: FARE_SHARE.integrationDiscount,
    fareWeight: FARE_SHARE.fareWeight,
    costWeights: Object.fromEntries(Object.entries(MODES).map(([k, m]) => [k, m.costWeight])),
    modes: Object.fromEntries(Object.entries(MODES).map(([k, m]) => [k, { label: m.label, operator: m.operator, color: m.color }])),
    defaults: SETTINGS_DEFAULTS,
    overrides: readSettingsFile(),
  };
}

export function updateSettings(body) {
  const before = getSettings();
  const patch = checkSettings(body);
  const current = readSettingsFile();
  const next = { ...current, ...patch, costWeights: { ...current.costWeights, ...patch.costWeights } };
  writeStorage('settings.json', next);
  applySettings(next);
  clearSettlementCache();
  return { before, after: getSettings() };
}

export function resetSettings() {
  writeStorage('settings.json', {});
  applySettings({});
  clearSettlementCache();
  return getSettings();
}

function clearSettlementCache() {
  try {
    getState().settlementCache.clear();
  } catch {
    // data not loaded; nothing cached
  }
}
