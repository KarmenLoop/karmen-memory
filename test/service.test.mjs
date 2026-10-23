import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createService } from "../server/http.mjs";
import { request } from "../bin/client.mjs";

const root = mkdtempSync(join(tmpdir(), "karmen-memory-test-"));
let service, base, cookie, csrf;
async function start() {
  service = await createService({
    dataDir: root,
    port: 0,
    lanPort: 0,
    lanHost: "127.0.0.1",
  });
  base = `http://127.0.0.1:${service.port}`;
  const session = await fetch(`${base}/api/session`);
  cookie = session.headers.get("set-cookie").split(";")[0];
  csrf = (await session.json()).csrf;
}
async function owner(
  path,
  value,
  method = value === undefined ? "GET" : "POST",
  headers = {},
) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(value !== undefined
        ? { "Content-Type": "application/json", "X-CSRF-Token": csrf }
        : {}),
      ...headers,
    },
    ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
  });
  const contentType = response.headers.get("content-type");
  return {
    status: response.status,
    value: contentType?.includes("json")
      ? await response.json()
      : Buffer.from(await response.arrayBuffer()),
  };
}
const fact = (changes = {}) => ({
  title: "提交规范",
  body: "项目提交信息必须使用英文，并说明修改原因。",
  project: "KODER",
  scope: "全设备",
  type: "代码规范",
  provenance: "Test source requirement",
  ...changes,
});
let memory, reader, writer, ci, device, ca;
async function client(token, path, value, key) {
  return request({ url: base, token }, `/v1/${path}`, value, key);
}
function run(args, env = {}, stdin = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      env: {
        ...process.env,
        KARMEN_MEMORY_URL: base,
        KARMEN_MEMORY_PROFILE: join(root, "not-created.json"),
        KARMEN_MEMORY_TOKEN_FILE: "",
        KARMEN_MEMORY_TOKEN: "",
        ...env,
      },
      stdio: "pipe",
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (v) => (stdout += v));
    child.stderr.on("data", (v) => (stderr += v));
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdin);
  });
}

test("real SQLite service, owner console, scoped clients, CLI, MCP, and TLS sharing", async (t) => {
  await start();
  t.after(async () => {
    await service.close();
    rmSync(root, { recursive: true, force: true });
  });
  await t.test(
    "starts empty with zero simulated data and private database files",
    async () => {
      const { value, status } = await owner("/state");
      assert.equal(status, 200);
      assert.deepEqual(value.memories, []);
      assert.deepEqual(value.events, []);
      assert.deepEqual(value.credentials, []);
      assert.equal(value.lan.enabled, false);
      if (process.platform !== "win32") {
        assert.equal(statSync(root).mode & 0o777, 0o700);
        assert.equal(statSync(join(root, "memory.sqlite")).mode & 0o777, 0o600);
      }
    },
  );
  await t.test(
    "owner endpoints reject anonymous, CSRF, and foreign origins",
    async () => {
      assert.equal((await fetch(`${base}/api/state`)).status, 401);
      assert.equal(
        (
          await owner("/memories", fact(), "POST", {
            "X-CSRF-Token": "invalid",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await owner("/state", undefined, "GET", {
            Origin: "https://untrusted.example",
          })
        ).status,
        403,
      );
      const hostStatus = await new Promise((resolve, reject) => {
        http
          .get(
            `${base}/api/session`,
            { headers: { Host: "evil.example" } },
            (res) => {
              res.resume();
              resolve(res.statusCode);
            },
          )
          .on("error", reject);
      });
      assert.equal(hostStatus, 403);
      assert.equal((await fetch(`${base}/v1/status`)).status, 401);
    },
  );
  await t.test(
    "creates a fact and immutable revision; stale edits fail without modifying it",
    async () => {
      const created = await owner("/memories", fact());
      assert.equal(created.status, 201);
      memory = created.value;
      const updated = await owner(
        `/memories/${memory.id}`,
        { revision: 1, title: "英文提交规范" },
        "PATCH",
      );
      assert.equal(updated.status, 200);
      memory = updated.value;
      assert.equal(memory.revision, 2);
      assert.equal(
        (
          await owner(
            `/memories/${memory.id}`,
            { revision: 1, body: "stale body" },
            "PATCH",
          )
        ).status,
        409,
      );
      const history = (await owner(`/memories/${memory.id}/history`)).value;
      assert.equal(history.length, 2);
      assert.equal(history[1].title, "提交规范");
      assert.equal(history[0].body, fact().body);
    },
  );
  await t.test(
    "issues independently scoped credentials and enforces read-only/project/CI restrictions",
    async () => {
      reader = (
        await owner("/credentials", {
          name: "Cursor",
          permission: "read",
          project: "KODER",
        })
      ).value;
      writer = (
        await owner("/credentials", {
          name: "Koder CLI",
          permission: "readwrite",
          project: "KODER",
        })
      ).value;
      assert.equal(
        (
          await owner("/credentials", {
            name: "Invalid CI",
            permission: "readwrite",
            project: "*",
            kind: "ci",
          })
        ).status,
        400,
      );
      ci = (
        await owner("/credentials", {
          name: "Build CI",
          permission: "read",
          project: "KODER",
          kind: "ci",
        })
      ).value;
      assert.equal(
        (
          await owner("/credentials", {
            name: "Fake device",
            project: "*",
            permission: "read",
            kind: "device",
          })
        ).status,
        400,
      );
      await assert.rejects(
        client(reader.token, "propose", fact()),
        /READ_ONLY/,
      );
      await assert.rejects(
        client(writer.token, "propose", fact({ project: "PRIVATE" })),
        /PROJECT_DENIED/,
      );
      await assert.rejects(
        client(reader.token, "search", { query: "英文", project: "PRIVATE" }),
        /PROJECT_DENIED/,
      );
      const state = (await owner("/state")).value;
      assert.equal(JSON.stringify(state).includes(reader.token), false);
      assert.equal(JSON.stringify(state).includes("token_hash"), false);
    },
  );
  await t.test(
    "independent client retrieves the approved ID and cannot retrieve other projects",
    async () => {
      await owner(
        "/memories",
        fact({
          title: "私人项目",
          body: "私人项目也需要英文提交规范。",
          project: "PRIVATE",
        }),
      );
      const hits = await client(reader.token, "search", {
        query: "英文提交规范",
      });
      assert.equal(hits.hits[0].id, memory.id);
      assert.equal(hits.hits.length, 1);
      assert.ok(hits.context.includes(memory.id));
    },
  );
  let candidate;
  await t.test(
    "tool proposals are durable review candidates and repeated keys do not duplicate writes",
    async () => {
      const input = fact({
        title: "代码风格",
        body: "KODER 项目必须使用 TypeScript strict 模式。",
      });
      candidate = await client(
        writer.token,
        "propose",
        input,
        "propose-test-0001",
      );
      assert.equal(candidate.status, "pending");
      assert.equal(
        (await client(writer.token, "propose", input, "propose-test-0001")).id,
        candidate.id,
      );
      await assert.rejects(
        client(
          writer.token,
          "propose",
          { ...input, body: "Different request" },
          "propose-test-0001",
        ),
        /幂等键/,
      );
      assert.equal(
        (await client(reader.token, "search", { query: "strict" })).hits.length,
        0,
      );
      assert.equal((await owner("/state")).value.candidates.length, 1);
    },
  );
  await t.test(
    "reviewed candidate becomes visible; repeated review conflicts",
    async () => {
      const review = await owner(`/candidates/${candidate.id}`, {
        revision: 1,
        decision: "append",
        fact: {
          ...candidate,
          body: "KODER 项目必须开启 TypeScript strict 编译选项。",
        },
      });
      assert.equal(review.status, 201);
      assert.ok(review.value.memory.id);
      assert.equal(
        (await client(reader.token, "search", { query: "strict" })).hits[0].id,
        review.value.memory.id,
      );
      assert.equal(
        (
          await owner(`/candidates/${candidate.id}`, {
            revision: 1,
            decision: "reject",
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "extraction persists explicit sentence evidence and removes duplicates",
    async () => {
      const text =
        "界面必须使用清晰的中文标签。\n我们今天开会。\n项目代码应该采用严格类型检查。";
      const extracted = await client(writer.token, "extract", {
        text,
        project: "KODER",
        scope: "全设备",
      });
      assert.equal(extracted.candidates.length, 2);
      assert.ok(
        extracted.candidates[0].provenance.includes(
          "界面必须使用清晰的中文标签",
        ),
      );
      const repeated = await client(writer.token, "extract", {
        text,
        project: "KODER",
        scope: "全设备",
      });
      assert.equal(repeated.candidates.length, 0);
      assert.equal(repeated.duplicates, 2);
    },
  );
  await t.test(
    "superseding a fact archives the prior revision and retains a traceable relationship",
    async () => {
      const candidate = await client(
        writer.token,
        "propose",
        fact({ body: "项目提交信息必须使用英文，标题简洁且包含验证方式。" }),
      );
      const stale = await owner(`/candidates/${candidate.id}`, {
        revision: 1,
        decision: "supersede",
        supersedes: memory.id,
        targetRevision: 1,
      });
      assert.equal(stale.status, 409);
      const reviewed = await owner(`/candidates/${candidate.id}`, {
        revision: 1,
        decision: "supersede",
        supersedes: memory.id,
        targetRevision: 2,
      });
      assert.equal(reviewed.value.memory.supersedes, memory.id);
      assert.equal(
        (await owner(`/memories/${memory.id}/history`)).value[0].status,
        "archived",
      );
      assert.equal(
        (await client(reader.token, "search", { query: "提交" })).hits.some(
          (m) => m.id === memory.id,
        ),
        false,
      );
      memory = reviewed.value.memory;
    },
  );
  await t.test(
    "archive, restore, favorite and source updates remain durable",
    async () => {
      memory = (
        await owner(
          `/memories/${memory.id}`,
          { revision: memory.revision, favorite: true, status: "archived" },
          "PATCH",
        )
      ).value;
      assert.equal(
        (await client(reader.token, "search", { query: "提交" })).hits.length,
        0,
      );
      memory = (
        await owner(
          `/memories/${memory.id}`,
          { revision: memory.revision, status: "active" },
          "PATCH",
        )
      ).value;
      assert.equal(memory.favorite, true);
    },
  );
  await t.test(
    "invalid import is rejected before any changes; valid restore uses new IDs and deduplicates",
    async () => {
      const before = (await owner("/state")).value.memories.length;
      const input = {
        schema: "karmen-memory",
        version: 1,
        memories: [
          fact({
            title: "Backup test",
            body: "A new backup fact with source evidence.",
          }),
          fact({ title: "" }),
        ],
      };
      assert.equal((await owner("/import", input)).status, 400);
      assert.equal((await owner("/state")).value.memories.length, before);
      input.memories.pop();
      const imported = (await owner("/import", input)).value;
      assert.equal(imported.imported.length, 1);
      assert.equal((await owner("/import", input)).value.duplicates, 1);
      const exported = (await owner("/export")).value;
      assert.equal(exported.schema, "karmen-memory");
      assert.ok(exported.memories.some((m) => m.favorite));
      const destination = await createService({
        dataDir: join(root, "restore"),
        port: 0,
      });
      try {
        assert.equal(
          destination.store.import(exported).imported.length,
          exported.memories.length,
        );
        assert.notEqual(
          destination.store.all("facts")[0].id,
          exported.memories[0].id,
        );
      } finally {
        await destination.close();
      }
    },
  );
  await t.test(
    "feedback is scoped and invalid evaluation figures are rejected",
    async () => {
      assert.equal(
        (
          await client(reader.token, "feedback", {
            memoryId: memory.id,
            useful: true,
          })
        ).recorded,
        true,
      );
      const privateFact = (await owner("/state")).value.memories.find(
        (m) => m.project === "PRIVATE",
      );
      await assert.rejects(
        client(reader.token, "feedback", {
          memoryId: privateFact.id,
          useful: true,
        }),
        /NOT_FOUND/,
      );
      assert.equal(
        (
          await owner("/evaluations", {
            task: "x",
            model: "x",
            evidence: "x",
            baseline: -1,
            context: 1,
            extraction: 0,
            indexing: 0,
            retrieval: 0,
          })
        ).status,
        400,
      );
      const e = await owner("/evaluations", {
        task: "Fixed task",
        model: "Fixed model",
        evidence: "Synthetic accounting test, not model benchmark",
        baseline: 1000,
        context: 700,
        extraction: 100,
        indexing: 10,
        retrieval: 10,
      });
      assert.equal(e.value.total, 820);
      assert.equal(e.value.source, "user-recorded");
    },
  );
  await t.test(
    "CI policy applies to existing credentials and paused/revoked credentials stop immediately",
    async () => {
      await owner("/settings", { ci: false }, "PATCH");
      await assert.rejects(client(ci.token, "status"), /CI_DISABLED/);
      await owner("/settings", { ci: true }, "PATCH");
      assert.equal((await client(ci.token, "status")).permission, "read");
      await owner(
        `/credentials/${reader.credential.id}`,
        { status: "paused" },
        "PATCH",
      );
      await assert.rejects(client(reader.token, "status"), /ACCESS_REVOKED/);
      await owner(
        `/credentials/${reader.credential.id}`,
        { status: "active" },
        "PATCH",
      );
      assert.equal((await client(reader.token, "status")).name, "Cursor");
      await owner(
        `/credentials/${ci.credential.id}`,
        { status: "revoked" },
        "PATCH",
      );
      await assert.rejects(client(ci.token, "status"), /ACCESS_REVOKED/);
      assert.equal(
        (
          await owner(
            `/credentials/${ci.credential.id}`,
            { status: "active" },
            "PATCH",
          )
        ).status,
        409,
      );
    },
  );
  await t.test(
    "real CLI gets the same ID and exits nonzero on unauthorized write",
    async () => {
      const result = await run(
        ["bin/memory.mjs", "search", "提交", "--project", "KODER"],
        { KARMEN_MEMORY_TOKEN: reader.token },
      );
      assert.equal(result.code, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).hits[0].id, memory.id);
      const denied = await run(
        [
          "bin/memory.mjs",
          "propose",
          "--title",
          "CLI failure",
          "--body",
          "This write must be denied.",
          "--project",
          "KODER",
        ],
        { KARMEN_MEMORY_TOKEN: reader.token },
      );
      assert.equal(denied.code, 1);
      assert.match(denied.stderr, /READ_ONLY/);
    },
  );
  await t.test(
    "MCP stdio initializes, lists tools, searches same database, and reports tool errors",
    async () => {
      const messages = [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2025-06-18" },
        },
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "memory_search", arguments: { query: "提交" } },
        },
        {
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "memory_propose",
            arguments: fact({ body: "Must fail read-only." }),
          },
        },
      ];
      const result = await run(
        ["bin/mcp.mjs"],
        { KARMEN_MEMORY_TOKEN: reader.token },
        messages.map((m) => JSON.stringify(m)).join("\n") + "\n",
      );
      assert.equal(result.code, 0, result.stderr);
      const output = result.stdout.trim().split("\n").map(JSON.parse);
      assert.equal(output.length, 4);
      assert.equal(output[0].result.serverInfo.name, "karmen-memory");
      assert.equal(output[1].result.tools.length, 4);
      assert.equal(
        JSON.parse(output[2].result.content[0].text).hits[0].id,
        memory.id,
      );
      assert.equal(output[3].result.isError, true);
    },
  );
  await t.test(
    "HTTPS listener creates a verifiable certificate and requires pairing",
    async () => {
      const enabled = await owner("/lan", { enabled: true });
      assert.equal(enabled.status, 201, JSON.stringify(enabled.value));
      assert.equal(enabled.value.enabled, true);
      ca = join(root, "lan-cert.pem");
      assert.ok(existsSync(ca));
      const url = `https://127.0.0.1:${service.lanInfo().port}`;
      await assert.rejects(
        request({ url, ca, token: reader.token }, "/v1/status"),
        /DEVICE_REQUIRED/,
      );
      await assert.rejects(request({ url, ca }, "/api/state"), /接口不存在/);
      const code = (
        await owner("/pairing", { permission: "read", project: "KODER" })
      ).value.code;
      await assert.rejects(
        request({ url, ca }, "/v1/pair", {
          code: "000000000",
          name: "Rejected device",
        }),
        /PAIRING_DENIED/,
      );
      device = await request({ url, ca }, "/v1/pair", {
        code,
        name: "Independent TLS client",
      });
      await assert.rejects(
        request({ url, ca }, "/v1/pair", { code, name: "Replay" }),
        /PAIRING_DENIED/,
      );
      assert.equal(
        (await request({ url, ca, token: device.token }, "/v1/status")).project,
        "KODER",
      );
    },
  );
  await t.test(
    "TLS device cannot see local-only facts, other projects, or owner APIs; code locks after five attempts",
    async () => {
      await owner(
        "/memories",
        fact({
          title: "本机英文私密要求",
          body: "本机私密英文提交要求，不能共享到其他设备。",
          scope: "仅本机",
        }),
      );
      const url = `https://127.0.0.1:${service.lanInfo().port}`;
      const found = await request(
        { url, ca, token: device.token },
        "/v1/search",
        { query: "英文" },
      );
      assert.equal(
        found.hits.some((m) => m.scope === "仅本机"),
        false,
      );
      assert.equal(
        (await client(device.token, "search", { query: "本机私密" })).hits
          .length,
        0,
      );
      const code = (
        await owner("/pairing", { permission: "read", project: "KODER" })
      ).value.code;
      for (let i = 0; i < 5; i++)
        await assert.rejects(
          request({ url, ca }, "/v1/pair", { code: "wrong", name: "Wrong" }),
          /PAIRING_DENIED/,
        );
      await assert.rejects(
        request({ url, ca }, "/v1/pair", { code, name: "Locked" }),
        /PAIRING_DENIED/,
      );
      await owner(
        `/credentials/${device.credential.id}`,
        { status: "revoked" },
        "PATCH",
      );
      await assert.rejects(
        request({ url, ca, token: device.token }, "/v1/status"),
        /ACCESS_REVOKED/,
      );
      await owner("/lan", { enabled: false });
      assert.equal(service.lanInfo().enabled, false);
      await assert.rejects(
        request({ url, ca, token: device.token }, "/v1/status"),
        /ECONNREFUSED|socket|connect/i,
      );
    },
  );
  await t.test(
    "pairing expires, and real pairing CLI saves a private profile without overwriting it",
    async () => {
      await owner("/lan", { enabled: true });
      const url = `https://127.0.0.1:${service.lanInfo().port}`;
      const expired = (
        await owner("/pairing", { permission: "read", project: "KODER" })
      ).value.code;
      t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
      t.mock.timers.tick(300001);
      try {
        await assert.rejects(
          request({ url, ca }, "/v1/pair", { code: expired, name: "Expired" }),
          /PAIRING_DENIED/,
        );
      } finally {
        t.mock.timers.reset();
      }
      const code = (
        await owner("/pairing", { permission: "read", project: "KODER" })
      ).value.code;
      const profile = join(root, "paired-client.json");
      const paired = await run([
        "bin/memory.mjs",
        "pair",
        "--url",
        url,
        "--ca",
        ca,
        "--code",
        code,
        "--name",
        "CLI TLS fixture",
        "--profile",
        profile,
      ]);
      assert.equal(paired.code, 0, paired.stderr);
      assert.equal(JSON.parse(paired.stdout).paired, true);
      assert.equal(statSync(profile).mode & 0o777, 0o600);
      const saved = readFileSync(profile, "utf8");
      assert.equal(paired.stdout.includes(JSON.parse(saved).token), false);
      const status = await run(
        ["bin/memory.mjs", "status", "--profile", profile],
        { KARMEN_MEMORY_URL: url },
      );
      assert.equal(status.code, 0, status.stderr);
      assert.equal(JSON.parse(status.stdout).name, "CLI TLS fixture");
      const replay = await run([
        "bin/memory.mjs",
        "pair",
        "--url",
        url,
        "--ca",
        ca,
        "--code",
        code,
        "--name",
        "Overwrite fixture",
        "--profile",
        profile,
      ]);
      assert.equal(replay.code, 1);
      assert.match(replay.stderr, /already exists/);
      assert.equal(readFileSync(profile, "utf8"), saved);
      await owner("/lan", { enabled: false });
    },
  );
  await t.test(
    "SQLite snapshot is a readable consistent database with history and audit",
    async () => {
      const snapshot = await owner("/backup", {});
      assert.equal(snapshot.status, 200);
      assert.ok(Buffer.isBuffer(snapshot.value));
      const path = join(root, "snapshot.sqlite");
      writeFileSync(path, snapshot.value, { mode: 0o600 });
      const db = new DatabaseSync(path, { readOnly: true });
      try {
        assert.equal(
          db.prepare("PRAGMA integrity_check").get().integrity_check,
          "ok",
        );
        assert.ok(
          db.prepare("SELECT count(*) AS n FROM revisions").get().n > 1,
        );
        assert.ok(db.prepare("SELECT count(*) AS n FROM events").get().n > 10);
      } finally {
        db.close();
      }
    },
  );
  await t.test(
    "service restart preserves facts, revisions, credentials, settings, candidates and audit",
    async () => {
      const before = (await owner("/state")).value;
      await service.close();
      await start();
      const after = (await owner("/state")).value;
      assert.deepEqual(after.memories, before.memories);
      assert.deepEqual(after.candidates, before.candidates);
      assert.deepEqual(after.settings, before.settings);
      assert.equal(after.stats.eventCount, before.stats.eventCount);
      assert.equal(after.service.instance, before.service.instance);
      assert.equal(
        (await owner(`/memories/${memory.id}/history`)).value.length,
        3,
      );
      assert.equal((await client(reader.token, "status")).name, "Cursor");
      assert.ok(after.events.some((e) => e.status === "拒绝"));
      assert.ok(
        after.credentials.find((c) => c.id === reader.credential.id).lastSeen,
      );
    },
  );
});
