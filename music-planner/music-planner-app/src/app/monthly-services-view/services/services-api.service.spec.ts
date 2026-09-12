// Feature: monthly-services-view, Property 4: Bearer token is attached to every API request
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';
import fc from 'fast-check';
import { ServicesApiService } from './services-api.service';
import { AuthService } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';

// URL composition mirrors ServicesApiService.buildUrl: empty base -> relative path,
// otherwise the base URL (with a single trailing slash stripped) prepended to the path.
const expectedUrl = (path: string): string => {
  const base = environment.apiBaseUrl;
  return base ? base.replace(/\/$/, '') + path : path;
};

describe('ServicesApiService', () => {
  let service: ServicesApiService;
  let httpMock: HttpTestingController;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['getAccessTokenSilently']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ServicesApiService,
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });

    service = TestBed.inject(ServicesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /**
   * Property 4: Bearer token is attached to every API request
   * Validates: Requirements 3.6, 9.1
   */
  it('P4: attaches Bearer token to getServices requests for any token string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        (token) => {
          authServiceSpy.getAccessTokenSilently.and.returnValue(of(token) as any);

          service.getServices('2024-01-01', '2024-01-31').subscribe();

          const req = httpMock.expectOne(r => r.url === expectedUrl('/api/services'));
          expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
          req.flush([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P4: attaches Bearer token to updateServiceSlots requests for any token string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.uuid(),
        (token, serviceId) => {
          authServiceSpy.getAccessTokenSilently.and.returnValue(of(token) as any);

          service.updateServiceSlots(serviceId, []).subscribe();

          const req = httpMock.expectOne(r => r.url === expectedUrl(`/api/services/${serviceId}`));
          expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
          req.flush({});
        }
      ),
      { numRuns: 100 }
    );
  });
});
