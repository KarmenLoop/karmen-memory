import { spawn } from "node:child_process";
import { createService } from "../server/http.mjs";
const args = process.argv.slice(2),
  portAt = args.indexOf("--port");
const uiPort = portAt >= 0 ? args[portAt + 1] : "5186";
const service = await createService({ port: 4318, devPort: uiPort });
const child = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    uiPort,
    "--strictPort",
  ],
  { stdio: "inherit" },
);
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child.kill("SIGTERM");
  await service.close();
  process.exitCode = code;
}
child.on("exit", (code) => stop(code || 0));
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
console.log(`Memory service: http://127.0.0.1:${service.port}`);
