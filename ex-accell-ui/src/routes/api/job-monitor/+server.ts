import type { RequestHandler } from './$types';
import { apiOk, apiServerError } from '$lib/server/apiResponse';
import { jobStateStore } from '$lib/services/jobStateStore.js';

const UPCOMING_LIMIT = 5;
const MS_PER_MINUTE = 60 * 1000;

/** GET /api/job-monitor: which scheduled jobs are overdue and which run next. */
export const GET: RequestHandler = async () => {
	try {
		const allJobs = await jobStateStore.getAllJobStates();
		const now = new Date();
		const minutesFrom = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / MS_PER_MINUTE);

		const scheduledJobs = allJobs.filter((job) => job.status === 'scheduled');
		const overdueJobs = scheduledJobs.filter((job) => new Date(job.scheduledFor) < now);
		const upcoming = [...scheduledJobs]
			.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
			.slice(0, UPCOMING_LIMIT);

		const report = {
			timestamp: now.toISOString(),
			totalJobs: allJobs.length,
			scheduledJobs: scheduledJobs.length,
			overdueJobs: overdueJobs.length,
			overdue: overdueJobs.map((job) => ({
				name: job.name,
				scheduledFor: job.scheduledFor,
				delayMinutes: minutesFrom(new Date(job.scheduledFor), now)
			})),
			upcoming: upcoming.map((job) => ({
				name: job.name,
				scheduledFor: job.scheduledFor,
				status: job.status,
				minutesToExecution: minutesFrom(now, new Date(job.scheduledFor))
			}))
		};
		return apiOk(report, report);
	} catch (err) {
		return apiServerError('GET /api/job-monitor', err, 'Failed to read job state');
	}
};
