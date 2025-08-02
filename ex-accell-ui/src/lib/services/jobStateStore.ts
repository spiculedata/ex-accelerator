import type { RequestHandler } from '@sveltejs/kit';

const DAPR_HTTP_PORT = 3500;
const STATE_STORE_NAME = 'statestore';

export interface JobState {
	id: string;
	name: string;
	status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
	createdAt: string;
	updatedAt: string;
	scheduledFor: string;
	platform: 'telegram' | 'youtube';
	jobData: {
		droid: string;
		task: string;
		urls?: string[];
		urlFile?: string;
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
	executionLog?: string[];
	result?: {
		success: boolean;
		message: string;
		itemsProcessed?: number;
		errors?: string[];
	};
}

export class JobStateStore {
	private baseUrl: string;

	constructor() {
		this.baseUrl = `http://localhost:${DAPR_HTTP_PORT}/v1.0/state/${STATE_STORE_NAME}`;
	}

	/**
	 * Save a job state to the Dapr state store
	 */
	async saveJobState(jobState: JobState): Promise<void> {
		try {
			// Save the job state
			const saveJobResponse = await fetch(this.baseUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify([
					{
						key: `job:${jobState.id}`,
						value: jobState,
					},
				]),
			});

			if (!saveJobResponse.ok) {
				const errorText = await saveJobResponse.text();
				throw new Error(`Failed to save job state: ${saveJobResponse.status} - ${errorText}`);
			}

			// Maintain a job registry for listing all jobs
			await this.updateJobRegistry(jobState.id);
		} catch (error) {
			console.error('Error saving job state:', error);
			throw error;
		}
	}

	/**
	 * Update the job registry to keep track of all job IDs
	 */
	private async updateJobRegistry(jobId: string): Promise<void> {
		try {
			// Get current registry
			const registryResponse = await fetch(`${this.baseUrl}/job-registry`, {
				method: 'GET',
			});

			let jobIds: string[] = [];
			if (registryResponse.ok) {
				const responseText = await registryResponse.text();
				if (responseText.trim()) {
					const registryData = JSON.parse(responseText);
					jobIds = registryData?.jobIds || [];
				}
			}

			// Add new job ID if not already present
			if (!jobIds.includes(jobId)) {
				jobIds.push(jobId);

				// Save updated registry
				await fetch(this.baseUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify([
						{
							key: 'job-registry',
							value: { jobIds, lastUpdated: new Date().toISOString() },
						},
					]),
				});
			}
		} catch (error) {
			console.warn('Failed to update job registry:', error);
			// Don't throw here as it's not critical for core functionality
		}
	}

	/**
	 * Remove a job ID from the job registry
	 */
	private async removeFromJobRegistry(jobId: string): Promise<void> {
		try {
			// Get current registry
			const registryResponse = await fetch(`${this.baseUrl}/job-registry`, {
				method: 'GET',
			});

			let jobIds: string[] = [];
			if (registryResponse.ok) {
				const responseText = await registryResponse.text();
				if (responseText.trim()) {
					const registryData = JSON.parse(responseText);
					jobIds = registryData?.jobIds || [];
				}
			}

			// Remove job ID if present
			const originalLength = jobIds.length;
			jobIds = jobIds.filter(id => id !== jobId);

			// Only update if something was removed
			if (jobIds.length < originalLength) {
				// Save updated registry
				await fetch(this.baseUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify([
						{
							key: 'job-registry',
							value: { jobIds, lastUpdated: new Date().toISOString() },
						},
					]),
				});
			}
		} catch (error) {
			console.warn('Failed to remove job from registry:', error);
			// Don't throw here as it's not critical for core functionality
		}
	}

	/**
	 * Get a specific job state by ID
	 */
	async getJobState(jobId: string): Promise<JobState | null> {
		try {
			const response = await fetch(`${this.baseUrl}/job:${jobId}`, {
				method: 'GET',
			});

			if (response.status === 404) {
				return null;
			}

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Failed to get job state: ${response.status} - ${errorText}`);
			}

			const responseText = await response.text();
			if (!responseText.trim()) {
				return null;
			}
			
			const result = JSON.parse(responseText);
			return result || null;
		} catch (error) {
			console.error('Error getting job state:', error);
			throw error;
		}
	}

	/**
	 * Get all job states
	 */
	async getAllJobStates(): Promise<JobState[]> {
		try {
			// Get job registry to find all job IDs
			const registryResponse = await fetch(`${this.baseUrl}/job-registry`, {
				method: 'GET',
			});

			if (!registryResponse.ok) {
				console.warn('Job registry not found, returning empty array');
				return [];
			}

			const responseText = await registryResponse.text();
			if (!responseText.trim()) {
				console.warn('Job registry is empty, returning empty array');
				return [];
			}

			const registryData = JSON.parse(responseText);
			const jobIds: string[] = registryData?.jobIds || [];

			if (jobIds.length === 0) {
				return [];
			}

			// Fetch all job states using bulk get
			const bulkResponse = await fetch(`${this.baseUrl}/bulk`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					keys: jobIds.map(id => `job:${id}`),
					parallelism: 10,
				}),
			});

			if (!bulkResponse.ok) {
				const errorText = await bulkResponse.text();
				throw new Error(`Failed to get all job states: ${bulkResponse.status} - ${errorText}`);
			}

			const bulkResult = await bulkResponse.json();
			const jobStates: JobState[] = [];

			// Extract job states from bulk response
			if (bulkResult && Array.isArray(bulkResult)) {
				for (const item of bulkResult) {
					if (item.key && item.key.startsWith('job:') && item.data) {
						jobStates.push(item.data);
					}
				}
			}

			// Sort by createdAt descending (newest first)
			return jobStates.sort((a, b) => 
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);
		} catch (error) {
			console.error('Error getting all job states:', error);
			// Fallback: return empty array instead of throwing
			return [];
		}
	}

	/**
	 * Update job status
	 */
	async updateJobStatus(
		jobId: string, 
		status: JobState['status'], 
		additionalData?: Partial<JobState>
	): Promise<void> {
		try {
			// First get the current state
			const currentState = await this.getJobState(jobId);
			if (!currentState) {
				throw new Error(`Job ${jobId} not found`);
			}

			// Update the state
			const updatedState: JobState = {
				...currentState,
				...additionalData,
				status,
				updatedAt: new Date().toISOString(),
			};

			// Save the updated state
			await this.saveJobState(updatedState);
		} catch (error) {
			console.error('Error updating job status:', error);
			throw error;
		}
	}

	/**
	 * Add log entry to job execution log
	 */
	async addJobLog(jobId: string, logEntry: string): Promise<void> {
		try {
			const currentState = await this.getJobState(jobId);
			if (!currentState) {
				throw new Error(`Job ${jobId} not found`);
			}

			const executionLog = currentState.executionLog || [];
			executionLog.push(`${new Date().toISOString()}: ${logEntry}`);

			await this.updateJobStatus(jobId, currentState.status, {
				executionLog,
			});
		} catch (error) {
			console.error('Error adding job log:', error);
			throw error;
		}
	}

	/**
	 * Delete a job state
	 */
	async deleteJobState(jobId: string): Promise<void> {
		try {
			// Delete the job state
			const response = await fetch(`${this.baseUrl}/job:${jobId}`, {
				method: 'DELETE',
			});

			if (!response.ok && response.status !== 404) {
				const errorText = await response.text();
				throw new Error(`Failed to delete job state: ${response.status} - ${errorText}`);
			}

			// Remove from job registry
			await this.removeFromJobRegistry(jobId);
		} catch (error) {
			console.error('Error deleting job state:', error);
			throw error;
		}
	}

	/**
	 * Get jobs by status
	 */
	async getJobsByStatus(status: JobState['status']): Promise<JobState[]> {
		const allJobs = await this.getAllJobStates();
		return allJobs.filter(job => job.status === status);
	}

	/**
	 * Create a new job state
	 */
	createJobState(
		jobId: string,
		name: string,
		scheduledFor: string,
		platform: 'telegram' | 'youtube',
		jobData: JobState['jobData']
	): JobState {
		return {
			id: jobId,
			name,
			status: 'scheduled',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			scheduledFor,
			platform,
			jobData,
			executionLog: [],
		};
	}
}

// Export singleton instance
export const jobStateStore = new JobStateStore();