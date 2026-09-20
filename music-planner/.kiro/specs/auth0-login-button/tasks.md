# Implementation Plan: Auth0 Login Button

## Overview

This plan implements a standalone `AuthButtonComponent` in the App's top navigation bar that reflects Auth0 authentication state (loading / signed-out / signed-in) and drives the login-redirect and logout flows through the already-configured `AuthService`. Work proceeds bottom-up: first the pure `deriveUserIdentifier` function (the property-tested core), then the component's observable wiring and template, then its actions and error handling, then wiring into `AppComponent`, and finally the Monthly View banner integration for auth-failure surfacing. No Auth0 provider changes are needed (already configured in `app.config.ts`).

All code targets the existing stack: Angular 17 standalone components, TypeScript, Angular Material, RxJS, and Karma + Jasmine + `fast-check` for tests.

## Tasks

- [x] 1. Create pure `deriveUserIdentifier` derivation
  - [x] 1.1 Implement `deriveUserIdentifier(user)` in the auth-button module
    - Create `music-planner-app/src/app/auth-button/auth-button.component.ts` (or a co-located `user-identifier.ts`) exporting the pure function
    - Precedence: non-empty trimmed `name` → non-empty trimmed `email` → `null`; treat `null`/`undefined` user as `null`; "non-empty" = at least one non-whitespace char
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 1.2 Write property test: name precedence
    - **Property 1: Name takes precedence when non-empty**
    - Use `fast-check` with `fc.assert(..., { numRuns: 100 })`; generate users with non-whitespace `name` and arbitrary `email`
    - Tag: `// Feature: auth0-login-button, Property 1`
    - **Validates: Requirements 4.1**

  - [ ]* 1.3 Write property test: email fallback
    - **Property 2: Email is used only when name is empty and email is non-empty**
    - Generate users with missing/whitespace `name` and non-whitespace `email`; assert trimmed email returned
    - Tag: `// Feature: auth0-login-button, Property 2`
    - **Validates: Requirements 4.2**

  - [ ]* 1.4 Write property test: no usable identifier
    - **Property 3: No identifier when nothing usable is present**
    - Generate `null`/`undefined` users and users with both `name`/`email` missing or whitespace; assert `null`
    - Tag: `// Feature: auth0-login-button, Property 3`
    - **Validates: Requirements 4.3, 4.4**

  - [ ]* 1.5 Write property test: totality
    - **Property 4: Result is always name, email, or null (totality)**
    - Generate arbitrary inputs (null/undefined, arbitrary strings incl. empty/whitespace); assert result is trimmed name, trimmed email, or `null` — never whitespace-only, never throws
    - Tag: `// Feature: auth0-login-button, Property 4`
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 2. Implement `AuthButtonComponent`
  - [x] 2.1 Scaffold the standalone component and wire observables
    - Create `auth-button.component.ts` with selector `app-auth-button`, `standalone: true`, `imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule]`, `styleUrl: './auth-button.component.css'`, `templateUrl: './auth-button.component.html'`
    - Inject `AuthService`; expose `isLoading$`, `isAuthenticated$`, and `userIdentifier$ = auth.user$.pipe(map(deriveUserIdentifier))`
    - Add `loginInProgress = false` field
    - Create empty `auth-button.component.css`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4_

  - [x] 2.2 Build the three-state template
    - Create `auth-button.component.html` rendering mutually exclusive states via `async` pipe: loading spinner (suppress both actions), Unauthenticated `Log In` `mat-button` with `[disabled]="loginInProgress"`, Authenticated `User_Identifier` span + `Log Out` `mat-button`
    - Use native `mat-button` `<button>` elements so keyboard (Enter/Space) and pointer activation are native
    - _Requirements: 1.2, 1.3, 1.4, 2.2, 2.3, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4_

  - [x] 2.3 Implement `login()` and `logout()` actions with error handling
    - `login()`: ignore when `loginInProgress` is `true` (Req 2.5/5.3); set `loginInProgress = true`; subscribe to `auth.loginWithRedirect()`; on error reset `loginInProgress = false` and signal login-initiation failure (Req 2.4)
    - `logout()`: wrap `auth.logout({ logoutParams: { returnTo: window.location.origin } })` in try/catch; on throw signal logout-initiation failure (Req 3.4)
    - _Requirements: 2.1, 2.4, 2.5, 3.1, 3.4, 5.3_

  - [ ]* 2.4 Write component tests for state rendering
    - Mock `AuthService` with `BehaviorSubject`-backed `isLoading$` / `isAuthenticated$` / `user$`
    - Loading: spinner shown, no Log In/Log Out (Req 1.2); Unauthenticated: Log In visible+enabled, no Log Out/identifier (Req 1.3, 2.3); Authenticated: Log Out + identifier, no Log In (Req 1.4); assert rendered actions are native `<button>` (Req 2.2, 3.2)
    - Feed representative `user$` values and assert identifier matches `deriveUserIdentifier` (Req 4.1–4.4)
    - _Requirements: 1.2, 1.3, 1.4, 2.2, 2.3, 3.2, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 2.5 Write component tests for actions and guards
    - Clicking Log In calls `loginWithRedirect` (Req 2.1); second click while `loginInProgress` does not call it again and button is disabled (Req 2.5)
    - Clicking Log Out calls `logout` with `{ logoutParams: { returnTo: window.location.origin } }` (Req 3.1)
    - Login initiation failure: `loginWithRedirect` returns throwing Observable → `loginInProgress` resets and failure signalled (Req 2.4); logout throw → state stays Authenticated and failure signalled (Req 3.4)
    - _Requirements: 2.1, 2.4, 2.5, 3.1, 3.4_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Wire `AuthButtonComponent` into the navigation bar
  - [x] 4.1 Add the control to `AppComponent`
    - Import `AuthButtonComponent` into `app.component.ts` `imports` array
    - Add `<app-auth-button class="nav-auth">` inside the existing `<nav class="app-nav">` in `app.component.html`, after the router links
    - Add styling in `app.component.css` to push the control to the far end of the bar (e.g. `margin-left: auto`)
    - _Requirements: 1.1_

  - [ ]* 4.2 Write nav-presence test
    - `AppComponent` test asserts `<app-auth-button>` renders within `.app-nav` on the always-present shell
    - _Requirements: 1.1_

- [x] 5. Integrate auth-failure surfacing with the Monthly View banner
  - [x] 5.1 Subscribe `MonthlyServicesViewComponent` to `AuthService.error$`
    - On `error$` emission, set `authError = true` with a message indicating authentication failed; control returns to Unauthenticated_State automatically since `isAuthenticated$` stays `false`
    - Confirm existing 401-driven banner and its reset in `loadServices` remain intact so the banner clears after successful login+reload (Req 5.2)
    - _Requirements: 1.7, 5.4_

  - [x] 5.2 (Optional) Add `AuthErrorState` service for initiation-failure surfacing
    - Introduce a tiny injectable `AuthErrorState` (`BehaviorSubject<string | null>`) that `AuthButtonComponent` writes to on login/logout initiation failure and `MonthlyServicesViewComponent` reads to raise the banner, avoiding shell↔child coupling
    - Wire `AuthButtonComponent.login()`/`logout()` error branches (task 2.3) to push messages; only needed if initiation-failure surfacing is required
    - _Requirements: 2.4, 3.4_

  - [ ]* 5.3 Write banner integration tests
    - Emit on mocked `error$` and assert `authError` becomes `true` with expected message (Req 1.7, 5.4)
    - With `authError = true`, assert banner and (persistent nav) Login button coexist and are reachable; simulate `isAuthenticated$` → `true` and a successful reload, assert `authError` clears (Req 5.1, 5.2)
    - _Requirements: 1.7, 5.1, 5.2, 5.4_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (tests) and can be skipped for a faster MVP.
- Each task references specific requirements for traceability; property test sub-tasks reference the design's numbered correctness properties.
- Property-based tests (`fast-check`, 100+ iterations) are scoped only to the pure `deriveUserIdentifier` function; all UI behavior is covered by Karma/Jasmine component tests.
- Task 5.2 is an optional enhancement (design Error Handling "option 2"); implement only if login/logout initiation failures must surface in the banner.
- No Auth0 provider changes are required — `provideAuth0` is already configured in `app.config.ts`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "4.1", "5.1"] },
    { "id": 4, "tasks": ["4.2", "5.2"] },
    { "id": 5, "tasks": ["5.3"] }
  ]
}
```
