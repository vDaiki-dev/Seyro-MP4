// Comprueba que todo texto con data-i18n exista en todos los idiomas.
import fs from 'node:fs';
import path from 'node:path';

import { LOCALES, dictionaryKeys, translate } from '../src/frontend/i18n.js';

const root = process.cwd();
const files = ['src/frontend/index.html', 'docs/index.html'];
const used = new Set();

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of source.matchAll(/data-i18n(?:-title|-aria|-placeholder)?="([^"]+)"/g)) {
    used.add(match[1]);
  }
}

let failed = false;
for (const locale of LOCALES) {
  for (const key of used) {
    if (translate(locale, key) === key) {
      console.error(`ERROR: '${key}' falta en ${locale}`);
      failed = true;
    }
  }
}

const reference = new Set(dictionaryKeys(LOCALES[0]));
for (const locale of LOCALES.slice(1)) {
  const keys = new Set(dictionaryKeys(locale));
  const missing = [...reference].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !reference.has(key));
  if (missing.length || extra.length) {
    console.error(`ERROR: paridad rota en ${locale} · faltan ${missing.join(', ')} · sobran ${extra.join(', ')}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`OK: ${used.size} claves usadas en HTML, presentes en ${LOCALES.join(' y ')}`);
