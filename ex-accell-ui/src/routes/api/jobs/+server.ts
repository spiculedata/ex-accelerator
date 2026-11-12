import type { RequestHandler } from './$types';
import { apiFail, apiOk, apiServerError, readJsonObject } from '$lib/server/apiResponse';
import { jobStateStore } from '$lib/services/jobStateStore.js';
import { createLogger } from '$lib/utils/logger';
import { DaprClient, CommunicationProtocolEnum, HttpMethod } from '@dapr/dapr';

const log = createLogger('jobs-api');

const TELEGRAM_SCRAPER_APP_ID = 'telegram-scraper';
const MAX_JOB_BODY_BYTES = 256 * 1024;
const DUE_TIME = /^(now|\d{1,9}[smh]?)$/;
const DUE_UNIT_MS: Record<string, number> = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000 };
const START_DAPR_HINT = 'Please start the unified deployment with: npm run dev:dapr';

// Initialize Dapr client using the job-scheduler pattern
let daprClient: DaprClient | null = null;

function getDaprClient(): DaprClient {
	if (!daprClient) {
		daprClient = new DaprClient({
			daprHost: 'localhost',
			daprPort: '3500', // UI app's Dapr sidecar port
			communicationProtocol: CommunicationProtocolEnum.HTTP,
		});
	}
	return daprClient;
}

/** True for the state store's "Dapr is not reachable" error and for a failed fetch to the sidecar. */
function isServiceUnavailable(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	return err.name === 'DaprConnectionError' || err.message.includes('fetch failed');
}

const unavailable = (label: string, err: unknown, what: string) => {
	log.error(`${label} failed: service unavailable`, { detail: err instanceof Error ? err.message : String(err) });
	return apiFail(`${what} unavailable. ${START_DAPR_HINT}`, 503);
};

// Map platform to proper job type as expected by telegram-scraper
function getJobTypeFromPlatform(platform: string): string {
	switch (platform?.toLowerCase()) {
		case 'telegram':
			return 'telegram-crawl';
		case 'youtube':
			return 'youtube-crawl';
		default:
			return 'scheduled-crawl'; // Generic fallback
	}
}

// Generate human-readable task description
function getTaskDescription(platform: string): string {
	switch (platform?.toLowerCase()) {
		case 'telegram':
			return 'crawl telegram channels';
		case 'youtube':
			return 'crawl youtube channels';
		default:
			return 'crawl channels';
	}
}

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

/** When the job is due: "now", a duration with a unit ("30s", "5m", "2h") or bare minutes ("5"). */
function scheduledForTime(dueTime: string): string {
	if (dueTime === 'now') return new Date().toISOString();
	const unit = /[smh]$/.test(dueTime) ? dueTime.slice(-1) : 'm';
	const amount = parseInt(dueTime, 10);
	return new Date(Date.now() + amount * DUE_UNIT_MS[unit]).toISOString();
}

function buildJobData(jobRequest: JobScheduleRequest, jobId: string, jobTypeName: string) {
	const { data } = jobRequest;
	return {
		jobName: jobTypeName, // Base job type name (e.g., "youtube-crawl", "telegram-crawl")
		task: getTaskDescription(data.platform), // Human-readable task description
		dueTime: jobRequest.dueTime === 'now' ? '0s' : jobRequest.dueTime, // Convert 'now' to immediate Dapr format
		jobId, // Add jobId for tracking (UI-specific identifier)
		urls: data.urls || [],
		platform: data.platform,
		crawlId: data.crawlId || `crawl-${Date.now()}`,
		maxDepth: data.maxDepth || 1,
		concurrency: data.concurrency || 1,
		maxPosts: data.maxPosts || 1000,
		...(data.platform === 'youtube' && {
			youtubeApiKey: data.youtubeApiKey,
			samplingMethod: data.samplingMethod || 'channel',
			minChannelVideos: data.minChannelVideos || 10,
			sampleSize: data.sampleSize || 100
		}),
		...(data.platform === 'telegram' && {
			tdlibDatabaseUrls: data.tdlibDatabaseUrls || []
		}),
		urlFile: data.urlFile,
		maxPages: data.maxPages,
		skipMedia: data.skipMedia,
		timeAgo: data.timeAgo
	};
}

export const POST: RequestHandler = async ({ request }) => {
	const parsed = await readJsonObject(request, MAX_JOB_BODY_BYTES);
	if ('failure' in parsed) return parsed.failure;
	const jobRequest = parsed.body as unknown as JobScheduleRequest;

	if (!jobRequest.name || !jobRequest.dueTime || !jobRequest.data) return apiFail('Missing required fields: name, dueTime, data', 400);
	if (typeof jobRequest.name !== 'string' || typeof jobRequest.dueTime !== 'string' || typeof jobRequest.data !== 'object' || Array.isArray(jobRequest.data)) {
		return apiFail('name and dueTime must be text and data an object', 400);
	}
	if (!DUE_TIME.test(jobRequest.dueTime)) return apiFail('dueTime must be "now", a duration such as "30s", "5m" or "2h", or minutes such as "5"', 400);

	try {
		// The crawler validates the platform and URLs, which gives more accurate errors than checking here
		const jobId = `${jobRequest.name}-${Date.now()}`;
		const scheduledFor = scheduledForTime(jobRequest.dueTime);
		log.info('Scheduling job', { name: jobRequest.name, platform: jobRequest.data.platform, dueTime: jobRequest.dueTime });

		const jobState = jobStateStore.createJobState(jobId, jobRequest.name, scheduledFor, jobRequest.data.platform, jobRequest.data);

		// Saving the state is best effort, unless Dapr itself is down
		let jobStateSaved = false;
		try {
			await jobStateStore.saveJobState(jobState);
			jobStateSaved = true;
		} catch (stateError) {
			if (isServiceUnavailable(stateError)) return unavailable('POST /api/jobs state', stateError, 'Job scheduling service');
			log.warn('Could not save job state', { detail: stateError instanceof Error ? stateError.message : String(stateError) });
		}

		const jobTypeName = getJobTypeFromPlatform(jobRequest.data.platform);
		const jobData = buildJobData(jobRequest, jobId, jobTypeName);

		try {
			// Call the telegram-scraper's scheduleJob handler, which creates the Dapr job for the job type
			await getDaprClient().invoker.invoke(TELEGRAM_SCRAPER_APP_ID, 'scheduleJob', HttpMethod.POST, jobData);
		} catch (daprError) {
			if (jobStateSaved) {
				try {
					await jobStateStore.updateJobStatus(jobId, 'failed', {
						result: { success: false, message: 'Failed to schedule job with Dapr SDK', errors: ['Scheduling failed'] }
					});
				} catch (stateError) {
					log.warn('Could not update job state after failure', { detail: stateError instanceof Error ? stateError.message : String(stateError) });
				}
			}
			if (isServiceUnavailable(daprError)) return unavailable('POST /api/jobs schedule', daprError, 'Job scheduling service');
			return apiServerError('POST /api/jobs schedule', daprError, 'Failed to schedule the job');
		}

		if (jobStateSaved) {
			try {
				await jobStateStore.addJobLog(jobId, 'Job successfully scheduled with Dapr');
			} catch (stateError) {
				log.warn('Could not add job log', { detail: stateError instanceof Error ? stateError.message : String(stateError) });
			}
		}

		const job = { scheduled: true, jobName: jobRequest.name, method: 'dapr-sdk' };
		const message = jobStateSaved ? 'Job scheduled successfully' : 'Job scheduled (state tracking unavailable)';
		const savedState = jobStateSaved ? jobState : null;
		return apiOk({ job, jobId, jobState: savedState, message }, { job, jobId, jobState: savedState, message });
	} catch (err) {
		if (isServiceUnavailable(err)) return unavailable('POST /api/jobs', err, 'Job scheduling service');
		return apiServerError('POST /api/jobs', err, 'Internal server error while scheduling job');
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const jobName = url.searchParams.get('name');
		const stateOnly = url.searchParams.get('state') === 'true';

		// State only: the job state records, from the state store
		if (stateOnly) {
			if (!jobName) return apiOk(await jobStateStore.getAllJobStates());
			const jobState = await jobStateStore.getJobState(jobName);
			if (!jobState) return apiFail('Job not found', 404);
			return apiOk(jobState);
		}

		let daprJobs: any = null;
		let jobStates: any[] = [];

		// Dapr's view of the jobs is best effort
		try {
			if (jobName) {
				daprJobs = await getDaprClient().invoker.invoke(TELEGRAM_SCRAPER_APP_ID, 'getJob', HttpMethod.POST, { jobName });
			} else {
				const response = await fetch('http://localhost:3500/v1.0-alpha1/jobs');
				if (response.ok) daprJobs = await response.json();
			}
		} catch (daprError) {
			log.warn('Could not query jobs via Dapr', { detail: daprError instanceof Error ? daprError.message : String(daprError) });
		}

		let stateFailed = false;
		try {
			jobStates = await jobStateStore.getAllJobStates();
		} catch (stateError) {
			stateFailed = true;
			// Both sources down is an outage; one down still returns what the other has
			if (isServiceUnavailable(stateError) && !daprJobs) return unavailable('GET /api/jobs', stateError, 'Job services');
			// An empty list here would read as "no jobs"
			if (!daprJobs) return apiServerError('GET /api/jobs', stateError, 'Internal server error while retrieving job(s)');
			log.warn('Could not get job states', { detail: stateError instanceof Error ? stateError.message : String(stateError) });
		}

		const combined = jobStates.map((state) => ({
			...state,
			daprInfo: Array.isArray(daprJobs) ? daprJobs.find((dj: any) => dj.name === state.name) : daprJobs && daprJobs.name === state.name ? daprJobs : null
		}));

		const payload = { daprJobs, jobStates, combined, serviceStatus: { daprAvailable: !!daprJobs, stateAvailable: !stateFailed } };
		return apiOk(payload, payload);
	} catch (err) {
		if (isServiceUnavailable(err)) return unavailable('GET /api/jobs', err, 'Job services');
		return apiServerError('GET /api/jobs', err, 'Internal server error while retrieving job(s)');
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	const jobName = url.searchParams.get('name');
	const jobId = url.searchParams.get('jobId');
	if (!jobName && !jobId) return apiFail('Job name or jobId is required for deletion', 400);

	try {
		let deletedFromDapr = false;
		let stateDeleted = false;

		// Delete from the Dapr Jobs API; a Dapr that is down does not fail the whole operation
		if (jobName) {
			try {
				const response = await fetch(`http://localhost:3500/v1.0-alpha1/jobs/${encodeURIComponent(jobName)}`, { method: 'DELETE' });
				if (response.ok || response.status === 404) deletedFromDapr = true;
				else log.warn('Dapr jobs API delete failed', { status: response.status });
			} catch (daprError) {
				log.warn('Could not delete from Dapr (may not be running)', { detail: daprError instanceof Error ? daprError.message : String(daprError) });
			}
		}

		try {
			if (jobId) {
				await jobStateStore.deleteJobState(jobId);
				stateDeleted = true;
			} else if (jobName) {
				const jobState = (await jobStateStore.getAllJobStates()).find((state) => state.name === jobName);
				if (jobState) {
					await jobStateStore.deleteJobState(jobState.id);
					stateDeleted = true;
				}
			}
		} catch (stateError) {
			if (isServiceUnavailable(stateError)) return unavailable('DELETE /api/jobs state', stateError, 'Job state service');
			log.warn('Could not delete job state', { detail: stateError instanceof Error ? stateError.message : String(stateError) });
		}

		const label = jobName || jobId;
		const message =
			deletedFromDapr || stateDeleted ? `Job ${label} deleted successfully` : `Job ${label} deletion completed (services may be unavailable)`;
		const payload = { message, deletedFromDapr, deletedFromState: stateDeleted };
		return apiOk(payload, payload);
	} catch (err) {
		if (isServiceUnavailable(err)) return unavailable('DELETE /api/jobs', err, 'Job deletion service');
		return apiServerError('DELETE /api/jobs', err, 'Internal server error while deleting job');
	}
};
