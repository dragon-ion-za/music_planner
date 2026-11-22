import { Router, Request, Response, NextFunction } from 'express';
import { ServiceRepository, UnknownSongError } from '../../repositories/ServiceRepository';
import { initAssociations } from '../../models/associations';

initAssociations();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const servicesRouter = Router();

// GET /api/services
servicesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };

    if ((from && !to) || (!from && to)) {
      res.status(400).json({ error: 'Both from and to are required' });
      return;
    }
    if (from && !DATE_RE.test(from)) {
      res.status(400).json({ error: 'from must be in YYYY-MM-DD format' });
      return;
    }
    if (to && !DATE_RE.test(to)) {
      res.status(400).json({ error: 'to must be in YYYY-MM-DD format' });
      return;
    }

    const dateRange = from && to ? { from, to } : undefined;
    const services = await ServiceRepository.findByCongregation(req.congregationId, dateRange);
    res.status(200).json(services);
  } catch (err) {
    next(err);
  }
});

// POST /api/services
servicesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceDate, serviceType, slots } = req.body ?? {};

    if (!serviceDate) {
      res.status(400).json({ error: 'serviceDate is required' });
      return;
    }
    if (!DATE_RE.test(serviceDate)) {
      res.status(400).json({ error: 'serviceDate must be in YYYY-MM-DD format' });
      return;
    }
    if (!serviceType || !serviceType.trim()) {
      res.status(400).json({ error: 'serviceType is required' });
      return;
    }

    const created = await ServiceRepository.create(
      req.congregationId,
      serviceDate,
      serviceType,
      Array.isArray(slots) ? slots : undefined,
    );
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/services/:id
servicesRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await ServiceRepository.findById(req.params['id']);
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    if (service.congregationId !== req.congregationId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { serviceDate, serviceType, slots } = req.body ?? {};

    if (serviceDate !== undefined && (typeof serviceDate !== 'string' || !DATE_RE.test(serviceDate))) {
      res.status(400).json({ error: 'serviceDate must be in YYYY-MM-DD format' });
      return;
    }
    if (serviceType !== undefined && (typeof serviceType !== 'string' || !serviceType.trim())) {
      res.status(400).json({ error: 'serviceType must not be blank' });
      return;
    }

    try {
      const updated = await ServiceRepository.update(service, req.congregationId, {
        serviceDate,
        serviceType: serviceType?.trim(),
        slots: Array.isArray(slots) ? slots : undefined,
      });
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof UnknownSongError) {
        res.status(400).json({ error: `Unknown song number: ${err.songNumber}` });
        return;
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});
