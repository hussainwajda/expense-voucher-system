import { Router } from 'express';
import { currentUser } from '../../middleware/authenticate.js';
import { getDashboard } from './dashboard.service.js';

export const dashboardRouter = Router();

/** Returns the dashboard for the caller's role (see README for the payload of each). */
dashboardRouter.get('/', async (req, res) => {
  res.json(await getDashboard(currentUser(req)));
});
