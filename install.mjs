#!/usr/bin/env node
// Copies every skill in ./skills into the folders each coding agent reads.
// Usage: node install.mjs [agents...] [--global] [--project <dir>]
//   node install.mjs                       -> all agents, into the current project
//   node install.mjs claude cursor         -> only those agents
//   node install.mjs --global              -> all agents, into your home folder (every project)
//   node install.mjs --project ../my-site  -> install into another project
import { cpSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Paths from https://github.com/vercel-labs/skills/blob/main/docs/agents.md (Agent Skills standard).
const AGENTS = {
  claude: { project: '.claude/skills', global: '.claude/skills' },
  codex: { project: '.agents/skills', global: '.agents/skills' },
  cursor: { project: '.agents/skills', global: '.cursor/skills' },
  copilot: { project: '.agents/skills', global: '.copilot/skills' },
  antigravity: { project: '.agents/skills', global: '.gemini/antigravity/skills' },
  opencode: { project: '.agents/skills', global: '.config/opencode/skills' },
  kimi: { project: '.agents/skills', global: '.agents/skills' },
};

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node install.mjs [${Object.keys(AGENTS).join('|')}|all ...] [--global] [--project <dir>]`);
  process.exit(0);
}
const isGlobal = args.includes('--global');
const pIdx = args.indexOf('--project');
const names = args.filter((a, i) => !a.startsWith('-') && !(pIdx >= 0 && i === pIdx + 1));
const picked = names.length && !names.includes('all') ? names : Object.keys(AGENTS);

const unknown = picked.filter((n) => !AGENTS[n]);
if (unknown.length) {
  console.error(`Unknown agent(s): ${unknown.join(', ')}. Choose from: ${Object.keys(AGENTS).join(', ')}, all`);
  process.exit(1);
}

const base = isGlobal ? homedir() : resolve(pIdx >= 0 ? args[pIdx + 1] ?? '.' : '.');
const src = join(dirname(fileURLToPath(import.meta.url)), 'skills');
const skills = readdirSync(src, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

// Several agents share one folder, so group agents by destination and copy once per folder.
const byDest = new Map();
for (const name of picked) {
  const dest = join(base, AGENTS[name][isGlobal ? 'global' : 'project']);
  byDest.set(dest, [...(byDest.get(dest) || []), name]);
}
for (const [dest, agents] of byDest) {
  for (const skill of skills) cpSync(join(src, skill), join(dest, skill), { recursive: true });
  console.log(`${skills.join(', ')} -> ${dest}  (${agents.join(', ')})`);
}
