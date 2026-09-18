# comparahorro (frontend)

Aplicación Angular 22 basada en NgModules (`standalone: false`), en español e inglés (`src/app/core/i18n`). Instrucciones completas, versiones y estado de las integraciones en el [README principal](../README.md).

- `npm start`: levanta la API (`../server`) y el servidor de desarrollo en http://localhost:4200.
- `npm run serve`: solo Angular (`ng serve`); necesita la API en http://127.0.0.1:3000.
- `npm run build`: compilación de producción en `dist/comparahorro/browser`.
- `npm test -- --watch=false`: pruebas unitarias (Vitest).
