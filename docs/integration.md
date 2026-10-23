# CLI, MCP, HTTP, and LAN integration

All clients call the same running service. The service validates scope, lifecycle, permissions, and review decisions. A credential name is a user-provided label, not proof of a particular installed host's identity.

## Configure access

In the console, create a credential with a tool name, exact project or `*`, and `read` or `readwrite`. Copy the token once into a private file, set its mode to `0600`, and set `KARMEN_MEMORY_TOKEN_FILE`. The client also accepts `KARMEN_MEMORY_TOKEN`; keep it outside logs and repository files.

Optional environment variables:

| Variable | Meaning |
| --- | --- |
| `KARMEN_MEMORY_URL` | Service base URL; default `http://127.0.0.1:4318` |
| `KARMEN_MEMORY_TOKEN_FILE` | Private token file; overrides an environment token or profile |
| `KARMEN_MEMORY_TOKEN` | Credential supplied by the host |
| `KARMEN_MEMORY_PROFILE` | Private JSON profile; default `~/.karmen-memory/client.json` |
| `KARMEN_MEMORY_CA` | Trusted public PEM certificate for a LAN service |
| `KARMEN_MEMORY_REPO` | Optional checkout location used by the runtime skill |

A specific project credential sees only that exact project's facts. A wildcard credential can query across projects, or filter to one project plus general facts. CI requires a named project and `read`; the console can disable existing CI credentials. Read/write allows proposals and extraction, not direct approval or editing confirmed facts. Feedback is permitted for visible facts.

## Command-line use

```sh
node bin/memory.mjs status
node bin/memory.mjs search "code convention" --project "My Project"
node bin/memory.mjs propose --title "Code convention" --body "Use strict types." \
  --project "My Project" --scope local --evidence "Owner's explicit requirement"
node bin/memory.mjs extract --file ./requirements.txt --project "My Project"
node bin/memory.mjs feedback --id MEMORY_ID --useful true
```

Commands return JSON to stdout and errors to stderr with exit code 1. A failed network request does not confirm whether a write committed. For retryable proposals use `--key UNIQUE_OPERATION_KEY`; reuse that key only for the same body after checking the console. Reusing a key with another request returns conflict. Proposals and extraction remain pending until reviewed.

## MCP stdio

A host with stdio MCP support can use this configuration template. Replace the absolute paths and merge the server entry into the host's existing configuration:

```json
{
  "mcpServers": {
    "karmen-memory": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/karmen-memory/bin/mcp.mjs"],
      "env": {
        "KARMEN_MEMORY_TOKEN_FILE": "/private/path/memory-token",
        "KARMEN_MEMORY_URL": "http://127.0.0.1:4318"
      }
    }
  }
}
```

The bridge exposes `memory_search`, `memory_propose`, `memory_extract`, and `memory_feedback`. JSON-RPC messages are newline-delimited; stdout contains only protocol messages. It negotiates protocol 2025-06-18 or 2024-11-05 and requires initialization before tool calls. Tool failures return `isError: true`.

Cursor documents project `.cursor/mcp.json` and user `~/.cursor/mcp.json` configuration and supports stdio. This project does not overwrite either file. Verify the server in the installed host, call a tool, then check the returned memory ID in the console. [Cursor MCP documentation](https://cursor.com/docs/mcp).

Koder, Koder CLI, and the other catalog targets require their own host-specific configuration or adapter. Koder CLI is distinct from Koder Open CLI. The memory service does not replace their Core, task authority, or approvals. Where a host supports only shell tools, use the CLI with its own scoped credential.

The bridge follows the [MCP tools contract](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) and [stdio transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports). It is not a Streamable HTTP MCP server; `/v1/*` is a separate authenticated JSON API.

## HTTP contract

Tool requests use `Authorization: Bearer TOKEN`. POST requests need `Content-Type: application/json`. Writes also require an 8–100 character `Idempotency-Key` containing letters, digits, `_`, or `-`. Bodies are limited to 2 MB.

| Endpoint | Input | Result |
| --- | --- | --- |
| `GET /v1/status` | No body | Service instance and credential scope |
| `POST /v1/search` | `query`, optional `project` | Approved `hits`, scores, matched terms, source, revision, context, service ranking duration |
| `POST /v1/propose` | `title`, `body`, `project`, optional `type`, `scope`, `provenance` | Pending candidate ID, or visible duplicate ID |
| `POST /v1/extract` | `text`, `project`, optional `scope` | Up to 20 explicit-sentence candidates and duplicate count |
| `POST /v1/feedback` | `memoryId`, `useful` boolean | Recorded receipt |

Types are `个人偏好`, `项目需求`, `代码规范`, `架构决策`, and `工作方式`. Scope is `仅本机` (default) or `全设备`. LAN writers must explicitly select `全设备`.

A fact has stable `id`, `revision`, `title`, `body`, `type`, `project`, `scope`, `source`, `provenance`, lifecycle `status`, timestamps, and optional `supersedes`. Archive removes it from retrieval while retaining history. Conflicting edits to the owner API require the current `revision`; stale writes return 409. Candidate approval creates a new fact; superseding also archives the selected old fact in the same transaction.

Errors include 400 validation, 401 missing credentials/session, 403 scope or revoked/read-only policy, 404 invisible/missing record, 409 revision/idempotency conflict, 413 body limit, 429 rate limit, and 503 TLS/listener setup. A denied call is recorded without the token or raw request body.

## LAN pairing

1. Enable sharing in the console. The service generates a private key and one-year self-signed certificate, with localhost and the machine's current IPv4 addresses as subject alternative names. OpenSSL must support `req -addext`.
2. Copy only `lan-cert.pem` (the console's public-certificate download) through a trusted channel. Compare its SHA-256 fingerprint with the console.
3. Create a one-use pairing code with explicit project and permission. It expires in five minutes, locks after five attempts, and is replaced by the next generated code.
4. On the other computer run `node bin/memory.mjs pair --url https://HOST_IP:4319 --ca ./karmen-memory-ca.pem --code CODE --name "Other computer"`. Use `--profile FILE` if the default profile already exists. The CLI refuses to overwrite one.
5. Run `status` and `search` using that profile. Verify the last request and exact memory ID on the primary console.

Only paired device credentials work on the HTTPS listener. Device credentials can see only shared facts even if used over loopback. Owner APIs are unavailable on the LAN listener. Pausing/revoking a credential applies on every request. Disabling sharing closes the listener and invalidates the pending code; issued credentials remain revocable in the console. Clean shutdown turns sharing off.

Pairing and authenticated sharing have been tested with separate clients on one computer. Physical two-computer operation and firewall configuration require separate acceptance. If the host IP changes, certificate SANs may need an update. Stop sharing and the service, securely preserve the old key/certificate if needed, generate a replacement through the setup flow, and redistribute the public certificate after rechecking its fingerprint. Existing clients must trust the replacement. Never disable certificate validation as a workaround.
