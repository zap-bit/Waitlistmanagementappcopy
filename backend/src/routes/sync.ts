import { Router } from 'express';

export const syncRouter = Router();

syncRouter.post('/', (req, res) => {
  const operations = req.body?.operations ?? [];

  res.json({
    synced: operations.length,
    conflicts: [],
    resolvedAt: new Date().toISOString(),
  });
});
