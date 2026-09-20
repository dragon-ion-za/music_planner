# Requirements Document

## Introduction

The Music Planner application already has Auth0 configured (via `provideAuth0` in `app.config.ts`) and consumes authentication state through the `@auth0/auth0-angular` `AuthService` for attaching bearer tokens to API requests. However, the user interface currently provides no way to initiate authentication or to sign out. As a result, users who are not authenticated cannot log in, and the Monthly View shows an "authentication required" banner with no actionable control.

This feature adds an authentication control to the application's top navigation bar. The control reflects the current authentication state: it presents a Log In action when the user is signed out and a Log Out action (alongside an identifier for the signed-in user) when the user is signed in. The Log In action triggers the Auth0 redirect login flow, and the Log Out action triggers the Auth0 logout flow. The control complements the existing authentication-error banner on the Monthly View so that a user who sees the banner has an accessible means to sign in.

## Glossary

- **App**: The Music Planner Angular single-page application.
- **Auth_Control**: The user-interface element rendered in the top navigation bar that displays either a Log In action or a Log Out action together with the signed-in user's identifier, based on authentication state.
- **Auth_Service**: The `@auth0/auth0-angular` `AuthService` instance already provided in the application, exposing `isAuthenticated$`, `user$`, `isLoading$`, `loginWithRedirect()`, and `logout()`.
- **Auth0**: The external Auth0 identity provider configured via `provideAuth0` in `app.config.ts`.
- **Login_Action**: The interactive Log In element within the Auth_Control.
- **Logout_Action**: The interactive Log Out element within the Auth_Control.
- **Authenticated_State**: The condition in which `Auth_Service.isAuthenticated$` emits `true`.
- **Unauthenticated_State**: The condition in which `Auth_Service.isAuthenticated$` emits `false`.
- **Loading_State**: The condition in which `Auth_Service.isLoading$` emits `true`, indicating Auth0 has not yet resolved authentication state.
- **User_Identifier**: A display value derived from `Auth_Service.user$` (for example, the user's name or email) shown while in Authenticated_State.
- **Auth_Error_Banner**: The existing banner in `MonthlyServicesViewComponent` shown when a services request returns HTTP 401, reading "You are not authenticated. Please log in to view services."
- **Nav_Bar**: The top navigation element in `app.component.html` containing the Schedule and Monthly View links.

## Requirements

### Requirement 1: Display authentication control in the navigation bar

**User Story:** As a user, I want an authentication control in the top navigation bar, so that I can see and manage my sign-in state from anywhere in the App.

#### Acceptance Criteria

1. WHILE the App is displaying any route, THE App SHALL render the Auth_Control within the Nav_Bar.
2. WHILE the App is in Loading_State, THE Auth_Control SHALL suppress both the Login_Action and the Logout_Action.
3. WHILE the App is in Unauthenticated_State, THE Auth_Control SHALL display the Login_Action and SHALL NOT display the Logout_Action or the User_Identifier.
4. WHILE the App is in Authenticated_State, THE Auth_Control SHALL display the Logout_Action and the User_Identifier and SHALL NOT display the Login_Action.
5. WHEN the user activates the Login_Action, THE Auth_Control SHALL invoke the Auth_Service login flow via Auth0.
6. WHEN the user activates the Logout_Action, THE Auth_Control SHALL invoke the Auth_Service logout flow.
7. IF the Auth_Service reports an authentication failure, THEN THE App SHALL display the Auth_Error_Banner with a message indicating the authentication failed, and SHALL return the Auth_Control to the Unauthenticated_State.

### Requirement 2: Initiate login via Auth0 redirect

**User Story:** As a signed-out user, I want to click a Log In button, so that I can authenticate through Auth0.

#### Acceptance Criteria

1. WHEN the Login_Action is activated, THE App SHALL invoke `Auth_Service.loginWithRedirect()` to redirect the user to Auth0.
2. WHILE the App is in Unauthenticated_State, THE Login_Action SHALL be operable via pointer activation (single primary-button click) and keyboard activation (Enter key or Space key while the Login_Action has keyboard focus).
3. WHILE the App is in Unauthenticated_State, THE App SHALL display the Login_Action as visible and enabled.
4. IF the invocation of `Auth_Service.loginWithRedirect()` fails to initiate the Auth0 redirect, THEN THE App SHALL remain in Unauthenticated_State and display an error message indicating that login could not be started in the Auth_Error_Banner.
5. WHILE a redirect initiated by the Login_Action is in progress, THE App SHALL ignore additional activations of the Login_Action.

### Requirement 3: Initiate logout via Auth0

**User Story:** As a signed-in user, I want to click a Log Out button, so that I can end my session.

#### Acceptance Criteria

1. WHEN the Logout_Action is activated, THE App SHALL invoke `Auth_Service.logout()` with a return target of the App origin.
2. WHILE the App is in Authenticated_State, THE Logout_Action SHALL be operable via pointer activation and keyboard activation.
3. WHILE the App is NOT in Authenticated_State, THE App SHALL NOT display the Logout_Action.
4. IF the invocation of `Auth_Service.logout()` fails to initiate, THEN THE App SHALL remain in Authenticated_State and display the Auth_Error_Banner with a message indicating that logout could not be started.

### Requirement 4: Reflect signed-in user identity

**User Story:** As a signed-in user, I want to see who I am signed in as, so that I can confirm my identity.

#### Acceptance Criteria

1. WHILE the App is in Authenticated_State AND `Auth_Service.user$` emits a value with a non-empty name, THE Auth_Control SHALL display the name as the User_Identifier.
2. WHILE the App is in Authenticated_State AND `Auth_Service.user$` emits a value with no non-empty name but a non-empty email, THE Auth_Control SHALL display the email as the User_Identifier.
3. IF the App is in Authenticated_State AND `Auth_Service.user$` emits a value with neither a non-empty name nor a non-empty email, THEN THE Auth_Control SHALL display the Logout_Action without a User_Identifier.
4. IF the App is in Authenticated_State AND `Auth_Service.user$` has not yet emitted a value, THEN THE Auth_Control SHALL display the Logout_Action without a User_Identifier until a value is emitted.

### Requirement 5: Integrate with the Monthly View authentication banner

**User Story:** As a user who sees the "please log in" banner on the Monthly View, I want an accessible way to log in, so that I can gain access to the services.

#### Acceptance Criteria

1. WHILE the Auth_Error_Banner is shown on the Monthly View, THE App SHALL keep the Login_Action visible in the Nav_Bar and reachable by both pointer activation and keyboard focus traversal.
2. WHEN a user completes authentication after activating the Login_Action from Unauthenticated_State, THE App SHALL enter Authenticated_State on return from Auth0, dismiss the Auth_Error_Banner, and display the User_Identifier in the Nav_Bar.
3. WHILE the App is in Loading_State during the return from Auth0, THE App SHALL indicate authentication is in progress and disable the Login_Action to prevent repeat activation.
4. IF authentication fails or is cancelled on return from Auth0, THEN THE App SHALL remain in Unauthenticated_State, keep the Auth_Error_Banner shown on the Monthly View, and present an error indication that authentication did not complete.
