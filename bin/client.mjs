import http from "node:http";
import https from "node:https";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export function configuration(overrides = {}) {
  const profile =
    overrides.profile ||
    process.env.KARMEN_MEMORY_PROFILE ||
    join(homedir(), ".karmen-memory", "client.json");
  let saved = {};
  try {
    if (process.platform !== "win32" && statSync(profile).mode & 0o077)
      throw Error("Client profile must have mode 0600.");
    saved = JSON.parse(readFileSync(profile, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  let token =
    process.env.KARMEN_MEMORY_TOKEN ||
    (overrides.url && saved.url && overrides.url !== saved.url
      ? undefined
      : saved.token);
  const tokenFile = process.env.KARMEN_MEMORY_TOKEN_FILE;
  if (tokenFile) {
    if (process.platform !== "win32" && statSync(tokenFile).mode & 0o077)
      throw Error("Token file must have mode 0600.");
    token = readFileSync(tokenFile, "utf8").trim();
  }
  return {
    ...saved,
    token,
    url: process.env.KARMEN_MEMORY_URL || saved.url || "http://127.0.0.1:4318",
    ca: process.env.KARMEN_MEMORY_CA || saved.ca,
    ...overrides,
  };
}

export function request(config, path, body, idempotencyKey = randomUUID()) {
  const target = new URL(path, config.url);
  if (target.username || target.password || target.hash)
    throw Error("The service URL must not contain credentials or fragments.");
  if (
    target.protocol !== "https:" &&
    !(
      target.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
    )
  )
    throw Error("Remote memory access requires HTTPS and a trusted CA file.");
  const data = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = (target.protocol === "https:" ? https : http).request(
      target,
      {
        method: data === undefined ? "GET" : "POST",
        timeout: 15000,
        ...(config.ca ? { ca: readFileSync(config.ca) } : {}),
        headers: {
          ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
          ...(data !== undefined
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data),
                "Idempotency-Key": idempotencyKey,
              }
            : {}),
        },
      },
      (res) => {
        const chunks = [];
        let length = 0;
        res.on("data", (chunk) => {
          length += chunk.length;
          if (length > 2_000_000) req.destroy(Error("Response is too large."));
          else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => {
          try {
            const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (res.statusCode >= 400) {
              const error = Error(
                `${value.error || "Request failed"} (${value.code || res.statusCode})`,
              );
              error.status = res.statusCode;
              return reject(error);
            }
            resolve(value);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () =>
      req.destroy(
        Error(
          "Memory service timed out; verify the original operation before retrying.",
        ),
      ),
    );
    req.end(data);
  });
}
