# Tech Stack

## Framework & Language
- Angular 17 (standalone components, no NgModules)
- TypeScript 5.4
- Angular Material 17 (UI components, purple-green prebuilt theme)
- Moment.js + `@angular/material-moment-adapter` for date handling

## Key Libraries
- `@angular/forms` - template-driven forms with `ngModel`
- `@angular/router` - client-side routing
- `@angular/cdk` - component dev kit (used by Material)
- `rxjs` 7.8

## Build System
- Angular CLI 17 (`@angular-devkit/build-angular`)
- Vite-based dev server (via Angular's application builder)
- Output: `dist/music-planner`

## Testing
- Karma + Jasmine (unit tests)
- Test files use `.spec.ts` suffix

## Common Commands

```bash
npm start          # dev server at http://localhost:4200
npm run build      # production build
npm test           # run unit tests (Karma, opens browser)
ng generate component <name>  # scaffold a new component
```

## Style
- Angular Material prebuilt theme: `purple-green.css`
- Global styles: `src/styles.css`
- Component-scoped styles via `styleUrl` in each component
