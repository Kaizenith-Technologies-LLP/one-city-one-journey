import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { STORAGE_DIR } from '../../config.js';
import { initState } from '../../state.js';
import { httpError } from '../planner.js';

// Same resolution as services/network.js, so edits land in the files the planner reads.
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data');

function readJsonFile(file, fallback) {
  if (!existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw httpError(503, `Missing file: ${file}`);
  }
  return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
}

/** Arrays are written one record per line (like the source files), objects pretty-printed. */
function serialise(value) {
  if (Array.isArray(value)) return value.length ? `[\n${value.map((v) => ` ${JSON.stringify(v)}`).join(',\n')}\n]\n` : '[]\n';
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Writes via a temp file + rename, so readers never see a half-written file. */
function writeAtomic(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, file);
}

export const readData = (name) => readJsonFile(path.join(DATA_DIR, name));
export const readStorage = (name, fallback) => readJsonFile(path.join(STORAGE_DIR, name), fallback);
export const writeStorage = (name, value) => writeAtomic(path.join(STORAGE_DIR, name), serialise(value));

/**
 * Writes network files and rebuilds the live state (planner, hubs, overlaps).
 * If the new data fails to load, the previous contents (held in memory) are restored.
 */
export function commitData(changes) {
  const previous = new Map();
  try {
    for (const [name, value] of Object.entries(changes)) {
      const file = path.join(DATA_DIR, name);
      previous.set(file, readFileSync(file, 'utf8'));
      writeAtomic(file, serialise(value));
    }
    const { loadError } = initState();
    if (loadError) throw httpError(400, `Rejected: data would not load (${loadError.message})`);
  } catch (err) {
    for (const [file, text] of previous) writeAtomic(file, text);
    initState();
    throw err;
  }
}
