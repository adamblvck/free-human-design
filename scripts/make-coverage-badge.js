#!/usr/bin/env node
// Regenerates the coverage badge in README.md from a fresh coverage run.
//
//   npm run coverage:badge
//
// Reads coverage/coverage-summary.json (produced by `jest --coverage` with the
// json-summary reporter) and rewrites the shields.io coverage badge URL in
// README.md with the current statements percentage and a threshold colour.
// Zero dependencies, no external service.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SUMMARY = path.join(ROOT, 'coverage', 'coverage-summary.json');
const README = path.join(ROOT, 'README.md');

function colorFor(pct) {
  if (pct >= 90) return 'brightgreen';
  if (pct >= 80) return 'green';
  if (pct >= 70) return 'yellowgreen';
  if (pct >= 60) return 'yellow';
  if (pct >= 50) return 'orange';
  return 'red';
}

if (!fs.existsSync(SUMMARY)) {
  console.error(`No coverage summary at ${SUMMARY}. Run \`npm run coverage\` first.`);
  process.exit(1);
}

const total = JSON.parse(fs.readFileSync(SUMMARY, 'utf8')).total;
const pct = Math.round(total.statements.pct);
const color = colorFor(pct);
const url = `https://img.shields.io/badge/coverage-${pct}%25-${color}.svg`;

let readme = fs.readFileSync(README, 'utf8');
const badge = `[![coverage](${url})](#tests)`;
// Replace an existing coverage badge, or report if the anchor is missing.
const re = /\[!\[coverage\]\(https:\/\/img\.shields\.io\/badge\/coverage-[^)]*\)\]\(#tests\)/;
if (re.test(readme)) {
  readme = readme.replace(re, badge);
  fs.writeFileSync(README, readme);
  console.log(`Updated coverage badge → ${pct}% (${color})`);
} else {
  console.log(`Coverage is ${pct}% (${color}). Add this badge to README.md:\n  ${badge}`);
}
