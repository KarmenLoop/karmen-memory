// Copyright 2026 KarmenLoop. SPDX-License-Identifier: Apache-2.0
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { X509Certificate } from 'node:crypto';
import { fail, Fault } from './replica-store.mjs';

export function lanTarget(value) {
  const u = new URL(value);
  const ip = u.hostname;
  const parts = ip.split('.').map(Number);
  const privateIp = isIP(ip) === 4 && (parts[0] === 10 || parts[0] === 127 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
  fail(u.protocol === 'https:' && privateIp && !u.username && !u.password && !u.search && !u.hash && u.pathname === '/', 'INVALID_PEER_URL', 'Use an HTTPS URL with a private IPv4 address and port.');
  return u.origin;
}
export function certificateInfo(pem) {
  fail(typeof pem === 'string' && pem.length < 20000, 'INVALID_CERTIFICATE', 'A PEM certificate is required.');
  try { const cert = new X509Certificate(pem); return { fingerprint: cert.fingerprint256, expiresAt: cert.validTo }; }
  catch { throw new Fault(400, 'INVALID_CERTIFICATE', 'The certificate could not be read.'); }
}
export function request(base, path, { method = 'GET', body, token, certificate, timeout = 8000, signal } = {}) {
  const url = new URL(path, base), local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  fail(url.protocol === 'https:' || (url.protocol === 'http:' && local), 'TLS_REQUIRED', 'Remote connections require HTTPS.');
  const raw = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).request(url, {
      method, ca: certificate, rejectUnauthorized: true, signal,
      headers: { ...(raw ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > 2000000) { req.destroy(new Error('Response exceeds the byte limit.')); return; } chunks.push(chunk); });
      res.on('end', () => {
        try {
          const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (res.statusCode >= 400) reject(new Fault(res.statusCode, value.code || 'REMOTE_ERROR', value.message || value.error || 'Remote request failed.'));
          else resolve(value);
        } catch { reject(new Error('The service returned an invalid response.')); }
      });
    });
    const deadline = setTimeout(() => req.destroy(new Error('The connection timed out. Local data was retained.')), timeout); deadline.unref(); req.on('close', () => clearTimeout(deadline));
    req.on('error', error => reject(new Fault(502, 'CONNECTION_FAILED', `Connection failed (${error.code || 'network error'}). Local data was retained.`)));
    if (raw) req.write(raw); req.end();
  });
}
export async function synchronize(store, peer, signal) {
  fail(peer.direction === 'outgoing' && !peer.paused, 'SYNC_UNAVAILABLE', 'This connection cannot initiate synchronization.');
  const actor = { name: peer.name, role: 'sync', projects: peer.projects };
  const options = { token: peer.token, certificate: peer.certificate, signal };
  let received = 0, conflicts = 0, sent = 0;
  try {
    let pushMore = true, pushes = 0;
    while (pushMore && pushes++ < 10) {
      const page = store.feed(actor, peer.pushCursor || 0, 25);
      for (const m of page.records) store.setting('published:' + m.id, true);
      const value = await request(peer.url, '/v1/replica/sync', { ...options, method: 'POST', body: { records: page.records } });
      fail(Array.isArray(value.outcomes) && value.outcomes.length <= 25, 'INVALID_SYNC_RESPONSE', 'Invalid synchronization response.');
      store.tx(() => {
        for (const item of value.outcomes) { const result = store.merge(item.record, actor); conflicts += result.status === 'conflict' ? 1 : 0; }
        peer.pushCursor = page.cursor; store.savePeer(peer);
      });
      sent += page.records.length; pushMore = page.more;
    }
    let more = true, pages = 0;
    while (more && pages++ < 10) {
      const page = await request(peer.url, `/v1/replica/sync?after=${peer.cursor || 0}`, options);
      fail(Array.isArray(page.records) && page.records.length <= 100 && Number.isSafeInteger(page.cursor) && page.cursor >= (peer.cursor || 0), 'INVALID_SYNC_RESPONSE', 'Invalid synchronization cursor.');
      store.tx(() => {
        for (const m of page.records) { const result = store.merge(m, actor); received++; conflicts += result.status === 'conflict' ? 1 : 0; }
        peer.cursor = page.cursor; store.savePeer(peer);
      });
      more = page.more === true;
    }
    peer.queued = more || pushMore; peer.lastSyncAt = new Date().toISOString(); peer.lastError = null; peer.failures = 0; peer.nextAttemptAt = Date.now() + 10000;
    store.savePeer(peer); return { sent, received, conflicts, more: peer.queued, lastSyncAt: peer.lastSyncAt };
  } catch (error) {
    peer.lastError = error.message; peer.failures = (peer.failures || 0) + 1; peer.nextAttemptAt = Date.now() + Math.min(60000, 5000 * 2 ** Math.min(peer.failures, 4));
    store.savePeer(peer); throw error;
  }
}
