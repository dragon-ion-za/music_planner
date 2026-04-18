import * as fc from 'fast-check';
import request from 'supertest';

jest.mock('express-oauth2-jwt-bearer', () => {
  class UnauthorizedError extends Error {
    status = 401;
    statusCode = 401;
    headers: Record<string, string> = { 'WWW-Authenticate': 'Bearer realm="api"' };
    constructor(message: string) {
      super(message);
      this.name = 'UnauthorizedError';
    }
  }
  return {
    auth: () => (req: any, _res: any, next: any) => {
      const payload = (global as any).__mockAuthPayload;
      if (!payload) return next(new UnauthorizedError('Unauthorized'));
      req.auth = { payload };
      next();
    },
    UnauthorizedError,
  };
});

jest.mock('../../repositories/ServiceRepository');
jest.mock('../../models/associations', () => ({ initAssociations: jest.fn() }));

import { ServiceRepository } from '../../repositories/ServiceRepository';
import { app } from '../app';

const CLAIM_KEY = 'https://music-planner.app/congregation_id';

function setAuthPayload(payload: Record<string, unknown> | null): void {
  (global as any).__mockAuthPayload = payload;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const dateArbitrary = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31'), noInvalidDate: true })
  .map(d => d.toISOString().slice(0, 10));

const invalidDateArbitrary = fc.string().filter(s => !DATE_RE.test(s));
const nonBlankStringArbitrary = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const serviceArbitrary = fc.record({
  id: fc.uuid(),
  congregationId: fc.uuid(),
  serviceDate: dateArbitrary,
  serviceType: fc.string({ minLength: 1 }),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const slotInputArbitrary = fc.record({
  slotKey: fc.string({ minLength: 1 }),
  songId: fc.option(fc.uuid(), { nil: null }),
});
beforeEach(() => {
  jest.clearAllMocks();
  setAuthPayload({ [CLAIM_KEY]: 'default-cong-id' });
});

afterAll(() => {
  delete (global as any).__mockAuthPayload;
});

describe('Property 3: Congregation scoping invariant', () => {
  it('GET — findByCongregation is always called with the token congregation_id, never a query-param override', async () => {
    // Feature: service-api, Property 3: Congregation scoping invariant
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.uuid(), async (tokenCongId, overrideCongId) => {
        fc.pre(tokenCongId !== overrideCongId);
        setAuthPayload({ [CLAIM_KEY]: tokenCongId });
        (ServiceRepository.findByCongregation as jest.Mock).mockResolvedValue([]);
        await request(app).get(`/api/services?congregationId=${overrideCongId}`).set('Authorization', 'Bearer token');
        const calls = (ServiceRepository.findByCongregation as jest.Mock).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const calledWith = calls[calls.length - 1][0];
        expect(calledWith).toBe(tokenCongId);
        expect(calledWith).not.toBe(overrideCongId);
      }),
      { numRuns: 100 },
    );
  });

  it('POST — Service.create is always called with the token congregation_id, never a body override', async () => {
    // Feature: service-api, Property 3: Congregation scoping invariant
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.uuid(), dateArbitrary, nonBlankStringArbitrary,
        async (tokenCongId, overrideCongId, serviceDate, serviceType) => {
          fc.pre(tokenCongId !== overrideCongId);
          setAuthPayload({ [CLAIM_KEY]: tokenCongId });
          const created = { id: 'svc-1', congregationId: tokenCongId, serviceDate, serviceType };
          (ServiceRepository.create as jest.Mock).mockResolvedValue(created);
          await request(app).post('/api/services').set('Authorization', 'Bearer token').send({ serviceDate, serviceType, congregationId: overrideCongId });
          const calls = (ServiceRepository.create as jest.Mock).mock.calls;
          expect(calls.length).toBeGreaterThan(0);
          const [calledCongId] = calls[calls.length - 1];
          expect(calledCongId).toBe(tokenCongId);
          expect(calledCongId).not.toBe(overrideCongId);
        }),
      { numRuns: 100 },
    );
  });
});

describe('Property 4: GET returns repository results as 200 JSON array', () => {
  it('responds 200 and body deep-equals the array returned by the repository', async () => {
    // Feature: service-api, Property 4: GET returns repository results as 200 JSON array
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ id: fc.uuid(), congregationId: fc.uuid(), serviceDate: fc.string(), serviceType: fc.string() }), { maxLength: 10 }),
        async services => {
          (ServiceRepository.findByCongregation as jest.Mock).mockResolvedValue(services);
          const res = await request(app).get('/api/services').set('Authorization', 'Bearer token');
          expect(res.status).toBe(200);
          expect(res.body).toEqual(services);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 5: Date range is forwarded to the repository unchanged', () => {
  it('findByCongregation is called with exactly { from, to } matching the query params', async () => {
    // Feature: service-api, Property 5: Date range is forwarded to the repository unchanged
    await fc.assert(
      fc.asyncProperty(dateArbitrary, dateArbitrary, async (from, to) => {
        (ServiceRepository.findByCongregation as jest.Mock).mockResolvedValue([]);
        await request(app).get(`/api/services?from=${from}&to=${to}`).set('Authorization', 'Bearer token');
        const calls = (ServiceRepository.findByCongregation as jest.Mock).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[calls.length - 1][1]).toEqual({ from, to });
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 6: Invalid date strings produce 400', () => {
  it('GET with invalid from returns 400 with error field', async () => {
    // Feature: service-api, Property 6: Invalid date strings produce 400
    await fc.assert(
      fc.asyncProperty(invalidDateArbitrary, async invalidDate => {
        const res = await request(app).get(`/api/services?from=${encodeURIComponent(invalidDate)}&to=2025-01-01`).set('Authorization', 'Bearer token');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      }),
      { numRuns: 100 },
    );
  });

  it('POST with invalid serviceDate returns 400 with error field', async () => {
    // Feature: service-api, Property 6: Invalid date strings produce 400
    await fc.assert(
      fc.asyncProperty(invalidDateArbitrary, async invalidDate => {
        const res = await request(app).post('/api/services').set('Authorization', 'Bearer token').send({ serviceDate: invalidDate, serviceType: 'Sunday Service' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 7: Successful POST returns 201 with the created service', () => {
  it('returns 201 and body.congregationId equals the token congregation_id', async () => {
    // Feature: service-api, Property 7: Successful POST returns 201 with the created service
    await fc.assert(
      fc.asyncProperty(fc.uuid(), dateArbitrary, nonBlankStringArbitrary, async (tokenCongId, serviceDate, serviceType) => {
        setAuthPayload({ [CLAIM_KEY]: tokenCongId });
        const created = { id: 'svc-1', congregationId: tokenCongId, serviceDate, serviceType };
        (ServiceRepository.create as jest.Mock).mockResolvedValue(created);
        const res = await request(app).post('/api/services').set('Authorization', 'Bearer token').send({ serviceDate, serviceType });
        expect(res.status).toBe(201);
        expect(res.body.congregationId).toBe(tokenCongId);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 8: Missing required POST fields produce 400', () => {
  it('returns 400 with error field for any body missing serviceDate or serviceType', async () => {
    // Feature: service-api, Property 8: Missing required POST fields produce 400
    const invalidBodyArbitrary = fc.oneof(
      fc.constant({}),
      fc.record({ serviceType: fc.string() }),
      fc.record({ serviceDate: dateArbitrary }),
      fc.record({ serviceDate: dateArbitrary, serviceType: fc.constant('') }),
      fc.record({ serviceDate: dateArbitrary, serviceType: fc.string().filter(s => !s.trim()) }),
    );
    await fc.assert(
      fc.asyncProperty(invalidBodyArbitrary, async body => {
        const res = await request(app).post('/api/services').set('Authorization', 'Bearer token').send(body);
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 9: All error responses carry an error string field', () => {
  it('every error path returns a body with a non-empty error string', async () => {
    // Feature: service-api, Property 9: All error responses carry an error string field
    await fc.assert(
      fc.asyncProperty(fc.constantFrom('no-auth', 'no-claim', 'bad-date-get', 'missing-date-post', 'missing-type-post'), async scenario => {
        let res: request.Response;
        switch (scenario) {
          case 'no-auth': setAuthPayload(null); res = await request(app).get('/api/services'); break;
          case 'no-claim': setAuthPayload({ sub: 'user-1' }); res = await request(app).get('/api/services').set('Authorization', 'Bearer token'); break;
          case 'bad-date-get': res = await request(app).get('/api/services?from=not-a-date&to=2025-01-01').set('Authorization', 'Bearer token'); break;
          case 'missing-date-post': res = await request(app).post('/api/services').set('Authorization', 'Bearer token').send({ serviceType: 'Sunday Service' }); break;
          default: res = await request(app).post('/api/services').set('Authorization', 'Bearer token').send({ serviceDate: '2025-01-01' }); break;
        }
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 10: Error responses do not leak internal details', () => {
  it('response body does not contain stack trace patterns or Sequelize class names', async () => {
    // Feature: service-api, Property 10: Error responses do not leak internal details
    await fc.assert(
      fc.asyncProperty(fc.string(), async msg => {
        (ServiceRepository.findByCongregation as jest.Mock).mockRejectedValue(new Error(msg));
        const res = await request(app).get('/api/services').set('Authorization', 'Bearer token');
        const bodyStr = JSON.stringify(res.body);
        expect(bodyStr).not.toMatch(/at\s+\w/);
        expect(bodyStr).not.toContain('Error:');
        expect(bodyStr).not.toMatch(/Sequelize\w*/);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 11: Unhandled errors produce 500', () => {
  it('any error thrown inside the GET handler results in 500 with an error field', async () => {
    // Feature: service-api, Property 11: Unhandled errors produce 500
    const errorArbitrary = fc.oneof(
      fc.string().map(msg => new Error(msg)),
      fc.constant(new TypeError('type error')),
      fc.constant(new RangeError('range error')),
    );
    await fc.assert(
      fc.asyncProperty(errorArbitrary, async err => {
        (ServiceRepository.findByCongregation as jest.Mock).mockRejectedValue(err);
        const res = await request(app).get('/api/services').set('Authorization', 'Bearer token');
        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
      }),
      { numRuns: 100 },
    );
  });
});
