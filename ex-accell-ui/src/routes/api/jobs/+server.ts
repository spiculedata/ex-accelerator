import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jobStateStore } from '$lib/services/jobStateStore.js';
import { DaprClient, CommunicationProtocolEnum, HttpMethod } from '@dapr/dapr';

const TELEGRAM_SCRAPER_APP_ID = 'telegram-scraper';

// Initialize Dapr client using the job-scheduler pattern
let daprClient: DaprClient | null = null;

async function getDaprClient(): Promise<DaprClient> {
	if (!daprClient) {
		daprClient = new DaprClient({
			daprHost: 'localhost',
			daprPort: '3500', // UI app's Dapr sidecar port
			communicationProtocol: CommunicationProtocolEnum.HTTP,
		});
	}
	return daprClient;
}

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

interface JobStatusResponse {
	name: string;
	dueTime: string;
	data: any;
	status?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const jobRequest: JobScheduleRequest = await request.json();
		
		console.log('🎯 JOB SCHEDULING REQUEST:', {
			name: jobRequest.name,
			dueTime: jobRequest.dueTime,
			platform: jobRequest.data?.platform,
			urls: jobRequest.data?.urls, // Debug: check what URLs are being passed
			urlsLength: jobRequest.data?.urls?.length, // Debug: check URLs array length
			droid: jobRequest.data?.droid,
			task: jobRequest.data?.task,
			timestamp: new Date().toISOString(),
			fullRequestData: JSON.stringify(jobRequest.data, null, 2) // Debug: full request data
		});

		if (!jobRequest.name || !jobRequest.dueTime || !jobRequest.data) {
			console.error('❌ JOB SCHEDULING FAILED: Missing required fields');
			return error(400, 'Missing required fields: name, dueTime, data');
		}

		// Let the crawler handle validation - this provides more accurate error messages
		// Remove platform validation checks to allow crawler to provide specific errors

		// Create job state before scheduling
		const jobId = `${jobRequest.name}-${Date.now()}`;
		let scheduledFor: string;
		
		if (jobRequest.dueTime === 'now') {
			// Immediate execution
			scheduledFor = new Date().toISOString();
		} else if (jobRequest.dueTime.endsWith('s')) {
			// Duration in seconds (e.g., "30s")
			const seconds = parseInt(jobRequest.dueTime.slice(0, -1));
			scheduledFor = new Date(Date.now() + seconds * 1000).toISOString();
		} else {
			// Duration in minutes (e.g., "5" = 5 minutes)  
			const minutes = parseInt(jobRequest.dueTime);
			scheduledFor = new Date(Date.now() + minutes * 60 * 1000).toISOString();
		}

		console.log('📋 CREATING JOB STATE:', {
			jobId,
			scheduledFor,
			dueInSeconds: jobRequest.dueTime
		});

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
			console.log('💾 SAVING JOB STATE TO STORE...');
			await jobStateStore.saveJobState(jobState);
			jobStateSaved = true;
			console.log('✅ JOB STATE SAVED SUCCESSFULLY');
		} catch (stateError: any) {
			console.error('❌ FAILED TO SAVE JOB STATE:', stateError.message);
			// Check if this is a Dapr connection error and provide helpful message
			if (stateError.name === 'DaprConnectionError') {
				return error(503, `Job scheduling service unavailable: ${stateError.message}. Please start the unified deployment with: npm run dev:dapr`);
			}
		}

		// Use Dapr SDK to schedule job via service invocation (job-scheduler pattern)
		const daprClient = await getDaprClient();

		// Generate job name - use base job type as the job name for Dapr
		const jobTypeName = getJobTypeFromPlatform(jobRequest.data.platform);
		
		// Validate job name is not empty
		if (!jobTypeName || jobTypeName.trim() === '') {
			console.error('❌ Generated job name is empty:', { jobTypeName, platform: jobRequest.data.platform });
			return error(400, 'Failed to generate valid job name');
		}

		// Prepare job data following telegram-scraper JobData format
		const jobData = {
			jobName: jobTypeName, // Base job type name (e.g., "youtube-crawl", "telegram-crawl")
			task: getTaskDescription(jobRequest.data.platform), // Human-readable task description
			dueTime: jobRequest.dueTime === 'now' ? '0s' : jobRequest.dueTime, // Convert 'now' to immediate Dapr format
			jobId, // Add jobId for tracking (UI-specific identifier)
			urls: jobRequest.data.urls || [], // URLs to crawl
			platform: jobRequest.data.platform, // Platform for configuration
			// Include all other crawler configuration fields
			crawlId: jobRequest.data.crawlId || `crawl-${Date.now()}`,
			maxDepth: jobRequest.data.maxDepth || 1,
			concurrency: jobRequest.data.concurrency || 1,
			maxPosts: jobRequest.data.maxPosts || 1000,
			...(jobRequest.data.platform === 'youtube' && {
				youtubeApiKey: jobRequest.data.youtubeApiKey,
				samplingMethod: jobRequest.data.samplingMethod || 'channel',
				minChannelVideos: jobRequest.data.minChannelVideos || 10,
				sampleSize: jobRequest.data.sampleSize || 100
			}),
			...(jobRequest.data.platform === 'telegram' && {
				tdlibDatabaseUrls: jobRequest.data.tdlibDatabaseUrls || []
			}),
			// Other optional fields
			urlFile: jobRequest.data.urlFile,
			maxPages: jobRequest.data.maxPages,
			skipMedia: jobRequest.data.skipMedia,
			timeAgo: jobRequest.data.timeAgo
		};

		console.log('📤 SUBMITTING JOB VIA DAPR SDK:', {
			appId: TELEGRAM_SCRAPER_APP_ID,
			methodName: 'scheduleJob',
			jobName: jobTypeName,
			jobType: jobTypeName,
			platform: jobRequest.data.platform,
			dueTime: jobData.dueTime,
			urlCount: jobData.urls.length
		});

		// Final validation before sending to telegram-scraper
		if (!jobData.jobName || jobData.jobName.trim() === '') {
			console.error('❌ jobData.jobName is empty before service invocation:', jobData);
			return error(400, 'Job name validation failed - empty job name');
		}

		try {
			// Use service invocation to call the telegram-scraper's scheduleJob handler
			// This will create the Dapr job with the appropriate job type for handler routing
			const result = await daprClient.invoker.invoke(
				TELEGRAM_SCRAPER_APP_ID,
				'scheduleJob',
				HttpMethod.POST,
				jobData
			);

			console.log('✅ JOB SCHEDULED VIA DAPR SDK:', result);
		} catch (daprError: any) {
			console.error('❌ DAPR SDK SCHEDULING ERROR:', daprError);

			// If scheduling fails, try to update job state to failed (if we could save it initially)
			if (jobStateSaved) {
				try {
					await jobStateStore.updateJobStatus(jobId, 'failed', {
						result: {
							success: false,
							message: 'Failed to schedule job with Dapr SDK',
							errors: [daprError.message]
						}
					});
				} catch (stateError) {
					console.warn('Could not update job state after failure:', stateError);
				}
			}

			return error(500, `Failed to schedule job via Dapr SDK: ${daprError.message}`);
		}

		console.log('✅ JOB SUCCESSFULLY SUBMITTED TO DAPR');
		
		// Update job state to indicate successful scheduling (if we can)
		if (jobStateSaved) {
			try {
				console.log('📝 ADDING SUCCESS LOG TO JOB STATE...');
				await jobStateStore.addJobLog(jobId, 'Job successfully scheduled with Dapr');
				console.log('✅ SUCCESS LOG ADDED TO JOB STATE');
			} catch (stateError) {
				console.error('❌ FAILED TO ADD JOB LOG:', stateError);
			}
		}

		// Job scheduled successfully via SDK
		const result = {
			scheduled: true,
			jobName: jobRequest.name,
			method: 'dapr-sdk'
		};

		console.log('🎉 JOB SCHEDULING COMPLETED SUCCESSFULLY:', {
			jobId,
			jobName: jobRequest.name,
			scheduledFor,
			stateSaved: jobStateSaved
		});

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
		const errMsg = err instanceof Error ? err.message : String(err);
		if (errMsg.includes('fetch failed')) {
			return error(503, 'Job scheduling service unavailable. Cannot connect to Dapr job scheduler. Please ensure the unified deployment is running. Run: npm run dev:dapr');
		}
		return error(500, 'Internal server error while scheduling job');
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const jobName = url.searchParams.get('name');
		const stateOnly = url.searchParams.get('state') === 'true';
		
		console.log('🔍 JOB STATUS QUERY:', {
			jobName: jobName || 'ALL_JOBS',
			stateOnly,
			timestamp: new Date().toISOString()
		});
		
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
				const stateErr = stateError as any;
				if (stateErr?.name === 'DaprConnectionError') {
					return error(503, `Job state service unavailable: ${stateErr?.message}. Please start the unified deployment with: npm run dev:dapr`);
				}
				throw stateError;
			}
		}

		let daprJobs = null;
		let jobStates: any[] = [];

		// Try to get from Dapr service using SDK
		try {
			const daprClient = await getDaprClient();
			
			console.log('📡 QUERYING JOBS VIA DAPR SDK:', {
				appId: TELEGRAM_SCRAPER_APP_ID,
				method: 'getJob',
				jobName: jobName || 'ALL_JOBS'
			});

			// Use service invocation to get job(s) from job-service
			if (jobName) {
				daprJobs = await daprClient.invoker.invoke(
					TELEGRAM_SCRAPER_APP_ID,
					'getJob',
					HttpMethod.POST,
					{ jobName }
				);
			} else {
				// For getting all jobs, we'll still use HTTP API as it's more appropriate
				const response = await fetch(`http://localhost:3500/v1.0-alpha1/jobs`);
				if (response.ok) {
					daprJobs = await response.json();
				}
			}

			console.log('✅ DAPR SDK JOB QUERY SUCCESS:', {
				jobCount: Array.isArray(daprJobs) ? daprJobs.length : 1,
				data: daprJobs
			});
		} catch (daprError) {
			console.error('❌ FAILED TO QUERY JOBS VIA DAPR SDK:', (daprError as any)?.message);
		}

		// Try to get job states from state store
		try {
			console.log('💾 QUERYING JOB STATE STORE...');
			jobStates = await jobStateStore.getAllJobStates();
			console.log('✅ JOB STATE STORE QUERY SUCCESS:', {
				jobCount: jobStates.length,
				recentJobs: jobStates.slice(0, 3).map(j => ({
					name: j.name,
					status: j.status,
					scheduledFor: j.scheduledFor
				}))
			});
		} catch (stateError) {
			const stateErr = stateError as any;
			console.error('❌ FAILED TO GET JOB STATES:', stateErr?.message);
			if (stateErr?.name === 'DaprConnectionError' && !daprJobs) {
				// If both services are unavailable, return helpful error
				return error(503, `Job services unavailable: ${stateErr?.message}. Please start the unified deployment with: npm run dev:dapr`);
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
		const errMsg = err instanceof Error ? err.message : String(err);
		if (errMsg.includes('fetch failed')) {
			return error(503, 'Job services unavailable. Cannot connect to job services. Please ensure the unified deployment is running: npm run dev:dapr');
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

		// Delete from Dapr Jobs API if jobName provided (still use HTTP API for deletion)
		if (jobName) {
			try {
				const daprJobsUrl = `http://localhost:3500/v1.0-alpha1/jobs/${jobName}`;

				const response = await fetch(daprJobsUrl, {
					method: 'DELETE',
				});

				if (response.ok || response.status === 404) {
					deletedFromDapr = true;
					console.log('✅ JOB DELETED FROM DAPR:', jobName);
				} else {
					const errorText = await response.text();
					console.warn('⚠️ DAPR JOBS API DELETE ERROR:', errorText);
				}
			} catch (daprError) {
				console.warn('❌ Could not delete from Dapr (may not be running):', (daprError as any)?.message);
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
				const stateErr = stateError as any;
				console.warn('Could not delete job state:', stateErr?.message);
				// Check if this is a Dapr connection error
				if (stateErr?.name === 'DaprConnectionError') {
					return error(503, `Job state service unavailable: ${stateErr?.message}. Please start the unified deployment with: npm run dev:dapr`);
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
				const stateErr = stateError as any;
				console.warn('Could not delete job state:', stateErr?.message);
				// Check if this is a Dapr connection error
				if (stateErr?.name === 'DaprConnectionError') {
					return error(503, `Job state service unavailable: ${stateErr?.message}. Please start the unified deployment with: npm run dev:dapr`);
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
		const errMsg = err instanceof Error ? err.message : String(err);
		if (errMsg.includes('fetch failed')) {
			return error(503, 'Job deletion service unavailable. Cannot connect to job services. Please ensure the unified deployment is running: npm run dev:dapr');
		}
		return error(500, 'Internal server error while deleting job');
	}
};