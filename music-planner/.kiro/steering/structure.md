# Project Structure

```
src/
  app/
    app.component.*        # Root shell component, hosts <router-outlet>
    app.config.ts          # Application config (provideRouter, provideAnimationsAsync)
    app.routes.ts          # Route definitions (currently: '' -> ScheduleComponent)
    schedule/              # Main feature: music schedule planner
      schedule.component.ts
      schedule.component.html
      schedule.component.css
      schedule.component.spec.ts
  assets/
    repertoire.json        # Song number translation table (A-series -> E-series, etc.)
  main.ts                  # Bootstrap entry point
  styles.css               # Global styles
```

## Conventions

- All components are **standalone** — import dependencies directly in the component's `imports` array, not via NgModules
- One feature per folder under `src/app/`; new features should follow the `schedule/` pattern
- Interfaces and classes co-located in the component `.ts` file unless shared across multiple components
- Template-driven forms (`ngModel`) are preferred over reactive forms
- Date handling uses Moment.js; the `MomentDateAdapter` and `MY_FORMATS` constant are defined in `schedule.component.ts`
- Static/reference data (like the repertoire) lives in `src/assets/` as JSON and is imported directly via TypeScript `import`
- Schedule data is user-supplied at runtime via file input — never hardcoded or bundled
- Song numbers use `'N/A'` as the empty/placeholder value (not empty string)
- Conflict thresholds: ≤56 days = conflict, 57–90 days = quarter conflict, 91–365 days = year conflict
