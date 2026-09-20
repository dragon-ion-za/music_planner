import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Lightweight shared channel for surfacing authentication *initiation* failures
 * (a failed `loginWithRedirect()` or a `logout()` that throws) that do not flow
 * through Auth0's `AuthService.error$`.
 *
 * `AuthButtonComponent` writes to it on its login/logout error branches, and
 * `MonthlyServicesViewComponent` reads {@link message$} to raise the
 * Auth_Error_Banner — avoiding shell↔child coupling (design "Error Handling",
 * option 2). Requirements 2.4, 3.4.
 */
@Injectable({ providedIn: 'root' })
export class AuthErrorState {
  private readonly _message$ = new BehaviorSubject<string | null>(null);

  /** Emits the latest auth-failure message, or `null` when there is none. */
  readonly message$: Observable<string | null> = this._message$.asObservable();

  /** Signals an authentication-initiation failure with a display message. */
  raise(message: string): void {
    this._message$.next(message);
  }

  /** Clears any active auth-failure message. */
  clear(): void {
    this._message$.next(null);
  }
}
