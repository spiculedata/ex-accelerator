import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jobStateStore } from '$lib/services/jobStateStore.js';

const DAPR_HTTP_PORT = 3500;
const TELEGRAM_SCRAPER_APP_ID = 'telegram-scraper';

interface JobScheduleRequest {
	name: string;
	dueTime: string;
	data: {
		droid: string;
		task: string;
		urls?: string[];
		urlFile?: string;
		platform: 'telegram' | 'youtube';
		crawlId?: string;
		maxDepth?: number;
		concurrency?: number;
		maxPosts?: number;
		youtubeApiKey?: string;
		samplingMethod?: string;
		minChannelVideos?: number;
		sampleSize?: number;
		minPostDate?: string;
		dateBetweenMin?: string;
		dateBetweenMax?: string;
		tdlibDatabaseUrls?: string[];
		maxPages?: number;
		skipMedia?: boolean;
		timeAgo?: string;
	};
}

interface JobStatusResponse {
	name: string;
	dueTime: string;
	data: any;
	status?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const jobRequest: JobScheduleRequest = await request.json();

		if (!jobRequest.name || !jobRequest.dueTime || !jobRequest.data) {
			return error(400, 'Missing required fields: name, dueTime, data');
		}

		if (!jobRequest.data.task || !jobRequest.data.task.toLowerCase().includes('crawl')) {
			return error(400, 'Job task must contain "crawl"');
		}

		if (!jobRequest.data.urls && !jobRequest.data.urlFile) {
			return error(400, 'Either urls or urlFile must be provided');
		}

		if (jobRequest.data.platform === 'youtube' && !jobRequest.data.youtubeApiKey) {
			return error(400, 'YouTube API key is required for YouTube platform');
		}

		// Use the working job scheduling format - job name in URL, no name in body
		const daprJobsUrl = `http://localhost:3502/v1.0-alpha1/jobs/${jobRequest.name}`;
		
		// Remove name from request body since it goes in URL
		const { name, ...jobBody } = jobRequest;

		// Create job state before scheduling
		const jobId = `${jobRequest.name}-${Date.now()}`;
		const scheduledFor = new Date(Date.now() + (jobRequest.dueTime.endsWith('s') ? 
			parseInt(jobRequest.dueTime.slice(0, -1)) * 1000 : 
			parseInt(jobRequest.dueTime.slice(0, -1)) * 60 * 1000
		)).toISOString();

		const jobState = jobStateStore.createJobState(
			jobId,
			jobRequest.name,
			scheduledFor,
			jobRequest.data.platform,
			jobRequest.data
		);

		// Save job state to store
		await jobStateStore.saveJobState(jobState);

		const response = await fetch(daprJobsUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				...jobBody,
				data: {
					...jobBody.data,
					jobId, // Add jobId to the job data for tracking
				}
			}),
		});

		if (!response.ok) {
			// If scheduling fails, update job state to failed
			await jobStateStore.updateJobStatus(jobId, 'failed', {
				result: {
					success: false,
					message: 'Failed to schedule job with Dapr',
					errors: [await response.text()]
				}
			});

			const errorText = await response.text();
			console.error('Dapr Jobs API error:', errorText);
			return error(response.status, `Failed to schedule job: ${errorText}`);
		}

		// Update job state to indicate successful scheduling
		await jobStateStore.addJobLog(jobId, 'Job successfully scheduled with Dapr');

		let result;
		try {
			const responseText = await response.text();
			result = responseText ? JSON.parse(responseText) : {};
		} catch (e) {
			result = {};
		}

		return json({ 
			success: true, 
			job: result,
			jobId,
			jobState
		});
	} catch (err) {
		console.error('Job scheduling error:', err);
		return error(500, 'Internal server error while scheduling job');
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const jobName = url.searchParams.get('name');
		const stateOnly = url.searchParams.get('state') === 'true';
		
		// If requesting state only, return from state store
		if (stateOnly) {
			if (jobName) {
				const jobState = await jobStateStore.getJobState(jobName);
				return json(jobState);
			} else {
				const allJobStates = await jobStateStore.getAllJobStates();
				return json(allJobStates);
			}
		}

		// Get from Dapr Jobs API
		let daprJobsUrl = `http://localhost:3502/v1.0-alpha1/jobs`;
		if (jobName) {
			daprJobsUrl += `/${jobName}`;
		}

		const response = await fetch(daprJobsUrl);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Dapr Jobs API error:', errorText);
			return error(response.status, `Failed to get job(s): ${errorText}`);
		}

		const daprJobs = await response.json();
		
		// Also get job states from state store
		const jobStates = await jobStateStore.getAllJobStates();
		
		// Combine Dapr job info with state store data
		return json({
			daprJobs,
			jobStates,
			combined: jobStates.map(state => ({
				...state,
				daprInfo: Array.isArray(daprJobs) ? 
					daprJobs.find((dj: any) => dj.name === state.name) : 
					(daprJobs.name === state.name ? daprJobs : null)
			}))
		});
	} catch (err) {
		console.error('Job retrieval error:', err);
		return error(500, 'Internal server error while retrieving job(s)');
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const jobName = url.searchParams.get('name');
		const jobId = url.searchParams.get('jobId');
		
		if (!jobName && !jobId) {
			return error(400, 'Job name or jobId is required for deletion');
		}

		// Delete from Dapr Jobs API if jobName provided
		if (jobName) {
			const daprJobsUrl = `http://localhost:3502/v1.0-alpha1/jobs/${jobName}`;

			const response = await fetch(daprJobsUrl, {
				method: 'DELETE',
			});

			if (!response.ok && response.status !== 404) {
				const errorText = await response.text();
				console.error('Dapr Jobs API error:', errorText);
				return error(response.status, `Failed to delete job: ${errorText}`);
			}
		}

		// Delete from state store
		let stateDeleted = false;
		if (jobId) {
			// Direct jobId provided
			try {
				await jobStateStore.deleteJobState(jobId);
				stateDeleted = true;
			} catch (stateError) {
				console.warn('Could not delete job state:', stateError);
			}
		} else if (jobName) {
			// Need to find jobId by job name
			try {
				const allJobStates = await jobStateStore.getAllJobStates();
				const jobState = allJobStates.find(state => state.name === jobName);
				
				if (jobState) {
					await jobStateStore.deleteJobState(jobState.id);
					stateDeleted = true;
				} else {
					console.warn(`Job state not found for job name: ${jobName}`);
				}
			} catch (stateError) {
				console.warn('Could not delete job state:', stateError);
			}
		}

		return json({ 
			success: true, 
			message: `Job ${jobName || jobId} deleted successfully`,
			deletedFromDapr: !!jobName,
			deletedFromState: stateDeleted
		});
	} catch (err) {
		console.error('Job deletion error:', err);
		return error(500, 'Internal server error while deleting job');
	}
};