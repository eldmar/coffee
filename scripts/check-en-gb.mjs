/** Guard visible source copy against the two US spellings standardised by KAVOVO. */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = 'src';
const EXTENSIONS = new Set(['.astro', '.md', '.ts', '.tsx']);
const US_SPELLING = /\b(?:favorite|favorites|favorited|flavor|flavors|flavored|flavoring)\b/gi;
const ALLOWED_NAMES = ["Coffee Taster's Flavor Wheel"];
const problems = [];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

for (const file of sourceFiles(ROOT)) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    let visible = line;
    for (const allowed of ALLOWED_NAMES) visible = visible.replaceAll(allowed, '');
    const matches = [...visible.matchAll(US_SPELLING)].map((match) => match[0]);
    if (matches.length > 0) problems.push(`${file}:${index + 1} ${matches.join(', ')}`);
  });
}

if (problems.length > 0) {
  console.error('Use en-GB spelling in visible copy and metadata:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log('en-GB copy check passed.');
