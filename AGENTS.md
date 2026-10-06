# Repository Guidelines

## Project Structure & Module Organization
`client/` contains the Vite + React frontend. Main application code lives in `client/src`, with UI in `components/`, route screens in `pages/`, shared state in `redux/`, and helpers in `utils/` and `data/`. Static assets belong in `client/public/` or `client/src/assets/`.

`server/` contains the Express API. Keep HTTP handlers in `controllers/`, route registration in `routes/`, persistence in `models/`, shared logic in `services/`, and cross-cutting request logic in `middlewares/`. Utility scripts such as question seeding and backups live in `server/scripts/`.

`judge0/` is a bundled upstream service for coding interviews. Treat it as vendored code unless a task explicitly targets Judge0.

## Build, Test, and Development Commands
- `cd client && npm run dev` starts the frontend on Vite dev server.
- `cd client && npm run build` creates the production bundle in `client/dist/`.
- `cd client && npm run lint` runs ESLint for `js` and `jsx` files.
- `cd server && npm run dev` starts the API with `nodemon`.
- `cd server && node index.js` runs the API without reload support.
- `cd server && npm run seed:questions` seeds interview questions.
- `cd server && npm run backup:questions` writes a question backup.

## Coding Style & Naming Conventions
Follow the existing ESM style and keep imports at the top of each file. Frontend page and component files use PascalCase (`InterviewReport.jsx`); backend controllers and routes use lowercase descriptive names with dots (`user.controller.js`, `auth.route.js`).

The codebase currently mixes semicolon and no-semicolon styles. Do not reformat unrelated files; match the style already present in the file you touch. Use 2-space indentation in frontend config files and preserve the surrounding indentation pattern elsewhere. Run `npm run lint` in `client/` before submitting frontend changes.

## Testing Guidelines
There is no automated test suite configured yet in the root, client, or server packages. For now, validate changes with targeted manual checks: auth flow, interview creation, payment-related paths, and coding interview flows affected by your change. When adding tests later, keep them close to the feature and use `*.test.js` or `*.test.jsx`.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects such as `Phone Detection Add`. Prefer clearer variants like `Add phone detection warnings` and keep each commit focused.

Pull requests should include: a short summary, affected areas (`client`, `server`, `judge0`), environment or seed data changes, linked issues, and screenshots or API examples for user-facing behavior changes.

## Security & Configuration Tips
Never commit `.env` files or secrets. Client API base URLs and server credentials should come from environment variables. Keep uploads, backups, and generated snapshots out of Git unless they are intentional fixtures.
