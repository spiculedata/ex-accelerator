import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jobStateStore, type JobState } from '$lib/services/jobStateStore.js';

/**
 * Job State API - Dedicated endpoint for managing job state updates
 * Used by the telegram-scraper and other crawlers to update job execution status
 */

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, jobId, ...data } = await request.json();

		if (!action || !jobId) {
			return error(400, 'action and jobId are required');
		}

		switch (action) {
			case 'start':
				await jobStateStore.updateJobStatus(jobId, 'running', {
					result: {
						success: true,
						message: 'Job execution started'
					}
				});
				await jobStateStore.addJobLog(jobId, 'Job execution started');
				break;

			case 'progress':
				const { itemsProcessed, message } = data;
				await jobStateStore.updateJobStatus(jobId, 'running', {
					result: {
						success: true,
						message: message || 'Job in progress',
						itemsProcessed: itemsProcessed || 0
					}
				});
				if (message) {
					await jobStateStore.addJobLog(jobId, message);
				}
				break;

			case 'complete':
				const { itemsProcessed: completedItems, message: completionMessage } = data;
				await jobStateStore.updateJobStatus(jobId, 'completed', {
					result: {
						success: true,
						message: completionMessage || 'Job completed successfully',
						itemsProcessed: completedItems || 0
					}
				});
				await jobStateStore.addJobLog(jobId, completionMessage || 'Job completed successfully');
				break;

			case 'fail':
				const { error: jobError, errors } = data;
				await jobStateStore.updateJobStatus(jobId, 'failed', {
					result: {
						success: false,
						message: jobError || 'Job failed',
						errors: errors || []
					}
				});
				await jobStateStore.addJobLog(jobId, `Job failed: ${jobError || 'Unknown error'}`);
				break;

			case 'log':
				const { logMessage } = data;
				if (logMessage) {
					await jobStateStore.addJobLog(jobId, logMessage);
				}
				break;

			default:
				return error(400, `Unknown action: ${action}`);
		}

		return json({ success: true, action, jobId });
	} catch (err) {
		console.error('Job state update error:', err);
		return error(500, 'Internal server error while updating job state');
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const jobId = url.searchParams.get('jobId');
		const status = url.searchParams.get('status');

		if (jobId) {
			// Get specific job state
			const jobState = await jobStateStore.getJobState(jobId);
			if (!jobState) {
				return error(404, 'Job not found');
			}
			return json(jobState);
		} else if (status) {
			// Get jobs by status
			const jobs = await jobStateStore.getJobsByStatus(status as JobState['status']);
			return json(jobs);
		} else {
			// Get all job states
			const allJobs = await jobStateStore.getAllJobStates();
			return json(allJobs);
		}
	} catch (err) {
		console.error('Job state retrieval error:', err);
		return error(500, 'Internal server error while retrieving job state');
	}
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const { jobId, status, ...additionalData } = await request.json();

		if (!jobId || !status) {
			return error(400, 'jobId and status are required');
		}

		await jobStateStore.updateJobStatus(jobId, status, additionalData);
		
		return json({ success: true, jobId, status });
	} catch (err) {
		console.error('Job state update error:', err);
		return error(500, 'Internal server error while updating job state');
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const jobId = url.searchParams.get('jobId');
		
		if (!jobId) {
			return error(400, 'jobId is required for deletion');
		}

		await jobStateStore.deleteJobState(jobId);
		
		return json({ success: true, message: `Job state ${jobId} deleted successfully` });
	} catch (err) {
		console.error('Job state deletion error:', err);
		return error(500, 'Internal server error while deleting job state');
	}
};