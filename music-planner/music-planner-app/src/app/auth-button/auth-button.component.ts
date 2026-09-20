import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '@auth0/auth0-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthErrorState } from '../auth-error-state.service';

// From @auth0/auth0-angular (relevant subset)
export interface User {
  name?: string;
  email?: string;
  // ...other OIDC claims
  [key: string]: unknown;
}

/**
 * Derives the User_Identifier per Requirement 4.
 * - Non-empty name  -> name          (4.1)
 * - Else non-empty email -> email    (4.2)
 * - Else -> null (no identifier)     (4.3)
 * - user null/undefined -> null      (4.4)
 * "Non-empty" means the value contains at least one non-whitespace character.
 */
export function deriveUserIdentifier(user: User | null | undefined): string | null {
  if (!user) {
    return null;
  }
  const name = user.name?.trim();
  if (name) {
    return name;
  }
  const email = user.email?.trim();
  if (email) {
    return email;
  }
  return null;
}

/**
 * Auth_Control rendered in the App's top navigation bar. Reflects the current
 * Auth0 authentication state (loading / signed-out / signed-in) and drives the
 * login-redirect and logout flows through the shared {@link AuthService}.
 */
@Component({
  selector: 'app-auth-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './auth-button.component.html',
  styleUrl: './auth-button.component.css',
})
export class AuthButtonComponent {
  /** Emits `true` while Auth0 has not yet resolved authentication state (Req 1.2). */
  readonly isLoading$: Observable<boolean>;

  /** Emits the current authentication state (Req 1.3, 1.4). */
  readonly isAuthenticated$: Observable<boolean>;

  /** Derived User_Identifier — trimmed name, trimmed email, or `null` (Req 4.1–4.4). */
  readonly userIdentifier$: Observable<string | null>;

  /** Guards against repeat activation while a login redirect is in progress (Req 2.5). */
  loginInProgress = false;

  constructor(private auth: AuthService, private authErrors: AuthErrorState) {
    this.isLoading$ = this.auth.isLoading$;
    this.isAuthenticated$ = this.auth.isAuthenticated$;
    this.userIdentifier$ = this.auth.user$.pipe(map(deriveUserIdentifier));
  }

  /**
   * Initiates the Auth0 login redirect (Req 2.1).
   *
   * Ignores repeat activations while a redirect is already starting (Req 2.5,
   * 5.3). If the redirect fails to initiate, resets {@link loginInProgress} so
   * the control stays in the Unauthenticated_State and signals the failure so
   * the Auth_Error_Banner can surface it (Req 2.4).
   */
  login(): void {
    if (this.loginInProgress) {
      return;
    }
    this.loginInProgress = true;
    this.auth.loginWithRedirect().subscribe({
      error: () => {
        this.loginInProgress = false;
        this.authErrors.raise('Login could not be started.');
      },
    });
  }

  /**
   * Initiates the Auth0 logout flow, returning to the App origin (Req 3.1).
   *
   * `logout()` is fire-and-forget in the SDK; if it throws, the control remains
   * in the Authenticated_State (`isAuthenticated$` is unchanged) and the failure
   * is signalled so the Auth_Error_Banner can surface it (Req 3.4).
   */
  logout(): void {
    try {
      this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
    } catch {
      this.authErrors.raise('Logout could not be started.');
    }
  }
}
