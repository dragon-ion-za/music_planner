import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '@auth0/auth0-angular';
import { Service, SlotInput, CreateServicePayload } from '../models/service.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ServicesApiService {
  constructor(private auth: AuthService, private http: HttpClient) {}

  private withToken<T>(req: (token: string) => Observable<T>): Observable<T> {
    return this.auth.getAccessTokenSilently().pipe(
      switchMap(token => req(token))
    );
  }

  private buildUrl(path: string): string {
    const base = environment.apiBaseUrl;
    if (!base) {
      return path;
    }
    return base.replace(/\/$/, '') + path;
  }

  getServices(from: string, to: string): Observable<Service[]> {
    return this.withToken(token =>
      this.http.get<Service[]>(this.buildUrl(`/api/services`), {
        params: { from, to },
        headers: { Authorization: `Bearer ${token}` }
      })
    );
  }

  updateServiceSlots(serviceId: string, slots: SlotInput[]): Observable<Service> {
    return this.withToken(token =>
      this.http.put<Service>(this.buildUrl(`/api/services/${serviceId}`), { slots }, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );
  }

  createService(payload: CreateServicePayload): Observable<Service> {
    return this.withToken(token =>
      this.http.post<Service>(this.buildUrl('/api/services'), payload, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );
  }
}
