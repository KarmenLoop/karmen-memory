# Run the prebuilt preview

This folder contains the static KARMEN Memory prototype, not a memory service.

With Python 3 available, run this command from the extracted directory:

```sh
python3 -m http.server 5187 --bind 127.0.0.1
```

Open `http://127.0.0.1:5187` in a browser. Stop the server with Ctrl+C. Use another free port if needed. Serve the extracted directory as the web root; opening index.html directly does not load the absolute asset paths correctly.

Memories and changes stay in that browser origin's localStorage. Use synthetic data. Connections, pairing, and token figures are demonstrations. No real agent configuration, encrypted database, or LAN synchronization is included.

Keep LICENSE, NOTICE, THIRD_PARTY_NOTICES.md, and LICENSES/ with redistributed copies.
