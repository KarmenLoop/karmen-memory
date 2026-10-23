import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

const runtime = resolve(process.argv[2] || ".");
assert.ok(
  existsSync(join(runtime, "dist/index.html")),
  "Runtime needs a built interface",
);
const dataDir = mkdtempSync(join(tmpdir(), "karmen-runtime-check-"));
let child;
async function start() {
  child = spawn(process.execPath, ["server/http.mjs"], {
    cwd: runtime,
    env: {
      ...process.env,
      KARMEN_MEMORY_HOME: dataDir,
      KARMEN_MEMORY_PORT: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "",
    errors = "";
  child.stderr.on("data", (bytes) => (errors += bytes));
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(Error("Runtime startup timed out"));
    }, 15000);
    child.stdout.on("data", (bytes) => {
      output += bytes;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(Error(`Runtime exited ${code}: ${errors}`));
    });
    child.once("error", reject);
  });
  const session = await fetch(`${url}/api/session`);
  assert.equal(session.status, 200);
  return {
    url,
    cookie: session.headers.get("set-cookie").split(";")[0],
    csrf: (await session.json()).csrf,
  };
}
async function stop() {
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const [code] = await exited;
  assert.equal(code, 0);
  child = null;
}
async function owner(session, path, value) {
  const res = await fetch(`${session.url}/api${path}`, {
    method: value ? "POST" : "GET",
    headers: {
      Cookie: session.cookie,
      ...(value
        ? { "Content-Type": "application/json", "X-CSRF-Token": session.csrf }
        : {}),
    },
    ...(value ? { body: JSON.stringify(value) } : {}),
  });
  assert.ok(res.ok, `${path} returned ${res.status}`);
  return res.json();
}
try {
  let session = await start();
  const page = await fetch(session.url),
    html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /id="root"/);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(
    (m) => m[1],
  );
  assert.ok(assets.length >= 2);
  for (const path of assets)
    assert.equal((await fetch(session.url + path)).status, 200);
  const fact = await owner(session, "/memories", {
    title: "Runtime acceptance fact",
    body: "Runtime acceptance requires persistent memory after process restart.",
    project: "Runtime QA",
    provenance: "Synthetic clean-runtime verification",
  });
  const result = await owner(session, "/search", {
    query: "persistent memory",
    project: "Runtime QA",
  });
  assert.equal(result.hits[0].id, fact.id);
  await stop();
  session = await start();
  const state = await owner(session, "/state");
  assert.equal(state.memories[0].id, fact.id);
  assert.equal(state.memories[0].revision, 1);
  assert.equal(state.lan.enabled, false);
  await stop();
  console.log(
    JSON.stringify(
      {
        staticAssets: assets.length,
        createRetrieveSameId: true,
        actualProcessRestart: true,
        persistentFact: true,
        runtimeVersion: state.service.version,
        result: "PASS",
      },
      null,
      2,
    ),
  );
} finally {
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited.catch(() => {});
  }
  rmSync(dataDir, { recursive: true, force: true });
}
