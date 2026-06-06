# bizfinder app (Expo / React Native)

Search + listing + tap-to-call, sharing the `@bizfinder/shared` API client with the web app.
Analytics events are tagged `surface = ios | android`; tap-to-call fires a `call` event.

## Status
- **Working** — typechecks (`npm run typecheck`) and bundles cleanly via Metro (`npx expo export`).
- **Isolated install** (Option B): the app is intentionally NOT a root workspace member. It has its
  own `node_modules` so Expo's transitive deps resolve correctly (npm-workspaces hoisting otherwise
  misplaces them). `@bizfinder/shared` is wired in three ways: a `file:../packages/shared` dependency,
  a Metro `watchFolder` + `extraNodeModules` alias (see `metro.config.js`), and shared's runtime dep
  (`zod`) listed directly here.

## Install (run inside `app/`, not from the repo root)
```bash
cd app
npm install
```

## Run
```bash
cd app
npx expo start          # press i / a for a simulator, or scan the QR with Expo Go
```
`expo.extra.apiUrl` in `app.json` points at the PC's LAN IP (currently `http://172.20.10.4:4000`)
so a physical phone can reach the API — `localhost` won't work from the device. Update it if your
IP changes (`ipconfig`), and make sure the API allows inbound connections on port 4000 (Windows
Firewall may prompt the first time).
