import { Router } from 'express';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { email } = req.body ?? {};

  return res.json({
    token: `demo-token-${Date.now()}`,
    expiresIn: 86400,
    role: email?.includes('admin') ? 'staff' : 'staff',
  });
});
