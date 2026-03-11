import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const cssDir = path.resolve('css');
const cssFiles = readdirSync(cssDir)
  .filter((name) => name.endsWith('.css'))
  .map((name) => path.join(cssDir, name));

function stripComments(input) {
  return input.replace(/\/\*[\s\S]*?\*\//g, '');
}

function lineOf(input, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (input.charCodeAt(i) === 10) line++;
  }
  return line;
}

const failures = [];
const keyframes = new Map();

for (const file of cssFiles) {
  const raw = readFileSync(file, 'utf8');
  const css = stripComments(raw);

  // Duplicate keyframes across all CSS files.
  for (const match of css.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)) {
    const name = match[1];
    const at = `${path.relative(process.cwd(), file)}:${lineOf(css, match.index || 0)}`;
    if (!keyframes.has(name)) {
      keyframes.set(name, [at]);
    } else {
      keyframes.get(name).push(at);
    }
  }

  // Token guardrails: no raw colors or non-token radius in component files.
  if (!file.endsWith('tokens.css')) {
    for (const match of css.matchAll(/(#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\()/g)) {
      const token = match[1];
      const at = `${path.relative(process.cwd(), file)}:${lineOf(css, match.index || 0)}`;
      failures.push(`hardcoded color token \"${token}\" at ${at}`);
    }

    for (const match of css.matchAll(/border-radius\s*:\s*([^;]+);/g)) {
      const value = match[1].trim();
      const allowed = value === 'var(--radius)' || value === '0' || value === '0px' || value === '50%' || value === '999px';
      if (allowed) continue;
      const at = `${path.relative(process.cwd(), file)}:${lineOf(css, match.index || 0)}`;
      failures.push(`non-token border-radius \"${value}\" at ${at}`);
    }
  }
}

for (const [name, locations] of keyframes.entries()) {
  if (locations.length > 1) {
    failures.push(`duplicate @keyframes \"${name}\" at ${locations.join(', ')}`);
  }
}

if (failures.length) {
  console.error('CSS quality gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`CSS quality gate passed for ${cssFiles.length} file(s).`);
