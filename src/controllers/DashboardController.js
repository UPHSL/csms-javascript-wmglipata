import { DashboardService } from '../services/DashboardService.js';

export class DashboardController {
  constructor() {
    this.dashboardService = new DashboardService();
  }

  // GET /dashboard
  index(req, res) {
    try {
      const summary = this.dashboardService.getDashboardSummary();
      res.render('dashboard/index', { summary });
    } catch (error) {
      // 🚨 Print the actual error to the terminal so we can see it!
      console.error('\n--- DASHBOARD ERROR ---');
      console.error(error);
      console.error('-----------------------\n');
      
      // Safe error fallback
      res.status(500).send('An error occurred while loading the dashboard.');
    }
  }
}