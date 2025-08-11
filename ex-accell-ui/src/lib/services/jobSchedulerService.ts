export interface JobScheduleRequest {
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

export interface JobStatusResponse {
	name: string;
	dueTime: string;
	data: any;
	status?: string;
}

export interface ScheduledJob {
	id: string;
	name: string;
	platform: 'telegram' | 'youtube';
	urls: string[];
	scheduledTime: string;
	status: 'scheduled' | 'running' | 'completed' | 'failed';
	createdAt: string;
	crawlId?: string;
}

class JobSchedulerService {
	private readonly apiBaseUrl = '/api/jobs';

	async scheduleJob(jobRequest: JobScheduleRequest): Promise<{ success: boolean; job: any }> {
		const response = await fetch(this.apiBaseUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(jobRequest),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to schedule job: ${errorText}`);
		}

		return await response.json();
	}

	async getJobs(): Promise<JobStatusResponse[]> {
		const response = await fetch(this.apiBaseUrl);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to get jobs: ${errorText}`);
		}

		return await response.json();
	}

	async getJob(name: string): Promise<JobStatusResponse> {
		const response = await fetch(`${this.apiBaseUrl}?name=${encodeURIComponent(name)}`);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to get job: ${errorText}`);
		}

		return await response.json();
	}

	async deleteJob(name: string): Promise<{ success: boolean; message: string }> {
		const response = await fetch(`${this.apiBaseUrl}?name=${encodeURIComponent(name)}`, {
			method: 'DELETE',
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to delete job: ${errorText}`);
		}

		return await response.json();
	}

	generateJobName(platform: string, crawlId?: string): string {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const suffix = crawlId ? `-${crawlId}` : '';
		return `${platform}-crawl-${timestamp}${suffix}`;
	}

	parseRelativeTime(timeAgo: string): string {
		const now = new Date();
		const match = timeAgo.match(/^(\d+)([dhwmy])$/);
		
		if (!match) {
			throw new Error('Invalid time format. Use format like "30d", "6h", "2w", "1m", "1y"');
		}

		const value = parseInt(match[1]);
		const unit = match[2];

		switch (unit) {
			case 'd':
				now.setDate(now.getDate() + value);
				break;
			case 'h':
				now.setHours(now.getHours() + value);
				break;
			case 'w':
				now.setDate(now.getDate() + (value * 7));
				break;
			case 'm':
				now.setMonth(now.getMonth() + value);
				break;
			case 'y':
				now.setFullYear(now.getFullYear() + value);
				break;
			default:
				throw new Error('Invalid time unit. Use d, h, w, m, or y');
		}

		return now.toISOString();
	}

	formatDueTime(scheduledTime: Date): string {
		const now = new Date();
		const diffMs = scheduledTime.getTime() - now.getTime();

		if (diffMs <= 0) {
			return 'now';
		}

		const diffMinutes = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMinutes < 60) {
			return `${diffMinutes}m`;
		} else if (diffHours < 24) {
			return `${diffHours}h`;
		} else {
			return `${diffDays}d`;
		}
	}

	validateJobRequest(request: Partial<JobScheduleRequest>): string[] {
		// Only validate absolutely essential fields - let crawler handle platform-specific validation
		const errors: string[] = [];

		if (!request.name) {
			errors.push('Job name is required');
		}

		if (!request.dueTime) {
			errors.push('Due time is required');
		}

		if (!request.data) {
			errors.push('Job data is required');
		}

		// Remove all other validations to let crawler provide accurate error messages
		return errors;
	}
}

export const jobSchedulerService = new JobSchedulerService();