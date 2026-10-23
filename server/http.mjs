import http from "node:http";
import https from "node:https";
import { randomBytes, timingSafeEqual, X509Certificate } from "node:crypto";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  chmodSync,
  statSync,
  createReadStream,
} from "node:fs";
import { resolve, join, extname, dirname } from "node:path";
import { networkInterfaces, hostname, homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { backup } from "node:sqlite";
import { Store, fail, hash } from "./store.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OWNER = { name: "控制台", permission: "readwrite", project: "*" };
const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const localAddress = (value) =>
  ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(value);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export async function createService(options = {}) {
  const dataDir = resolve(
    options.dataDir ||
      process.env.KARMEN_MEMORY_HOME ||
      join(homedir(), ".karmen-memory"),
  );
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  chmodSync(dataDir, 0o700);
  const store = new Store(join(dataDir, "memory.sqlite"));
  const sessions = new Map(),
    rates = new Map();
  const devPort = options.devPort || process.env.KARMEN_MEMORY_DEV_PORT;
  const lanPort =
    options.lanPort ?? Number(process.env.KARMEN_MEMORY_LAN_PORT || 4319);
  let lan = null,
    pairing = null,
    lanError = null;
  let port;
  function rate(key, limit, windowMs = 60000) {
    const old = rates.get(key),
      current =
        old && old.expires > Date.now()
          ? old
          : { n: 0, expires: Date.now() + windowMs };
    rates.set(key, current);
    if (rates.size > 10000)
      for (const [k, v] of rates) if (v.expires <= Date.now()) rates.delete(k);
    if (++current.n > limit)
      fail(429, "请求过于频繁，请稍后再试", "RATE_LIMITED");
  }
  function send(res, status, body, headers = {}) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    });
    res.end(JSON.stringify(body));
  }
  function trusted(req) {
    const origins = new Set([
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
    ]);
    if (devPort) {
      origins.add(`http://127.0.0.1:${devPort}`);
      origins.add(`http://localhost:${devPort}`);
    }
    if (!localAddress(req.socket.remoteAddress))
      fail(403, "控制台仅允许本机访问");
    if (!origins.has(`http://${req.headers.host}`))
      fail(403, "Host 不受信任", "INVALID_HOST");
    if (req.headers.origin && !origins.has(req.headers.origin))
      fail(403, "Origin 不受信任", "INVALID_ORIGIN");
    if (req.headers["sec-fetch-site"] === "cross-site")
      fail(403, "拒绝跨站请求", "INVALID_ORIGIN");
  }
  function owner(req, bootstrap = false) {
    trusted(req);
    const cookie = req.headers.cookie?.match(/(?:^|; )km_session=([^;]+)/)?.[1];
    const existing = sessions.get(cookie);
    if (existing && existing.expires > Date.now()) {
      if (
        req.method !== "GET" &&
        !safeEqual(req.headers["x-csrf-token"], existing.csrf)
      )
        fail(403, "会话校验失败，请刷新页面", "CSRF");
      return { ...existing, cookie };
    }
    if (!bootstrap) fail(401, "控制台会话已过期，请刷新", "SESSION_EXPIRED");
    for (const [k, s] of sessions)
      if (s.expires < Date.now()) sessions.delete(k);
    if (sessions.size >= 100) fail(429, "本机会话过多，请稍后重试");
    const key = randomBytes(32).toString("base64url");
    const session = {
      csrf: randomBytes(32).toString("base64url"),
      expires: Date.now() + 86400000,
    };
    sessions.set(key, session);
    return { ...session, cookie: key };
  }
  async function body(req) {
    if (!req.headers["content-type"]?.startsWith("application/json"))
      fail(415, "需要 application/json");
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 2_000_000) fail(413, "请求超过 2 MB");
      chunks.push(chunk);
    }
    let input;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      fail(400, "JSON 格式无效");
    }
    if (!input || typeof input !== "object" || Array.isArray(input))
      fail(400, "请求需要 JSON 对象");
    return input;
  }
  function lanInfo() {
    const addresses = Object.values(networkInterfaces())
      .flat()
      .filter((a) => a?.family === "IPv4" && !a.internal)
      .map((a) => `https://${a.address}:${lan?.address()?.port || lanPort}`);
    const certPath = join(dataDir, "lan-cert.pem");
    return {
      enabled: !!lan,
      port: lan?.address()?.port || lanPort,
      addresses,
      fingerprint: existsSync(certPath)
        ? new X509Certificate(readFileSync(certPath)).fingerprint256
        : null,
      error: lanError,
      paired: store
        .all("credentials")
        .filter((c) => c.kind === "device" && c.status !== "revoked").length,
    };
  }
  async function toggleLan(enabled) {
    if (enabled && !lan) {
      const certPath = join(dataDir, "lan-cert.pem"),
        keyPath = join(dataDir, "lan-key.pem");
      if (!existsSync(certPath) || !existsSync(keyPath)) {
        const ips = [
          "127.0.0.1",
          ...Object.values(networkInterfaces())
            .flat()
            .filter((a) => a?.family === "IPv4" && !a.internal)
            .map((a) => a.address),
        ];
        try {
          execFileSync(
            "openssl",
            [
              "req",
              "-x509",
              "-newkey",
              "rsa:2048",
              "-sha256",
              "-nodes",
              "-days",
              "365",
              "-subj",
              "/CN=KARMEN Memory",
              "-addext",
              `subjectAltName=DNS:localhost,${[...new Set(ips)].map((ip) => `IP:${ip}`).join(",")}`,
              "-keyout",
              keyPath,
              "-out",
              certPath,
            ],
            { timeout: 20000, stdio: ["ignore", "ignore", "pipe"] },
          );
          chmodSync(keyPath, 0o600);
          chmodSync(certPath, 0o600);
        } catch {
          fail(
            503,
            "无法生成 TLS 证书，请安装支持 -addext 的 OpenSSL 后重试",
            "TLS_SETUP_FAILED",
          );
        }
      }
      if (
        Date.parse(new X509Certificate(readFileSync(certPath)).validTo) <
        Date.now()
      )
        fail(503, "局域网证书已过期，请在服务停止后更新证书", "TLS_EXPIRED");
      const candidate = https.createServer(
        {
          key: readFileSync(keyPath),
          cert: readFileSync(certPath),
          minVersion: "TLSv1.2",
        },
        (req, res) => handle(req, res, true),
      );
      try {
        await new Promise((resolve, reject) => {
          candidate.once("error", reject);
          candidate.listen(lanPort, options.lanHost || "0.0.0.0", resolve);
        });
        candidate.requestTimeout = 15000;
        candidate.headersTimeout = 10000;
        lan = candidate;
        lanError = null;
      } catch {
        fail(503, "局域网端口无法启动，请检查端口占用", "LAN_UNAVAILABLE");
      }
    } else if (!enabled && lan) {
      pairing = null;
      const closing = lan;
      lan = null;
      await new Promise((resolve) => {
        closing.close(resolve);
        closing.closeAllConnections();
      });
    }
    store.setMeta("lan", enabled);
    return lanInfo();
  }
  async function handle(req, res, remote = false) {
    const requestId = randomBytes(8).toString("hex");
    let actor;
    try {
      const path = new URL(req.url, "http://service.invalid").pathname;
      if (remote && !path.startsWith("/v1/")) fail(404, "接口不存在");
      if (req.method === "GET" && path === "/health" && !remote) {
        trusted(req);
        return send(res, 200, { status: "ok", version: "0.2.0" });
      }
      if (path.startsWith("/api/")) {
        if (remote) fail(403, "控制台仅允许本机访问");
        if (path === "/api/session" && req.method === "GET") {
          rate(`session:${req.socket.remoteAddress}`, 60);
          const s = owner(req, true);
          return send(
            res,
            200,
            { csrf: s.csrf },
            {
              "Set-Cookie": `km_session=${s.cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`,
            },
          );
        }
        owner(req);
        actor = OWNER;
        const input = req.method === "GET" ? null : await body(req);
        let result;
        if (path === "/api/state" && req.method === "GET") {
          const state = store.state();
          result = {
            ...state,
            lan: lanInfo(),
            service: {
              ...state.service,
              hostname: hostname(),
              platform: process.platform,
              version: "0.2.0",
              node: process.execPath,
              mcpPath: join(ROOT, "bin/mcp.mjs"),
              cliPath: join(ROOT, "bin/memory.mjs"),
              url: `http://127.0.0.1:${port}`,
            },
          };
        } else if (path === "/api/memories" && req.method === "POST")
          result = store.create(input, actor);
        else if (
          /^\/api\/memories\/[^/]+\/history$/.test(path) &&
          req.method === "GET"
        )
          result = store.history(path.split("/")[3]);
        else if (
          /^\/api\/memories\/[^/]+$/.test(path) &&
          req.method === "PATCH"
        )
          result = store.update(path.split("/")[3], input, actor);
        else if (
          /^\/api\/candidates\/[^/]+$/.test(path) &&
          req.method === "POST"
        )
          result = store.review(path.split("/")[3], input);
        else if (path === "/api/extract" && req.method === "POST")
          result = store.extract(input, actor);
        else if (path === "/api/search" && req.method === "POST")
          result = store.search(input, actor);
        else if (path === "/api/credentials" && req.method === "POST") {
          if (input.kind === "device")
            fail(400, "设备凭证需要通过局域网配对签发");
          result = store.tx(() => store.issue(input));
        } else if (
          /^\/api\/credentials\/[^/]+$/.test(path) &&
          req.method === "PATCH"
        )
          result = store.changeCredential(path.split("/")[3], input);
        else if (path === "/api/lan" && req.method === "POST") {
          if (typeof input.enabled !== "boolean")
            fail(400, "共享状态必须为布尔值");
          result = await toggleLan(input.enabled);
          store.event(
            actor,
            input.enabled ? "开启局域网" : "关闭局域网",
            "HTTPS 共享服务",
          );
        } else if (path === "/api/certificate" && req.method === "GET") {
          if (!existsSync(join(dataDir, "lan-cert.pem")))
            fail(404, "请先开启共享生成证书");
          res.writeHead(200, {
            "Content-Type": "application/x-pem-file",
            "Content-Disposition":
              'attachment; filename="karmen-memory-ca.pem"',
            "Cache-Control": "no-store",
          });
          return res.end(readFileSync(join(dataDir, "lan-cert.pem")));
        } else if (path === "/api/pairing" && req.method === "POST") {
          if (!lan) fail(409, "请先开启局域网共享");
          if (
            !["read", "readwrite"].includes(input.permission) ||
            typeof input.project !== "string" ||
            !input.project.trim() ||
            input.project.length > 80
          )
            fail(400, "请选择配对权限与项目");
          const code = String(
            randomBytes(4).readUInt32BE() % 100000000,
          ).padStart(8, "0");
          pairing = {
            codeHash: hash(code),
            expires: Date.now() + 300000,
            attempts: 0,
            permission: input.permission,
            project: input.project.trim(),
          };
          result = {
            code,
            expiresAt: new Date(pairing.expires).toISOString(),
            lan: lanInfo(),
          };
          store.event(actor, "生成配对码", "一次使用，5 分钟有效");
        } else if (path === "/api/settings" && req.method === "PATCH") {
          if (typeof input.ci !== "boolean") fail(400, "CI 状态必须为布尔值");
          result = store.tx(() => {
            store.setMeta("settings", { ci: input.ci });
            store.event(
              actor,
              "修改设置",
              input.ci ? "允许项目只读 CI" : "关闭 CI 访问",
            );
            return { ci: input.ci };
          });
        } else if (path === "/api/export" && req.method === "GET")
          result = store.export();
        else if (path === "/api/import" && req.method === "POST")
          result = store.import(input);
        else if (path === "/api/backup" && req.method === "POST") {
          const backupDir = join(dataDir, "backups");
          mkdirSync(backupDir, { recursive: true, mode: 0o700 });
          const name = `memory-${new Date().toISOString().replace(/[:.]/g, "-")}-${requestId}.sqlite`;
          await backup(store.db, join(backupDir, name));
          chmodSync(join(backupDir, name), 0o600);
          store.event(actor, "备份数据库", name);
          res.writeHead(200, {
            "Content-Type": "application/vnd.sqlite3",
            "Content-Disposition": `attachment; filename="${name}"`,
            "Cache-Control": "no-store",
          });
          return createReadStream(join(backupDir, name)).pipe(res);
        } else if (path === "/api/evaluations" && req.method === "POST")
          result = store.evaluate(input);
        else fail(404, "接口不存在", "NOT_FOUND");
        return send(res, req.method === "POST" ? 201 : 200, result);
      }
      if (path.startsWith("/v1/")) {
        if (req.headers.origin)
          fail(403, "工具 API 不接受浏览器 Origin", "INVALID_ORIGIN");
        if (!remote) trusted(req);
        rate(`tool:${req.socket.remoteAddress}`, 240);
        if (path === "/v1/pair" && req.method === "POST") {
          if (!remote) fail(403, "配对必须使用局域网 HTTPS 入口");
          rate("pairing", 20, 300000);
          const input = await body(req);
          if (
            !pairing ||
            pairing.expires < Date.now() ||
            ++pairing.attempts > 5 ||
            typeof input.code !== "string" ||
            !safeEqual(hash(input.code), pairing.codeHash)
          )
            fail(403, "配对码无效、已使用或已过期", "PAIRING_DENIED");
          const issued = store.tx(() =>
            store.issue({
              name: input.name,
              kind: "device",
              permission: pairing.permission,
              project: pairing.project,
            }),
          );
          pairing = null;
          return send(res, 201, {
            ...issued,
            instance: store.getMeta("instance"),
          });
        }
        const token = req.headers.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.slice(7)
          : null;
        actor = store.authenticate(token, remote);
        let result;
        if (path === "/v1/status" && req.method === "GET")
          result = {
            instance: store.getMeta("instance"),
            name: actor.name,
            project: actor.project,
            permission: actor.permission,
            storage: "SQLite",
            version: "0.2.0",
          };
        else if (req.method === "POST") {
          const input = await body(req);
          const routes = {
            "/v1/search": () => store.search(input, actor),
            "/v1/propose": () => store.propose(input, actor),
            "/v1/extract": () => store.extract(input, actor),
            "/v1/feedback": () => store.feedback(input, actor),
          };
          if (!routes[path]) fail(404, "接口不存在");
          if (path === "/v1/search") result = routes[path]();
          else {
            const key = req.headers["idempotency-key"];
            if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(key))
              fail(400, "写入需要 8–100 字符的 Idempotency-Key");
            const operationKey = `${actor.id}:${key}`,
              digest = hash(path + JSON.stringify(input));
            result = store.tx(() => {
              const cached = store.db
                .prepare("SELECT response FROM operations WHERE key=?")
                .get(operationKey);
              if (cached) {
                const v = JSON.parse(cached.response);
                if (v.digest !== digest) fail(409, "幂等键已用于不同请求");
                return v.result;
              }
              const value = routes[path]();
              store.db
                .prepare("INSERT INTO operations VALUES (?,?)")
                .run(operationKey, JSON.stringify({ digest, result: value }));
              return value;
            });
          }
        } else fail(404, "接口不存在");
        return send(res, 200, result);
      }
      trusted(req);
      if (!["GET", "HEAD"].includes(req.method)) fail(405, "请求方法不受支持");
      const file =
        path === "/"
          ? join(ROOT, "dist/index.html")
          : resolve(ROOT, "dist", `.${decodeURIComponent(path)}`);
      const base = join(ROOT, "dist");
      if (
        !file.startsWith(`${base}/`) ||
        !existsSync(file) ||
        !statSync(file).isFile()
      )
        fail(404, "请先运行 npm run build，再用 npm start 启动服务");
      res.writeHead(200, {
        "Content-Type": MIME[extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        "Cache-Control": path === "/" ? "no-cache" : "public, max-age=3600",
      });
      if (req.method === "HEAD") return res.end();
      createReadStream(file).pipe(res);
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(`[${requestId}]`, e.message);
      if ((req.url?.startsWith("/v1/") || actor) && status >= 400) {
        try {
          store.event(
            actor || { name: "未认证客户端" },
            "请求被拒绝",
            e.status ? e.message : "内部错误",
            { status: "拒绝", code: e.code || "INTERNAL_ERROR", requestId },
          );
        } catch {}
      }
      if (!res.headersSent)
        send(res, status, {
          error: e.status ? e.message : "服务内部错误，请查看本机日志",
          code: e.code || "INTERNAL_ERROR",
          requestId,
        });
      else res.end();
    }
  }
  const server = http.createServer((req, res) => handle(req, res));
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(
      options.port ?? Number(process.env.KARMEN_MEMORY_PORT || 4318),
      "127.0.0.1",
      resolve,
    );
  });
  port = server.address().port;
  if (store.getMeta("lan", false)) {
    try {
      await toggleLan(true);
    } catch (e) {
      lanError = e.message;
      store.setMeta("lan", false);
    }
  }
  return {
    store,
    server,
    port,
    dataDir,
    lanInfo,
    close: async () => {
      await toggleLan(false);
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
      store.close();
    },
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const service = await createService();
  console.log(
    `KARMEN Memory: http://127.0.0.1:${service.port}\nDatabase: ${join(service.dataDir, "memory.sqlite")}`,
  );
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    await service.close();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
