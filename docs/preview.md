# Running the prebuilt runtime

The runtime archive includes the service source and built interface. It requires Node 22.16+ and npm. From its root run:

```sh
npm ci
npm start
```

Open `http://127.0.0.1:4318`. The default private database is `~/.karmen-memory/memory.sqlite`; set `KARMEN_MEMORY_HOME` to use an isolated location. Stop the process with Ctrl-C. LAN starts disabled and needs OpenSSL certificate generation plus explicit pairing.

The UI requires the included API service. Serving only `dist/` through a static file server does not provide memory storage or authentication. See README and docs/getting-started.md for backup and recovery.
