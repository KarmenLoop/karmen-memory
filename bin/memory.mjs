#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { homedir } from "node:os";
import { configuration, request } from "./client.mjs";

const [command, ...args] = process.argv.slice(2);
const flags = {},
  positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    if (!args[i + 1] || args[i + 1].startsWith("--")) {
      console.error(`Missing value for ${args[i]}`);
      process.exit(2);
    }
    flags[args[i].slice(2)] = args[++i];
  } else positional.push(args[i]);
}
const usage = `KARMEN Memory CLI
  status
  search "query" [--project PROJECT]
  propose --title TITLE --body BODY --project PROJECT [--scope local|shared]
  extract --file FILE --project PROJECT [--scope local|shared]
  feedback --id MEMORY_ID --useful true|false
  pair --url https://HOST:4319 --ca CA_FILE --code CODE --name NAME [--profile FILE]

Authentication: KARMEN_MEMORY_TOKEN or KARMEN_MEMORY_TOKEN_FILE.
Options: --url URL, --profile FILE, --key IDEMPOTENCY_KEY.
Pairing saves a private client profile; other commands never save credentials.
`;
try {
  if (!command || command === "help" || command === "--help") {
    console.log(usage);
    process.exit(0);
  }
  const config = configuration({
    ...(flags.url ? { url: flags.url } : {}),
    ...(flags.profile ? { profile: resolve(flags.profile) } : {}),
    ...(flags.ca ? { ca: resolve(flags.ca) } : {}),
  });
  const scoped = {
    ...(flags.project ? { project: flags.project } : {}),
    scope: flags.scope === "shared" ? "全设备" : "仅本机",
  };
  if (flags.scope && !["local", "shared"].includes(flags.scope))
    throw Error("Scope must be local or shared.");
  let result;
  if (command === "pair") {
    if (
      !flags.ca ||
      !flags.code ||
      !flags.name ||
      !flags.url?.startsWith("https://")
    )
      throw Error(
        "Pair requires --url HTTPS_URL --ca FILE --code CODE --name NAME.",
      );
    const profile = resolve(
      flags.profile || join(homedir(), ".karmen-memory", "client.json"),
    );
    if (existsSync(profile))
      throw Error(
        "Client profile already exists; choose a new --profile FILE.",
      );
    result = await request({ ...config, token: undefined }, "/v1/pair", {
      code: flags.code,
      name: flags.name,
    });
    mkdirSync(dirname(profile), { recursive: true, mode: 0o700 });
    // A new pairing must not overwrite another device's usable credentials.
    writeFileSync(
      profile,
      JSON.stringify(
        {
          url: config.url,
          ca: config.ca,
          token: result.token,
          instance: result.instance,
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600, flag: "wx" },
    );
    result = {
      paired: true,
      profile,
      credential: result.credential,
      instance: result.instance,
    };
  } else if (command === "status") result = await request(config, "/v1/status");
  else if (command === "search")
    result = await request(config, "/v1/search", {
      query: positional.join(" "),
      ...(flags.project ? { project: flags.project } : {}),
    });
  else if (command === "propose")
    result = await request(
      config,
      "/v1/propose",
      {
        title: flags.title,
        body: flags.body,
        type: flags.type || "项目需求",
        ...scoped,
        provenance: flags.evidence || "CLI 明确提交",
      },
      flags.key,
    );
  else if (command === "extract") {
    if (!flags.file) throw Error("Extract requires --file FILE.");
    result = await request(
      config,
      "/v1/extract",
      { text: readFileSync(resolve(flags.file), "utf8"), ...scoped },
      flags.key,
    );
  } else if (command === "feedback") {
    if (!["true", "false"].includes(flags.useful))
      throw Error("Feedback requires --useful true|false.");
    result = await request(
      config,
      "/v1/feedback",
      { memoryId: flags.id, useful: flags.useful === "true" },
      flags.key,
    );
  } else throw Error(`Unknown command: ${command}\n${usage}`);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
