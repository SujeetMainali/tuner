import { keyTarget } from './dsp.js';
import { BANKS, bankName, keyStatus, shortAction, statusText, swaraName } from './format.js';
import { keyInstructions } from './instructions.js';
import { messagesFor } from '../i18n/messages.js';

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

/** Every measured key on every bank (and every key on the current bank), with its instruction. */
export function reportRows(keys, readings, currentBank, tuning, tolerance, lang = 'en') {
  const rows = [messagesFor(lang).report.csv];
  for (const bank of BANKS) {
    for (const k of keys) {
      const { reading: r, cents: c, status: st } = keyStatus(readings, bank, k.midi, tuning, tolerance);
      if (!r && bank !== currentBank) continue;
      const ins = keyInstructions({ k, bank, readings, tuning, tolerance, keys, lang });
      const instruction = [ins.headline, ...ins.steps, ...ins.notes].join(' ');
      rows.push([
        k.name, swaraName(k, lang), bankName(bank, lang), keyTarget(k.midi, bank, tuning).toFixed(2),
        r ? r.freq.toFixed(2) : '', r ? c.toFixed(1) : '', r ? r.spread.toFixed(1) : '', statusText(st, lang),
        shortAction(r ? c : null, r?.spread, tolerance, lang), instruction, r ? new Date(r.at).toISOString() : '',
      ]);
    }
  }
  return rows;
}

export const reportCsv = (...args) => reportRows(...args).map((r) => r.map(csvCell).join(',')).join('\n');

/** Tab-separated, for pasting into a spreadsheet. */
export const reportTsv = (...args) =>
  reportRows(...args).map((r) => r.map((v) => String(v ?? '').replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
