#!/usr/bin/env node
// Maps every frontend call to the server route that handles it and flags the wasteful or broken ones.
// Usage: node call-map.mjs <project-dir> [--json]
// Reads: fetch / axios / api() / http.* calls with a literal "/path", Express-style routes (app.get('/x')) and
// node:http-style routes (path === '/x' && method === 'GET', /^\/x\/(\d+)$/.exec(path)), setInterval pollers.
// It is a regex scan, not a parser: confirm each finding in the code before changing anything.
// Exit code 1 when a call has no route.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'reports', 'graphify-out']);
const EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.html']);
export const CLIENT_FILE = /(^|\/)(public|static|client|frontend|www)\/|\.(html|tsx|jsx|vue|svelte)$/i;
export const isTest = (file) => /(^|\/)(tests?|__tests__|load)\/|\.(test|spec)\./.test(file);

export function walk(dir, root = dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, root, out);
    else if (EXT.has(extname(name))) out.push({ file: relative(root, p).replaceAll('\\', '/'), text: readFileSync(p, 'utf8') });
  }
  return out;
}

const lineOf = (text, i) => text.slice(0, i).split('\n').length;
// "/api/items/${id}", "/api/items/:id" and "/api/items/{id}" all become "/api/items/:p"
const norm = (p) => p.split(/[?#]/)[0].replace(/\$\{[^}]*\}|\{[^}]*\}|:\w+/g, ':p').replace(/\/+$/, '') || '/';
const sameSegments = (a, b) => {
  const [x, y] = [a.split('/'), b.split('/')];
  return x.length === y.length && x.every((s, i) => s === y[i] || s === ':p' || y[i] === ':p');
};

const CALL = /\b(?:fetch|api|axios(?:\.(get|post|put|patch|delete))?|http\.(get|post|put|patch|delete)|\$\.(get|post)|request)\(\s*([`'"])(\/[^`'"]*)\4/g;

export function findCalls(text) {
  const hits = [...text.matchAll(CALL)];
  return hits.map((m, i) => {
    const tail = text.slice(m.index, Math.min(m.index + 220, hits[i + 1]?.index ?? Infinity));
    const verb = m[1] || m[2] || m[3] || tail.match(/method:\s*['"](\w+)['"]/)?.[1] || 'GET';
    const concat = m[5].endsWith('/') && /^\s*\+/.test(text.slice(m.index + m[0].length)); // '/api/items/' + id
    return { method: verb.toUpperCase(), path: norm(concat ? `${m[5]}:p` : m[5]), index: m.index, line: lineOf(text, m.index) };
  });
}

export function findRoutes(text) {
  const raw = [];
  const express = /\b(?:app|router|server|fastify|route)\.(get|post|put|patch|delete|all)\(\s*([`'"])(\/[^`'"]*)\2/g;
  for (const m of text.matchAll(express)) raw.push({ index: m.index, path: norm(m[3]), methods: [m[1] === 'all' ? 'ANY' : m[1].toUpperCase()] });
  const rest = (i) => text.slice(i, text.indexOf('\n', i));
  const methodsIn = (s) => [...s.matchAll(/method\s*===\s*['"](\w+)['"]/g)].map((x) => x[1].toUpperCase());
  for (const m of text.matchAll(/\bpath\s*===\s*(['"`])(\/[^'"`]*)\1/g)) {
    const ms = methodsIn(rest(m.index));
    raw.push({ index: m.index, path: norm(m[2]), methods: ms.length ? ms : ['ANY'] });
  }
  for (const m of text.matchAll(/\/\^((?:\\\/|[^\/\n])+?)\$\/\.exec\(\s*path\s*\)/g)) {
    const src = m[1].replace(/\\\//g, '/').replace(/\((?:[^()\\]|\\.)*\)/g, ':p');
    const ms = methodsIn(rest(m.index));
    raw.push({ index: m.index, path: norm(src), methods: ms.length ? ms : ['ANY'] });
  }
  raw.sort((a, b) => a.index - b.index);
  // a bare `path === '/x'` with no method is usually rate-limit or static classification when a real route exists for that path
  const specific = new Set(raw.filter((r) => r.methods[0] !== 'ANY').map((r) => r.path));
  return raw.filter((r) => r.methods[0] !== 'ANY' || !specific.has(r.path)).flatMap((r, i) => {
    const block = text.slice(r.index, Math.min(r.index + 1500, raw.find((x, j) => j > i && x.index > r.index)?.index ?? Infinity));
    return r.methods.map((method) => ({ method, path: r.path, index: r.index, line: lineOf(text, r.index), block }));
  });
}

export function callMap(dir) {
  const files = walk(dir).filter((f) => !isTest(f.file));
  const calls = [], routes = [], findings = [];
  for (const { file, text } of files) {
    for (const c of findCalls(text)) calls.push({ ...c, file });
    if (!CLIENT_FILE.test(file)) for (const r of findRoutes(text)) routes.push({ ...r, file }); // client-side routers also compare paths
    for (const m of text.matchAll(/setInterval\(/g)) {
      const win = text.slice(m.index, m.index + 600);
      if (new RegExp(CALL.source).test(win) || /\b(refresh|poll|fetch|load|reload|update)\w*\(/i.test(win)) {
        const ms = win.match(/[})]\s*,\s*([\d_]+)\s*\)/)?.[1];
        findings.push({ sev: 'warn', code: 'POLLING', where: `${file}:${lineOf(text, m.index)}`, msg: `polls${ms ? ` every ${ms} ms` : ''}: needs a stated freshness reason; prefer refetch-on-action/focus or SSE (references/realtime.md)` });
      }
    }
    const lines = text.split('\n');
    for (const c of findCalls(text)) {
      const before = lines.slice(Math.max(0, c.line - 4), c.line).join('\n');
      if (/\bfor\s*(await\s*)?\(|\.map\(|\.forEach\(|\bwhile\s*\(/.test(before)) {
        findings.push({ sev: 'warn', code: 'LOOP_CALL', where: `${file}:${c.line}`, msg: `${c.method} ${c.path} sits inside a loop: N items = N requests; use a batch or aggregate endpoint` });
      }
    }
  }
  const mapped = calls.map((c) => ({ ...c, route: routes.find((r) => (r.method === 'ANY' || r.method === c.method) && sameSegments(r.path, c.path)) }));
  if (!routes.length) findings.push({ sev: 'info', code: 'NO_ROUTES_FOUND', where: '-', msg: 'no server routes recognised in this folder; point the script at the folder that holds the server code too' });
  else for (const c of mapped) {
    if (!c.route && !/\.\w+$/.test(c.path)) findings.push({ sev: 'error', code: 'NO_ROUTE', where: `${c.file}:${c.line}`, msg: `${c.method} ${c.path} has no matching route` });
  }
  if (calls.length) for (const r of routes) {
    if (!mapped.some((c) => c.route === r)) findings.push({ sev: 'warn', code: 'UNUSED_ROUTE', where: `${r.file}:${r.line}`, msg: `${r.method} ${r.path} is never called by this frontend: webhook, external client, or dead code? (dead routes are attack surface)` });
  }
  const byKey = Object.groupBy(mapped, (c) => `${c.method} ${c.path}`);
  for (const [key, list] of Object.entries(byKey)) {
    if (list.length >= 3) findings.push({ sev: 'info', code: 'DUPLICATE_CALL', where: key, msg: `called from ${list.length} places (${list.map((c) => `${c.file}:${c.line}`).join(', ')}): share one fetch/cache` });
  }
  const perFile = Object.fromEntries(Object.entries(Object.groupBy(calls, (c) => c.file)).map(([f, l]) => [f, l.length]));
  return { calls: mapped, routes, perFile, findings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, flag] = process.argv.slice(2);
  if (!dir) { console.error('Usage: node call-map.mjs <project-dir> [--json]'); process.exit(2); }
  const r = callMap(dir);
  if (flag === '--json') console.log(JSON.stringify({ ...r, calls: r.calls.map(({ route, ...c }) => ({ ...c, route: route && `${route.file}:${route.line}` })), routes: r.routes.map(({ block, ...x }) => x) }, null, 2));
  else {
    console.log(`Call map: ${r.calls.length} calls, ${r.routes.length} routes\n`);
    for (const c of r.calls) console.log(`${c.method.padEnd(6)} ${c.path.padEnd(32)} ${c.file}:${c.line}  ->  ${c.route ? `${c.route.file}:${c.route.line}` : 'NO ROUTE'}`);
    console.log('\nCalls per file:', JSON.stringify(r.perFile));
    console.log(r.findings.length ? '\nFindings' : '\nNo findings.');
    for (const f of r.findings) console.log(`  ${f.sev.toUpperCase().padEnd(5)} ${f.code.padEnd(16)} ${f.where}  ${f.msg}`);
  }
  process.exitCode = r.findings.some((f) => f.sev === 'error') ? 1 : 0;
}
