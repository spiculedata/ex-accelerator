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
		// Core parameters
		maxDepth?: number;
		concurrency?: number;
		maxPosts?: number;
		maxPages?: number;
		// YouTube specific parameters
		youtubeApiKey?: string;
		samplingMethod?: string;
		minChannelVideos?: number;
		sampleSize?: number;
		// Date filtering parameters
		minPostDate?: string;
		dateBetweenMin?: string;
		dateBetweenMax?: string;
		timeAgo?: string;
		// Media and advanced options
		skipMedia?: boolean;
		tdlibDatabaseUrls?: string[];
		// Storage options
		storageRoot?: string;
		crawlLabel?: string;
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

		// Try to save job state to store (don't fail if this doesn't work)
		let jobStateSaved = false;
		try {
			await jobStateStore.saveJobState(jobState);
			jobStateSaved = true;
		} catch (stateError) {
			console.warn('Could not save job state (Dapr may not be running):', stateError.message);
			// Check if this is a Dapr connection error and provide helpful message
			if (stateError.name === 'DaprConnectionError') {
				return error(503, {
					message: 'Job scheduling service unavailable',
					details: stateError.message,
					action: 'Please start the unified deployment with: npm run dev:dapr'
				});
			}
		}

		// Use the working job scheduling format - job name in URL, no name in body
		const daprJobsUrl = `http://localhost:3502/v1.0-alpha1/jobs/${jobRequest.name}`;
		
		// Remove name from request body since it goes in URL
		const { name, ...jobBody } = jobRequest;

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
			// If scheduling fails, try to update job state to failed (if we could save it initially)
			if (jobStateSaved) {
				try {
					await jobStateStore.updateJobStatus(jobId, 'failed', {
						result: {
							success: false,
							message: 'Failed to schedule job with Dapr',
							errors: [await response.text()]
						}
					});
				} catch (stateError) {
					console.warn('Could not update job state after failure:', stateError);
				}
			}

			const errorText = await response.text();
			console.error('Dapr Jobs API error:', errorText);
			return error(response.status, `Failed to schedule job: ${errorText}`);
		}

		// Update job state to indicate successful scheduling (if we can)
		if (jobStateSaved) {
			try {
				await jobStateStore.addJobLog(jobId, 'Job successfully scheduled with Dapr');
			} catch (stateError) {
				console.warn('Could not add job log:', stateError);
			}
		}

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
			jobState: jobStateSaved ? jobState : null,
			message: jobStateSaved ? 'Job scheduled successfully' : 'Job scheduled (state tracking unavailable)'
		});
	} catch (err) {
		console.error('Job scheduling error:', err);
		
		// Don't catch SvelteKit error() responses - let them pass through
		if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
			throw err; // Re-throw SvelteKit error responses
		}
		
		// Check if this is a fetch error indicating Dapr isn't running
		if (err.message && err.message.includes('fetch failed')) {
			return error(503, {
				message: 'Job scheduling service unavailable',
				details: 'Cannot connect to Dapr job scheduler. Please ensure the unified deployment is running.',
				action: 'Run: npm run dev:dapr'
			});
		}
		return error(500, 'Internal server error while scheduling job');
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const jobName = url.searchParams.get('name');
		const stateOnly = url.searchParams.get('state') === 'true';
		
		// If requesting state only, return from state store
		if (stateOnly) {
			try {
				if (jobName) {
					const jobState = await jobStateStore.getJobState(jobName);
					return json(jobState);
				} else {
					const allJobStates = await jobStateStore.getAllJobStates();
					return json(allJobStates);
				}
			} catch (stateError) {
				if (stateError.name === 'DaprConnectionError') {
					return error(503, {
						message: 'Job state service unavailable',
						details: stateError.message,
						action: 'Please start the unified deployment with: npm run dev:dapr'
					});
				}
				throw stateError;
			}
		}

		let daprJobs = null;
		let jobStates = [];

		// Try to get from Dapr Jobs API
		try {
			let daprJobsUrl = `http://localhost:3502/v1.0-alpha1/jobs`;
			if (jobName) {
				daprJobsUrl += `/${jobName}`;
			}

			const response = await fetch(daprJobsUrl);

			if (response.ok) {
				daprJobs = await response.json();
			} else {
				console.warn('Dapr Jobs API not available:', response.status);
			}
		} catch (daprError) {
			console.warn('Could not connect to Dapr Jobs API:', daprError.message);
		}

		// Try to get job states from state store
		try {
			jobStates = await jobStateStore.getAllJobStates();
		} catch (stateError) {
			console.warn('Could not get job states:', stateError.message);
			if (stateError.name === 'DaprConnectionError' && !daprJobs) {
				// If both services are unavailable, return helpful error
				return error(503, {
					message: 'Job services unavailable',
					details: stateError.message,
					action: 'Please start the unified deployment with: npm run dev:dapr'
				});
			}
		}

		// Combine available data
		const combined = jobStates.map(state => ({
			...state,
			daprInfo: daprJobs && Array.isArray(daprJobs) ? 
				daprJobs.find((dj: any) => dj.name === state.name) : 
				(daprJobs && daprJobs.name === state.name ? daprJobs : null)
		}));

		return json({
			daprJobs,
			jobStates,
			combined,
			serviceStatus: {
				daprAvailable: !!daprJobs,
				stateAvailable: jobStates.length >= 0
			}
		});
	} catch (err) {
		console.error('Job retrieval error:', err);
		// Check if this is a fetch error indicating services aren't running
		if (err.message && err.message.includes('fetch failed')) {
			return error(503, {
				message: 'Job services unavailable',
				details: 'Cannot connect to job services. Please ensure the unified deployment is running.',
				action: 'Run: npm run dev:dapr'
			});
		}
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

		let deletedFromDapr = false;
		let stateDeleted = false;

		// Delete from Dapr Jobs API if jobName provided
		if (jobName) {
			try {
				const daprJobsUrl = `http://localhost:3502/v1.0-alpha1/jobs/${jobName}`;

				const response = await fetch(daprJobsUrl, {
					method: 'DELETE',
				});

				if (response.ok || response.status === 404) {
					deletedFromDapr = true;
				} else {
					const errorText = await response.text();
					console.warn('Dapr Jobs API error:', errorText);
				}
			} catch (daprError) {
				console.warn('Could not delete from Dapr (may not be running):', daprError.message);
				// Don't fail the whole operation if Dapr is down
			}
		}

		// Delete from state store
		if (jobId) {
			// Direct jobId provided
			try {
				await jobStateStore.deleteJobState(jobId);
				stateDeleted = true;
			} catch (stateError) {
				console.warn('Could not delete job state:', stateError.message);
				// Check if this is a Dapr connection error
				if (stateError.name === 'DaprConnectionError') {
					return error(503, {
						message: 'Job state service unavailable',
						details: stateError.message,
						action: 'Please start the unified deployment with: npm run dev:dapr'
					});
				}
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
				console.warn('Could not delete job state:', stateError.message);
				// Check if this is a Dapr connection error
				if (stateError.name === 'DaprConnectionError') {
					return error(503, {
						message: 'Job state service unavailable',
						details: stateError.message,
						action: 'Please start the unified deployment with: npm run dev:dapr'
					});
				}
			}
		}

		// Consider it successful if we deleted from at least one place, or if both are unavailable
		const hasSuccess = deletedFromDapr || stateDeleted;
		const message = hasSuccess ? 
			`Job ${jobName || jobId} deleted successfully` :
			`Job ${jobName || jobId} deletion completed (services may be unavailable)`;

		return json({ 
			success: true, 
			message,
			deletedFromDapr,
			deletedFromState: stateDeleted
		});
	} catch (err) {
		console.error('Job deletion error:', err);
		// Check if this is a fetch error indicating Dapr isn't running
		if (err.message && err.message.includes('fetch failed')) {
			return error(503, {
				message: 'Job deletion service unavailable',
				details: 'Cannot connect to job services. Please ensure the unified deployment is running.',
				action: 'Run: npm run dev:dapr'
			});
		}
		return error(500, 'Internal server error while deleting job');
	}
};