import { DatabaseSync } from "node:sqlite";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdirSync, chmodSync, statSync } from "node:fs";
import { dirname } from "node:path";

export class Fault extends Error {
  constructor(status, message, code = "INVALID_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const fail = (status, message, code) => {
  throw new Fault(status, message, code);
};
export const TYPES = [
  "个人偏好",
  "项目需求",
  "代码规范",
  "架构决策",
  "工作方式",
];
export const hash = (text) => createHash("sha256").update(text).digest("hex");
const now = () => new Date().toISOString();
const id = () => randomUUID();
function text(value, label, max, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail(400, `${label}不能为空，且最多 ${max} 字符`);
  return value.trim();
}
function choice(value, values, label, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!values.includes(value)) fail(400, `${label}无效`);
  return value;
}
const normalize = (v) => v.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
function terms(input) {
  const words =
    input.toLowerCase().match(/[a-z0-9_-]+|[\p{Script=Han}]+/gu) || [];
  return [
    ...new Set(
      words.flatMap((w) =>
        /\p{Script=Han}/u.test(w) && w.length > 1
          ? Array.from({ length: w.length - 1 }, (_, i) => w.slice(i, i + 2))
          : [w],
      ),
    ),
  ];
}
export function validateFact(value, previous = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(400, "记忆格式无效");
  const v = { ...previous, ...value };
  return {
    title: text(v.title, "标题", 120),
    body: text(v.body, "内容", 6000),
    type: choice(v.type, TYPES, "类型", "项目需求"),
    project: text(v.project, "项目", 80, "全部项目"),
    scope: choice(v.scope, ["仅本机", "全设备"], "范围", "仅本机"),
    provenance: text(v.provenance, "来源依据", 6000, "用户手动创建"),
    status: choice(v.status, ["active", "archived"], "状态", "active"),
    favorite: v.favorite === true,
  };
}

export class Store {
  constructor(path) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.path = path;
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS facts (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions (fact_id TEXT NOT NULL REFERENCES facts(id), revision INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(fact_id,revision));
      CREATE TABLE IF NOT EXISTS candidates (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS credentials (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS evaluations (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS operations (key TEXT PRIMARY KEY, response TEXT NOT NULL);
    `);
    const schema = this.getMeta("schema", 1);
    if (schema !== 1) fail(500, "数据库版本不受支持");
    this.setMeta("schema", 1);
    if (!this.getMeta("instance", null)) this.setMeta("instance", id());
  }
  close() {
    this.db.close();
  }
  getMeta(key, fallback) {
    const row = this.db.prepare("SELECT value FROM meta WHERE key=?").get(key);
    return row ? JSON.parse(row.value) : fallback;
  }
  setMeta(key, value) {
    this.db
      .prepare("INSERT OR REPLACE INTO meta VALUES (?,?)")
      .run(key, JSON.stringify(value));
    return value;
  }
  all(table) {
    return this.db
      .prepare(`SELECT data FROM ${table}`)
      .all()
      .map((r) => JSON.parse(r.data));
  }
  one(table, key) {
    const row = this.db
      .prepare(`SELECT data FROM ${table} WHERE id=?`)
      .get(key);
    if (!row) fail(404, "记录不存在", "NOT_FOUND");
    return JSON.parse(row.data);
  }
  put(table, row) {
    if (table === "credentials")
      this.db
        .prepare("UPDATE credentials SET data=? WHERE id=?")
        .run(JSON.stringify(row), row.id);
    else
      this.db
        .prepare(
          `INSERT INTO ${table}(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
        )
        .run(row.id, JSON.stringify(row));
    return row;
  }
  tx(fn) {
    if (this.inTransaction) return fn();
    this.db.exec("BEGIN IMMEDIATE");
    this.inTransaction = true;
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    } finally {
      this.inTransaction = false;
    }
  }
  event(actor, action, detail, extra = {}) {
    const row = {
      id: id(),
      time: now(),
      agent: actor.name || "控制台",
      credentialId: actor.id || null,
      action,
      detail,
      status: "成功",
      ...extra,
    };
    this.db
      .prepare("INSERT INTO events(data) VALUES (?)")
      .run(JSON.stringify(row));
    return row;
  }
  history(key) {
    this.one("facts", key);
    return this.db
      .prepare(
        "SELECT data FROM revisions WHERE fact_id=? ORDER BY revision DESC",
      )
      .all(key)
      .map((r) => JSON.parse(r.data));
  }
  createFact(value, actor = { name: "控制台" }, extra = {}) {
    const fields = validateFact(value);
    const row = {
      ...fields,
      id: id(),
      source: actor.name,
      created: now(),
      updated: now(),
      revision: 1,
      uses: 0,
      ...extra,
    };
    this.put("facts", row);
    this.db
      .prepare("INSERT INTO revisions VALUES (?,?,?)")
      .run(row.id, row.revision, JSON.stringify(row));
    this.event(actor, "创建记忆", row.title, { memoryId: row.id });
    return row;
  }
  create(value, actor) {
    return this.tx(() => this.createFact(value, actor));
  }
  update(key, value, actor = { name: "控制台" }) {
    return this.tx(() => {
      const old = this.one("facts", key);
      if (value.revision !== old.revision)
        fail(409, "记忆已被其他窗口更新，请刷新后重试", "REVISION_CONFLICT");
      const row = {
        ...old,
        ...validateFact(value, old),
        revision: old.revision + 1,
        updated: now(),
      };
      this.put("facts", row);
      this.db
        .prepare("INSERT INTO revisions VALUES (?,?,?)")
        .run(key, row.revision, JSON.stringify(row));
      this.event(actor, "更新记忆", row.title, {
        memoryId: key,
        revision: row.revision,
      });
      return row;
    });
  }
  visible(fact, actor, project) {
    if (fact.status !== "active") return false;
    if (actor.remote && fact.scope !== "全设备") return false;
    if (
      actor.project &&
      actor.project !== "*" &&
      fact.project !== actor.project
    )
      return false;
    return (
      !project ||
      project === "全部项目" ||
      fact.project === project ||
      (actor.project === "*" && fact.project === "全部项目")
    );
  }
  search(input, actor = { name: "控制台", project: "*" }) {
    const started = performance.now();
    const query = text(input.query, "检索问题", 500);
    const project = text(
      input.project,
      "项目",
      80,
      actor.project === "*" ? "全部项目" : actor.project,
    );
    if (actor.project !== "*" && project !== actor.project)
      fail(403, "凭证只能访问获准项目", "PROJECT_DENIED");
    const keys = terms(query);
    const hits = this.all("facts")
      .filter((m) => this.visible(m, actor, project))
      .map((m) => {
        const title = m.title.toLowerCase(),
          body = m.body.toLowerCase();
        const matched = keys.filter(
          (k) => title.includes(k) || body.includes(k),
        );
        return {
          ...m,
          score: matched.reduce((s, k) => s + (title.includes(k) ? 3 : 1), 0),
          matched,
        };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score || b.updated.localeCompare(a.updated))
      .slice(0, 8);
    const duration = Math.round((performance.now() - started) * 100) / 100;
    this.tx(() => {
      for (const hit of hits) {
        const m = this.one("facts", hit.id);
        this.put("facts", { ...m, uses: m.uses + 1 });
      }
      this.event(actor, "检索记忆", `命中 ${hits.length} 条 · ${project}`, {
        duration,
        hits: hits.length,
        memoryIds: hits.map((m) => m.id),
        project,
      });
    });
    return {
      query,
      project,
      hits,
      duration,
      method: "multilingual-lexical-v1",
      context: hits
        .map(
          (m) =>
            `[${m.id} r${m.revision} | ${m.project} | ${m.source}] ${m.title}\n${m.body}`,
        )
        .join("\n\n"),
    };
  }
  assertWrite(actor, project) {
    if (actor.permission !== "readwrite")
      fail(403, "当前凭证为只读", "READ_ONLY");
    if (actor.project !== "*" && actor.project !== project)
      fail(403, "凭证只能写入获准项目", "PROJECT_DENIED");
  }
  candidate(value, actor) {
    const fields = validateFact(value);
    this.assertWrite(actor, fields.project);
    if (actor.remote && fields.scope !== "全设备")
      fail(403, "局域网客户端只能提交可共享记忆");
    const existing = [
      ...this.all("facts").filter((m) =>
        this.visible(m, actor, fields.project),
      ),
      ...this.all("candidates").filter(
        (c) =>
          c.status === "pending" &&
          (!actor.remote || c.scope === "全设备") &&
          (actor.project === "*" || c.project === actor.project),
      ),
    ];
    const duplicate = existing.find(
      (m) =>
        m.project === fields.project &&
        normalize(m.body) === normalize(fields.body),
    );
    if (duplicate) return { duplicate: duplicate.id };
    const keys = terms(fields.title + fields.body);
    const related = this.all("facts")
      .filter(
        (m) =>
          m.status === "active" &&
          this.visible(m, actor, fields.project) &&
          m.project === fields.project,
      )
      .filter((m) => {
        const other = terms(m.title + m.body),
          overlap = keys.filter((t) => other.includes(t)).length;
        return (
          normalize(m.title) === normalize(fields.title) ||
          overlap / Math.max(1, Math.min(keys.length, other.length)) >= 0.5
        );
      })
      .map((m) => ({
        id: m.id,
        title: m.title,
        body: m.body,
        revision: m.revision,
      }));
    const row = {
      ...fields,
      id: id(),
      status: "pending",
      source: actor.name,
      sourceId: actor.id || null,
      created: now(),
      revision: 1,
      related,
    };
    this.put("candidates", row);
    this.event(actor, "提议记忆", row.title, { candidateId: row.id });
    return row;
  }
  propose(value, actor) {
    return this.tx(() => this.candidate(value, actor));
  }
  extract(input, actor) {
    const source = text(input.text, "上下文", 20000);
    const project = text(
      input.project,
      "项目",
      80,
      actor.project === "*" ? "全部项目" : actor.project,
    );
    this.assertWrite(actor, project);
    const sentences = source
      .split(/\n+|(?<=[。！？.!?])\s*/u)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8);
    const explicit = sentences.filter((s) =>
      /偏好|喜欢|要求|必须|需要|使用|采用|禁止|不要|应该|决定|约定|prefer|must|should|require|always|never|use /i.test(
        s,
      ),
    );
    return this.tx(() => {
      const rows = explicit
        .slice(0, 20)
        .map((s) =>
          this.candidate(
            {
              title: s.slice(0, 100),
              body: s,
              project,
              scope: input.scope || "仅本机",
              provenance: `规则提炼，逐句原文：${s}`,
              type: /偏好|喜欢|prefer/i.test(s)
                ? "个人偏好"
                : /代码|提交|commit|lint|typescript/i.test(s)
                  ? "代码规范"
                  : /决定|采用|架构|decid/i.test(s)
                    ? "架构决策"
                    : "项目需求",
            },
            actor,
          ),
        );
      this.event(
        actor,
        "规则提炼",
        `识别 ${rows.length} 句，去重 ${rows.filter((r) => r.duplicate).length} 条`,
        { method: "explicit-sentence-v1" },
      );
      return {
        candidates: rows.filter((r) => !r.duplicate),
        duplicates: rows.filter((r) => r.duplicate).length,
        method: "explicit-sentence-v1",
        truncated: explicit.length > 20,
      };
    });
  }
  review(key, input) {
    return this.tx(() => {
      const c = this.one("candidates", key);
      if (c.status !== "pending" || c.revision !== input.revision)
        fail(409, "候选已处理或已更新，请刷新", "REVISION_CONFLICT");
      let fact;
      if (input.decision !== "reject") {
        choice(input.decision, ["append", "supersede"], "处理方式");
        const fields = validateFact({ ...c, ...input.fact, status: "active" });
        let old;
        if (input.decision === "supersede") {
          old = this.one("facts", text(input.supersedes, "替换目标", 80));
          if (
            old.project !== fields.project ||
            old.revision !== input.targetRevision ||
            old.status !== "active"
          )
            fail(409, "被替换记忆的项目、版本或状态已变化");
          const archived = {
            ...old,
            status: "archived",
            revision: old.revision + 1,
            updated: now(),
          };
          this.put("facts", archived);
          this.db
            .prepare("INSERT INTO revisions VALUES (?,?,?)")
            .run(old.id, archived.revision, JSON.stringify(archived));
        }
        fact = this.createFact(
          fields,
          { name: c.source },
          {
            approvedBy: "控制台",
            candidateId: c.id,
            ...(old ? { supersedes: old.id } : {}),
          },
        );
      }
      this.put("candidates", {
        ...c,
        status: fact ? "approved" : "rejected",
        revision: c.revision + 1,
        reviewedAt: now(),
        memoryId: fact?.id,
      });
      this.event({ name: "控制台" }, fact ? "审核入库" : "排除候选", c.title, {
        candidateId: c.id,
        memoryId: fact?.id,
      });
      return { candidateId: c.id, memory: fact || null };
    });
  }
  issue(input) {
    const kind = choice(
      input.kind,
      ["agent", "ci", "device"],
      "客户端类型",
      "agent",
    );
    const project = text(input.project, "项目", 80, "*");
    const permission = choice(
      input.permission,
      ["read", "readwrite"],
      "权限",
      "read",
    );
    if (
      kind === "ci" &&
      (project === "*" || project === "全部项目" || permission !== "read")
    )
      fail(400, "CI 必须限定具体项目，并使用只读权限");
    const token = `km_${randomBytes(32).toString("base64url")}`;
    const row = {
      id: id(),
      name: text(input.name, "名称", 80),
      kind,
      project,
      permission,
      status: "active",
      created: now(),
      lastSeen: null,
      calls: 0,
    };
    this.db
      .prepare("INSERT INTO credentials VALUES (?,?,?)")
      .run(row.id, hash(token), JSON.stringify(row));
    this.event(
      { name: "控制台" },
      "签发凭证",
      `${row.name} · ${project} · ${permission}`,
      { clientId: row.id },
    );
    return { credential: row, token };
  }
  changeCredential(key, input) {
    return this.tx(() => {
      const row = this.one("credentials", key);
      if (row.status === "revoked")
        fail(409, "已撤销凭证不能恢复，请签发新凭证");
      const status = choice(
        input.status,
        ["active", "paused", "revoked"],
        "凭证状态",
      );
      this.put("credentials", { ...row, status });
      this.event({ name: "控制台" }, "变更凭证", `${row.name} · ${status}`, {
        clientId: key,
      });
      return { ...row, status };
    });
  }
  authenticate(token, remote) {
    const found =
      typeof token === "string" &&
      this.db
        .prepare("SELECT data FROM credentials WHERE token_hash=?")
        .get(hash(token));
    if (!found) fail(401, "需要有效访问凭证", "UNAUTHORIZED");
    const row = JSON.parse(found.data);
    if (row.status !== "active")
      fail(403, "凭证已暂停或撤销", "ACCESS_REVOKED");
    if (remote && row.kind !== "device")
      fail(403, "局域网请求需要配对设备凭证", "DEVICE_REQUIRED");
    if (row.kind === "ci" && !this.getMeta("settings", { ci: true }).ci)
      fail(403, "CI 访问已关闭", "CI_DISABLED");
    this.put("credentials", { ...row, lastSeen: now(), calls: row.calls + 1 });
    return { ...row, remote: remote || row.kind === "device" };
  }
  feedback(input, actor) {
    const m = this.one("facts", text(input.memoryId, "记忆编号", 80));
    if (!this.visible(m, actor)) fail(404, "记录不存在", "NOT_FOUND");
    const useful = choice(input.useful, [true, false], "反馈");
    this.event(
      actor,
      "记忆反馈",
      `${m.title} · ${useful ? "有帮助" : "待改进"}`,
      { memoryId: m.id, useful },
    );
    return { recorded: true, memoryId: m.id };
  }
  export() {
    return {
      schema: "karmen-memory",
      version: 1,
      exportedAt: now(),
      memories: this.all("facts"),
    };
  }
  import(input) {
    if (
      !input ||
      !["karmen-memory", "karmen-memory-console-demo"].includes(input.schema) ||
      input.version !== 1 ||
      !Array.isArray(input.memories) ||
      input.memories.length > 5000
    )
      fail(400, "请选择有效的 KARMEN Memory JSON（最多 5000 条）");
    const values = input.memories.map((m) => validateFact(m));
    return this.tx(() => {
      const imported = [],
        duplicates = [];
      const existing = this.all("facts");
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (
          existing.some(
            (m) =>
              m.project === value.project &&
              normalize(m.body) === normalize(value.body),
          )
        ) {
          duplicates.push(i);
          continue;
        }
        const fact = this.createFact(
          value,
          { name: "JSON 导入" },
          {
            importedFrom: input.schema,
            ...(typeof input.memories[i].source === "string"
              ? { originalSource: input.memories[i].source.slice(0, 80) }
              : {}),
          },
        );
        existing.push(fact);
        imported.push(fact.id);
      }
      this.event(
        { name: "控制台" },
        "导入记忆",
        `${imported.length} 条，重复 ${duplicates.length} 条`,
      );
      return { imported, duplicates: duplicates.length };
    });
  }
  evaluate(input) {
    const row = {
      id: id(),
      task: text(input.task, "任务", 120),
      model: text(input.model, "模型与配置", 160),
      evidence: text(input.evidence, "结果依据", 2000),
      created: now(),
      source: "user-recorded",
    };
    for (const key of [
      "baseline",
      "context",
      "extraction",
      "indexing",
      "retrieval",
    ]) {
      if (
        !Number.isSafeInteger(input[key]) ||
        input[key] < 0 ||
        input[key] > 1e9
      )
        fail(400, "Token 数必须是 0 到 10 亿之间的整数");
      row[key] = input[key];
    }
    if (row.baseline <= 0) fail(400, "无记忆基线必须大于 0");
    row.total = row.context + row.extraction + row.indexing + row.retrieval;
    return this.tx(() => {
      this.put("evaluations", row);
      this.event({ name: "控制台" }, "记录评估", row.task);
      return row;
    });
  }
  state() {
    const facts = this.all("facts").sort((a, b) =>
      b.updated.localeCompare(a.updated),
    );
    const events = this.db
      .prepare("SELECT data FROM events ORDER BY seq DESC LIMIT 300")
      .all()
      .map((r) => JSON.parse(r.data));
    const searches = this.db
      .prepare(
        "SELECT data FROM events WHERE json_extract(data,'$.action')='检索记忆'",
      )
      .all()
      .map((r) => JSON.parse(r.data));
    const credentials = this.all("credentials").sort((a, b) =>
      a.created.localeCompare(b.created),
    );
    const size =
      this.path === ":memory:"
        ? 0
        : [this.path, `${this.path}-wal`].reduce((sum, p) => {
            try {
              return sum + statSync(p).size;
            } catch {
              return sum;
            }
          }, 0);
    return {
      memories: facts,
      candidates: this.all("candidates"),
      credentials,
      events,
      evaluations: this.all("evaluations"),
      settings: this.getMeta("settings", { ci: true }),
      stats: {
        queries: searches.length,
        hits: searches.filter((s) => s.hits > 0).length,
        averageMs: searches.length
          ? searches.reduce((s, v) => s + v.duration, 0) / searches.length
          : 0,
        eventCount: this.db.prepare("SELECT count(*) AS n FROM events").get().n,
        size,
      },
      service: {
        instance: this.getMeta("instance"),
        database: this.path,
        storage: "SQLite",
        schema: 1,
      },
    };
  }
}
