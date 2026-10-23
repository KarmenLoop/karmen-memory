// Copyright 2026 KarmenLoop. SPDX-License-Identifier: Apache-2.0
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export class Fault extends Error {
  constructor(status, code, message) { super(message); Object.assign(this, { status, code }); }
}
export const fail = (condition, code, message, status = 400) => {
  if (!condition) throw new Fault(status, code, message);
};
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
const now = () => new Date().toISOString();
const token = () => randomBytes(32).toString('base64url');
export function text(value, field, max = 3000) {
  fail(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'INVALID_INPUT', `${field} must contain 1–${max} characters.`);
  return value.trim();
}
export function vector(value) {
  fail(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length <= 128, 'INVALID_VECTOR', 'Invalid record version.');
  for (const [key, n] of Object.entries(value)) fail(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key) && Number.isSafeInteger(n) && n > 0, 'INVALID_VECTOR', 'Invalid record version.');
  return value;
}
export function relation(a, b) {
  let greater = false, less = false;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    greater ||= (a[key] || 0) > (b[key] || 0); less ||= (a[key] || 0) < (b[key] || 0);
  }
  return greater && less ? 'concurrent' : greater ? 'newer' : less ? 'older' : 'equal';
}
const fields = ['title', 'body', 'type', 'project', 'scope', 'favorite', 'status', 'provenance'];
export function cleanMemory(input) {
  fail(input && typeof input === 'object' && !Array.isArray(input), 'INVALID_INPUT', 'A memory object is required.');
  const out = {};
  for (const key of ['title', 'body', 'type', 'project', 'provenance']) out[key] = text(input[key], key, { title: 120, body: 6000, type: 50, project: 80, provenance: 6000 }[key]);
  fail(['local', 'shared'].includes(input.scope), 'INVALID_INPUT', 'scope must be local or shared.');
  fail(['active', 'archived', 'pending'].includes(input.status), 'INVALID_INPUT', 'Invalid memory status.');
  out.scope = input.scope; out.status = input.status; out.favorite = input.favorite === true;
  return out;
}
export class Store {
  constructor(directory, database) {
    mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
    this.directory = directory; this.ownsDatabase = !database; this.db = database || new DatabaseSync(join(directory, 'memory.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS replica_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS replica_memories(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS replica_changes(seq INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS replica_events(id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS replica_credentials(id TEXT PRIMARY KEY, secret_hash TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS replica_pairings(hash TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS replica_peers(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS replica_conflicts(id TEXT PRIMARY KEY, memory_id TEXT NOT NULL, payload TEXT NOT NULL);`);
    if (this.ownsDatabase) chmodSync(join(directory, 'memory.sqlite'), 0o600);
    this.nodeId = this.setting('nodeId');
    if (!this.nodeId) { this.nodeId = randomUUID(); this.setting('nodeId', this.nodeId); }
    if (!database && !existsSync(join(directory, 'admin.json'))) {
      // Initialize exactly once. A missing credential file on an existing store is not a reset.
      fail(!this.db.prepare('SELECT id FROM replica_credentials LIMIT 1').get(), 'ADMIN_FILE_MISSING', 'Restore admin.json from your private backup; the store was not reset.', 500);
      const admin = this.createCredential({ name: 'Local owner', role: 'admin', projects: ['*'] });
      writeFileSync(join(directory, 'admin.json'), JSON.stringify({ token: admin.token, nodeId: this.nodeId }, null, 2), { mode: 0o600, flag: 'wx' });
    }
  }
  close() { if (this.ownsDatabase) this.db.close(); }
  tx(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const out = fn(); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  setting(key, value) {
    if (value !== undefined) this.db.prepare('INSERT INTO replica_settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value));
    const row = this.db.prepare('SELECT value FROM replica_settings WHERE key=?').get(key); return row ? JSON.parse(row.value) : null;
  }
  event(actor, action, detail) { this.db.prepare('INSERT INTO replica_events(at,actor,action,detail) VALUES(?,?,?,?)').run(now(), actor, action, detail); }
  events() { return this.db.prepare('SELECT * FROM replica_events ORDER BY id DESC LIMIT 200').all(); }
  createCredential({ name, role, projects }) {
    text(name, 'name', 80); fail(['admin', 'read', 'write', 'sync'].includes(role), 'INVALID_ROLE', 'Invalid access role.');
    fail(Array.isArray(projects) && projects.length > 0 && projects.length <= 50, 'INVALID_PROJECTS', 'Choose at least one project.');
    projects.forEach(p => text(p, 'project', 80));
    const id = randomUUID(), secret = token(), payload = { id, name, role, projects: [...new Set(projects)], createdAt: now(), lastUsedAt: null, revoked: false };
    this.db.prepare('INSERT INTO replica_credentials VALUES(?,?,?)').run(id, digest(secret), JSON.stringify(payload));
    return { ...payload, token: secret };
  }
  authenticate(secret) {
    if (typeof secret !== 'string' || secret.length > 256) return null;
    const row = this.db.prepare('SELECT payload FROM replica_credentials WHERE secret_hash=?').get(digest(secret));
    if (!row) return null; const actor = JSON.parse(row.payload); if (actor.revoked) return null;
    actor.lastUsedAt = now(); this.db.prepare('UPDATE replica_credentials SET payload=? WHERE id=?').run(JSON.stringify(actor), actor.id); return actor;
  }
  credentials() { return this.db.prepare('SELECT payload FROM replica_credentials').all().map(r => JSON.parse(r.payload)); }
  revoke(id) {
    const row = this.db.prepare('SELECT payload FROM replica_credentials WHERE id=?').get(id); fail(row, 'NOT_FOUND', 'Credential not found.', 404);
    const value = JSON.parse(row.payload); fail(value.role !== 'admin', 'OWNER_REQUIRED', 'The owner credential cannot be revoked here.'); value.revoked = true;
    this.db.prepare('UPDATE replica_credentials SET payload=? WHERE id=?').run(JSON.stringify(value), id); this.event('owner', 'revoke', value.name);
  }
  allowed(actor, project) { return actor.role === 'admin' || actor.projects.includes('*') || actor.projects.includes(project); }
  admin(actor) { fail(actor?.role === 'admin', 'FORBIDDEN', 'Owner access is required.', 403); }
  get(id) { const row = this.db.prepare('SELECT payload FROM replica_memories WHERE id=?').get(id); return row ? JSON.parse(row.payload) : null; }
  all() { return this.db.prepare('SELECT payload FROM replica_memories ORDER BY rowid DESC').all().map(r => JSON.parse(r.payload)); }
  list(actor, query = '', limit = 1000) {
    const terms = String(query).toLocaleLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 20);
    const records = this.all().filter(m => this.allowed(actor, m.project) && m.status !== 'deleted' && (actor.role === 'admin' || m.status === 'active'))
      .filter(m => terms.every(t => `${m.title} ${m.body} ${m.project}`.toLocaleLowerCase().includes(t)));
    return limit === null ? records : records.slice(0, limit);
  }
  put(record, actor) {
    this.db.prepare('INSERT INTO replica_memories VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(record.id, JSON.stringify(record));
    if (record.status === 'deleted') this.db.prepare("UPDATE replica_changes SET payload=? WHERE json_extract(payload,'$.id')=?").run(JSON.stringify(record), record.id);
    this.db.prepare('INSERT INTO replica_changes(payload) VALUES(?)').run(JSON.stringify(record));
    this.event(actor, 'memory.' + record.status, record.id); return record;
  }
  create(input, actor) {
    fail(['admin', 'write'].includes(actor.role), 'FORBIDDEN', 'This credential is read-only.', 403);
    const value = cleanMemory({ ...input, status: actor.role === 'admin' ? input.status || 'active' : 'pending' });
    fail(this.allowed(actor, value.project), 'FORBIDDEN', 'Project access is not granted.', 403);
    return this.tx(() => this.put({ ...value, id: randomUUID(), source: actor.name, updated: now(), revision: 1, vector: { [this.nodeId]: 1 } }, actor.name));
  }
  update(id, input, actor) {
    this.admin(actor);
    return this.tx(() => {
      const current = this.get(id); fail(current && current.status !== 'deleted', 'NOT_FOUND', 'Memory not found.', 404);
      fail(input.expectedRevision === current.revision, 'VERSION_CONFLICT', 'The memory changed. Reload its current version before saving.', 409);
      fail(!this.db.prepare('SELECT id FROM replica_conflicts WHERE memory_id=?').get(id), 'CONFLICT_PENDING', 'Resolve the saved conflict before editing this memory.', 409);
      const value = cleanMemory({ ...current, ...input });
      fail(value.scope === current.scope && value.project === current.project, 'SCOPE_IMMUTABLE', 'Create a new memory to change its project or sharing scope. Delete the shared original if access must be withdrawn.');
      return this.put({ ...current, ...value, revision: current.revision + 1, vector: { ...current.vector, [this.nodeId]: (current.vector[this.nodeId] || 0) + 1 }, updated: now() }, actor.name);
    });
  }
  remove(id, revision, actor) {
    this.admin(actor); return this.tx(() => {
      const m = this.get(id); fail(m && m.status !== 'deleted', 'NOT_FOUND', 'Memory not found.', 404);
      fail(revision === m.revision, 'VERSION_CONFLICT', 'Reload before deleting.', 409);
      this.db.prepare('DELETE FROM replica_conflicts WHERE memory_id=?').run(id);
      return this.put({ id, project: m.project, scope: m.scope, status: 'deleted', vector: { ...m.vector, [this.nodeId]: (m.vector[this.nodeId] || 0) + 1 }, revision: m.revision + 1, updated: now() }, actor.name);
    });
  }
  pairing(projects) {
    fail(Array.isArray(projects) && projects.length > 0, 'INVALID_PROJECTS', 'Choose shared projects.'); projects.forEach(p => text(p, 'project', 80));
    const code = randomBytes(18).toString('base64url'), value = { projects, expiresAt: Date.now() + 600000 };
    this.db.prepare('DELETE FROM replica_pairings WHERE json_extract(payload,\'$.expiresAt\')<?').run(Date.now());
    this.db.prepare('INSERT INTO replica_pairings VALUES(?,?)').run(digest(code), JSON.stringify(value)); return { code, expiresAt: new Date(value.expiresAt).toISOString() };
  }
  pair(code, name, nodeId) {
    text(name, 'device name', 80); text(nodeId, 'node ID', 80);
    fail(nodeId !== this.nodeId, 'SAME_NODE', 'A store cannot pair with itself.');
    return this.tx(() => {
      const row = this.db.prepare('SELECT payload FROM replica_pairings WHERE hash=?').get(digest(String(code)));
      fail(row && JSON.parse(row.payload).expiresAt > Date.now(), 'PAIRING_EXPIRED', 'Pairing code is invalid, expired or already used.', 403);
      const { projects } = JSON.parse(row.payload); this.db.prepare('DELETE FROM replica_pairings WHERE hash=?').run(digest(String(code)));
      const previous = this.peers().find(p => p.id === nodeId); if (previous?.credentialId) this.revoke(previous.credentialId);
      const credential = this.createCredential({ name, role: 'sync', projects });
      const peer = { id: nodeId, name, credentialId: credential.id, projects, direction: 'incoming', lastSyncAt: null, lastError: null };
      this.savePeer(peer); this.event(name, 'device.paired', nodeId); return { nodeId: this.nodeId, token: credential.token, projects };
    });
  }
  peers() { return this.db.prepare('SELECT payload FROM replica_peers').all().map(r => JSON.parse(r.payload)); }
  savePeer(peer) { this.db.prepare('INSERT INTO replica_peers VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(peer.id, JSON.stringify(peer)); }
  conflicts() { return this.db.prepare('SELECT payload FROM replica_conflicts').all().map(r => JSON.parse(r.payload)); }
  merge(incoming, actor) {
    fail(incoming && typeof incoming.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(incoming.id), 'INVALID_RECORD', 'Invalid memory ID.');
    text(incoming.project, 'project', 80); vector(incoming.vector);
    fail(incoming.scope === 'shared' && this.allowed(actor, incoming.project), 'FORBIDDEN', 'Only authorized shared projects can synchronize.', 403);
    fail(Number.isSafeInteger(incoming.revision) && incoming.revision > 0 && incoming.revision < 1e9 && typeof incoming.updated === 'string' && Number.isFinite(Date.parse(incoming.updated)), 'INVALID_RECORD', 'Invalid revision metadata.');
    fail(['active', 'archived', 'deleted'].includes(incoming.status), 'INVALID_RECORD', 'Pending proposals cannot synchronize.');
    if (incoming.status !== 'deleted') cleanMemory(incoming);
    const next = incoming.status === 'deleted'
      ? Object.fromEntries(['id', 'project', 'scope', 'status', 'vector', 'revision', 'updated'].map(k => [k, incoming[k]]))
      : { ...cleanMemory(incoming), ...Object.fromEntries(['id', 'source', 'vector', 'revision', 'updated'].map(k => [k, incoming[k]])), source: text(incoming.source, 'source', 80) };
    const current = this.get(next.id);
    fail(!current || (current.project === next.project && current.scope === 'shared'), 'SCOPE_CONFLICT', 'An existing local record cannot be overwritten through synchronization.', 409);
    if (!current) { this.put(next, actor.name); return { status: 'received', record: next }; }
    const order = relation(next.vector, current.vector);
    if (order === 'equal') {
      fail(canonical(next) === canonical(current), 'VECTOR_COLLISION', 'Identical record versions contain different data.', 409);
      return { status: 'unchanged', record: current };
    }
    if (order === 'older') return { status: 'older', record: current };
    if (order === 'newer') { this.put(next, actor.name); this.db.prepare('DELETE FROM replica_conflicts WHERE memory_id=?').run(next.id); return { status: 'received', record: next }; }
    if (next.status === 'deleted' || current.status === 'deleted') {
      const versions = Object.fromEntries([...new Set([...Object.keys(next.vector), ...Object.keys(current.vector)])].map(k => [k, Math.max(next.vector[k] || 0, current.vector[k] || 0)]));
      versions[this.nodeId] = (versions[this.nodeId] || 0) + 1;
      const deleted = { id: next.id, project: next.project, scope: 'shared', status: 'deleted', vector: versions, revision: Math.max(next.revision, current.revision) + 1, updated: now() };
      this.db.prepare('DELETE FROM replica_conflicts WHERE memory_id=?').run(next.id); this.put(deleted, actor.name); return { status: 'deletion-preserved', record: deleted };
    }
    const variants = [next, current].sort((a, b) => digest(a).localeCompare(digest(b)));
    const conflict = { id: digest(variants), memoryId: next.id, variants, createdAt: now() };
    this.db.prepare('INSERT OR IGNORE INTO replica_conflicts VALUES(?,?,?)').run(conflict.id, next.id, JSON.stringify(conflict));
    return { status: 'conflict', record: current, conflict };
  }
  resolve(id, choice, actor) {
    this.admin(actor); return this.tx(() => {
      const row = this.db.prepare('SELECT payload FROM replica_conflicts WHERE id=?').get(id); fail(row, 'NOT_FOUND', 'Conflict not found.', 404);
      const c = JSON.parse(row.payload); fail(choice === 0 || choice === 1, 'INVALID_INPUT', 'Choose version 0 or 1.');
      const current = this.get(c.memoryId), versions = {};
      for (const m of [...c.variants, current]) for (const [k, v] of Object.entries(m.vector)) versions[k] = Math.max(versions[k] || 0, v);
      versions[this.nodeId] = (versions[this.nodeId] || 0) + 1;
      const resolved = { ...c.variants[choice], vector: versions, revision: Math.max(...c.variants.map(m => m.revision), current.revision) + 1, updated: now() };
      this.db.prepare('DELETE FROM replica_conflicts WHERE memory_id=?').run(c.memoryId); return this.put(resolved, actor.name);
    });
  }
  feed(actor, after = 0, limit = 100) {
    fail(Number.isSafeInteger(after) && after >= 0, 'INVALID_CURSOR', 'Invalid synchronization cursor.');
    const rows = this.db.prepare('SELECT seq,payload FROM replica_changes WHERE seq>? ORDER BY seq LIMIT ?').all(after, limit);
    return { cursor: rows.length ? rows.at(-1).seq : after, more: rows.length === limit, records: rows.map(r => JSON.parse(r.payload)).filter(m => m.scope === 'shared' && m.status !== 'pending' && this.allowed(actor, m.project)) };
  }
}
