# bizfinder app (Expo / React Native)

Search + listing + tap-to-call, sharing the `@bizfinder/shared` API client with the web app.
Analytics events are tagged `surface = ios | android`; tap-to-call fires a `call` event.

## Status
- **Code complete and typechecks** (`npm run typecheck -w @bizfinder/app`).
- **Known setup issue:** a clean Metro bundle currently fails because **npm workspaces** hoisting
  misplaces some Expo transitive deps (`schema-utils`, `@react-navigation/core`, …). This is a
  tooling/monorepo issue, not an app-code bug — the bundler gets through Babel, expo-router, and
  the RN-version checks before hitting these.

## Recommended fix (pick one), then `npx expo start`
1. **Switch the monorepo to pnpm or yarn** — both handle Expo monorepos far better than npm
   workspaces (npm's flat hoisting is the root cause). Lowest long-term friction.
2. **Isolate the app's install** — remove `app` from the root `workspaces` array, add
   `@bizfinder/shared` as a `file:../packages/shared` dependency, and run `npm install` *inside*
   `app/` so all Expo deps live in `app/node_modules` where Metro expects them. The existing
   `metro.config.js` already adds the workspace root to `watchFolders`.
3. **Let Expo align everything:** in `app/`, run `npx expo install --fix` then `npx expo-doctor`
   and install whatever it reports missing.

## Run (once the above is done)
```bash
cd app
npx expo start          # then press i / a, or scan the QR with Expo Go
```
On a physical device, set `expo.extra.apiUrl` in `app.json` to your machine's LAN IP
(e.g. `http://192.168.1.20:4000`) — `localhost` won't reach the API from the phone.
