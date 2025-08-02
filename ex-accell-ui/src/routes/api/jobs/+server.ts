import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

		const response = await fetch(daprJobsUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(jobBody),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Dapr Jobs API error:', errorText);
			return error(response.status, `Failed to schedule job: ${errorText}`);
		}

		let result;
		try {
			const responseText = await response.text();
			result = responseText ? JSON.parse(responseText) : {};
		} catch (e) {
			result = {};
		}
		return json({ success: true, job: result });
	} catch (err) {
		console.error('Job scheduling error:', err);
		return error(500, 'Internal server error while scheduling job');
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const jobName = url.searchParams.get('name');
		
		// Use the working job API format with correct port
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

		const result = await response.json();
		return json(result);
	} catch (err) {
		console.error('Job retrieval error:', err);
		return error(500, 'Internal server error while retrieving job(s)');
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const jobName = url.searchParams.get('name');
		
		if (!jobName) {
			return error(400, 'Job name is required for deletion');
		}

		const daprJobsUrl = `http://localhost:3502/v1.0-alpha1/jobs/${jobName}`;

		const response = await fetch(daprJobsUrl, {
			method: 'DELETE',
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Dapr Jobs API error:', errorText);
			return error(response.status, `Failed to delete job: ${errorText}`);
		}

		return json({ success: true, message: `Job ${jobName} deleted successfully` });
	} catch (err) {
		console.error('Job deletion error:', err);
		return error(500, 'Internal server error while deleting job');
	}
};