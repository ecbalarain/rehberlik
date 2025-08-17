#!/usr/bin/env node
// Simple guard to prevent usage of paid Cloudflare features in wrangler.toml
// Fails the build if disallowed bindings are present. Allows warnings for cron triggers.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const wranglerPath = path.join(root, 'wrangler.toml');

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

const toml = readFileSafe(wranglerPath);
if (!toml) {
  // No wrangler config; nothing to verify
  process.exit(0);
}

// Strip comments per-line to avoid false positives in commented examples
const lines = toml.split(/\r?\n/).map((l) => l.split('#')[0].trim());
const content = lines.join('\n');

const disallowed = [
  { re: /\b\[\[?\s*queues\s*\]?\b/i, reason: 'Cloudflare Queues are paid features.' },
  { re: /\b\[\s*ai\s*\]|\bai\s*=\s*\{/i, reason: 'Workers AI is paid beyond free allowances; keep disabled.' },
  { re: /vectorize/i, reason: 'Vectorize (vector DB) is a paid feature.' },
  { re: /durable[_\s-]?objects?/i, reason: 'Durable Objects require a paid plan.' }
];

const warnings = [
  { re: /\b\[\s*triggers\s*\]/i, note: 'Cron triggers have limits on the free plan; ensure usage stays within free quotas.' },
  { re: /crons\s*=/i, note: 'Cron expressions detected; double-check free-tier limits.' }
];

const errors = [];
const warns = [];

for (const rule of disallowed) {
  if (rule.re.test(content)) errors.push(`- ${rule.reason} (pattern: ${rule.re})`);
}
for (const rule of warnings) {
  if (rule.re.test(content)) warns.push(`- ${rule.note}`);
}

if (warns.length) {
  console.warn('[verify-free-plan] Warnings:');
  for (const w of warns) console.warn(w);
}

if (errors.length) {
  console.error('\n[verify-free-plan] Disallowed paid features detected in wrangler.toml:\n' + errors.join('\n'));
  console.error('\nPlease remove or comment them out to stay on the Cloudflare free plan.');
  process.exit(1);
}

console.log('[verify-free-plan] OK — wrangler.toml appears free-plan compatible.');
