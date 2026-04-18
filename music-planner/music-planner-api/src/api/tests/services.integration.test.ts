import request from 'supertest';
import { UniqueConstraintError } from 'sequelize';

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

const mockRepo = ServiceRepository as jest.Mocked<typeof ServiceRepository>;

const CONG_ID = 'cong-uuid-1';
const OTHER_CONG_ID = 'cong-uuid-2';
const SERVICE_ID = 'service-uuid-1';

function setAuthPayload(payload: Record<string, unknown> | null): void {
  (global as any).__mockAuthPayload = payload;
}

beforeEach(() => {
  jest.clearAllMocks();
  setAuthPayload({ 'https://music-planner.app/congregation_id': CONG_ID });
});

afterAll(() => {
  delete (global as any).__mockAuthPayload;
});

describe('GET /api/services', () => {
  it('12.2: returns 401 when no Authorization header', async () => {
    setAuthPayload(null);
    const res = await request(app).get('/api/services');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('12.3: returns 403 when token has no congregation_id claim', async () => {
    setAuthPayload({ sub: 'user-1' });
    const res = await request(app).get('/api/services').set('Authorization', 'Bearer token');
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('12.4: returns 400 when from is provided without to', async () => {
    const res = await request(app).get('/api/services?from=2025-01-01').set('Authorization', 'Bearer token');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 200 with services array', async () => {
    const fakeServices = [{ id: SERVICE_ID, congregationId: CONG_ID }];
    mockRepo.findByCongregation = jest.fn().mockResolvedValue(fakeServices);
    const res = await request(app).get('/api/services').set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(fakeServices);
  });
});

describe('POST /api/services', () => {
  it('12.5: returns 400 when serviceDate is missing', async () => {
    const res = await request(app).post('/api/services').set('Authorization', 'Bearer token').send({ serviceType: 'Sunday Service' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('12.6: returns 400 when serviceType is missing', async () => {
    const res = await request(app).post('/api/services').set('Authorization', 'Bearer token').send({ serviceDate: '2025-04-06' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('12.7: returns 409 when UniqueConstraintError is thrown', async () => {
    mockRepo.create = jest.fn().mockRejectedValue(new UniqueConstraintError({}));
    const res = await request(app).post('/api/services').set('Authorization', 'Bearer token').send({ serviceDate: '2025-04-06', serviceType: 'Sunday Service' });
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('12.8: creates ServiceSlot rows for matched slotKeys, ignores unknown keys, returns 201', async () => {
    const createdSlot = { id: 'slot-1', slotTemplateId: 'template-1', songId: 'song-uuid' };
    const fullService = { id: SERVICE_ID, congregationId: CONG_ID, serviceDate: '2025-04-06', serviceType: 'Sunday Service', serviceSlots: [createdSlot] };

    mockRepo.create = jest.fn().mockResolvedValue(fullService);

    const res = await request(app).post('/api/services').set('Authorization', 'Bearer token').send({
      serviceDate: '2025-04-06',
      serviceType: 'Sunday Service',
      slots: [{ slotKey: 'orchestra1', songId: 'song-uuid' }, { slotKey: 'unknownKey' }],
    });

    expect(res.status).toBe(201);
    expect(mockRepo.create).toHaveBeenCalledWith(
      CONG_ID,
      '2025-04-06',
      'Sunday Service',
      [{ slotKey: 'orchestra1', songId: 'song-uuid' }, { slotKey: 'unknownKey' }],
    );
    expect(res.body.serviceSlots).toHaveLength(1);
  });
});

describe('PUT /api/services/:id', () => {
  it('12.9: returns 404 when service does not exist', async () => {
    mockRepo.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app).put(`/api/services/${SERVICE_ID}`).set('Authorization', 'Bearer token').send({ slots: [] });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('12.10: returns 403 when service belongs to a different congregation', async () => {
    mockRepo.findById = jest.fn().mockResolvedValue({ id: SERVICE_ID, congregationId: OTHER_CONG_ID, serviceType: 'Sunday Service' });
    const res = await request(app).put(`/api/services/${SERVICE_ID}`).set('Authorization', 'Bearer token').send({ slots: [] });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('12.11: upserts slots and returns full updated service', async () => {
    const service = { id: SERVICE_ID, congregationId: CONG_ID, serviceType: 'Sunday Service' };
    const updatedService = { ...service, serviceSlots: [{ id: 'slot-1' }, { id: 'slot-2' }] };

    mockRepo.findById = jest.fn().mockResolvedValue(service);
    mockRepo.upsertSlots = jest.fn().mockResolvedValue(updatedService);

    const res = await request(app).put(`/api/services/${SERVICE_ID}`).set('Authorization', 'Bearer token').send({
      slots: [{ slotKey: 'orchestra1', songId: 'new-song' }, { slotKey: 'choir1', songId: null }],
    });

    expect(res.status).toBe(200);
    expect(mockRepo.upsertSlots).toHaveBeenCalledWith(
      service,
      CONG_ID,
      [{ slotKey: 'orchestra1', songId: 'new-song' }, { slotKey: 'choir1', songId: null }],
    );
    expect(res.body.serviceSlots).toHaveLength(2);
  });
});

describe('CORS', () => {
  it('12.12: OPTIONS preflight returns 204 with CORS headers', async () => {
    const res = await request(app).options('/api/services').set('Origin', 'http://localhost:4200').set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});

describe('Error handling', () => {
  it('12.13: unhandled error returns 500 with no stack trace in body', async () => {
    mockRepo.findByCongregation = jest.fn().mockRejectedValue(new Error('boom'));
    const res = await request(app).get('/api/services').set('Authorization', 'Bearer token');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(JSON.stringify(res.body)).not.toMatch(/at\s+\w/);
    expect(JSON.stringify(res.body)).not.toContain('Error:');
  });
});
