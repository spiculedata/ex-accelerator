import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jobStateStore } from '$lib/services/jobStateStore.js';

export const GET: RequestHandler = async () => {
	try {
		console.log('🔍 JOB EXECUTION MONITOR CHECK:', new Date().toISOString());
		
		// Get all jobs from state store
		const allJobs = await jobStateStore.getAllJobStates();
		const now = new Date();
		
		const scheduledJobs = allJobs.filter(job => job.status === 'scheduled');
		const overdueJobs = scheduledJobs.filter(job => new Date(job.scheduledFor) < now);
		
		console.log('📊 JOB EXECUTION ANALYSIS:', {
			totalJobs: allJobs.length,
			scheduledJobs: scheduledJobs.length,
			overdueJobs: overdueJobs.length,
			currentTime: now.toISOString()
		});
		
		if (overdueJobs.length > 0) {
			console.log('⚠️ OVERDUE JOBS DETECTED:');
			overdueJobs.forEach(job => {
				const scheduledTime = new Date(job.scheduledFor);
				const delayMinutes = Math.floor((now.getTime() - scheduledTime.getTime()) / (1000 * 60));
				console.log(`  • ${job.name}: Scheduled for ${job.scheduledFor}, ${delayMinutes} minutes overdue`);
			});
		}
		
		const recentScheduledJobs = scheduledJobs
			.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
			.slice(0, 5);
		
		console.log('⏰ UPCOMING SCHEDULED JOBS:');
		recentScheduledJobs.forEach(job => {
			const scheduledTime = new Date(job.scheduledFor);
			const delayMinutes = Math.floor((scheduledTime.getTime() - now.getTime()) / (1000 * 60));
			const status = scheduledTime < now ? 'OVERDUE' : `in ${delayMinutes} minutes`;
			console.log(`  • ${job.name}: ${status} (${job.scheduledFor})`);
		});
		
		return json({
			timestamp: now.toISOString(),
			totalJobs: allJobs.length,
			scheduledJobs: scheduledJobs.length,
			overdueJobs: overdueJobs.length,
			overdue: overdueJobs.map(job => ({
				name: job.name,
				scheduledFor: job.scheduledFor,
				delayMinutes: Math.floor((now.getTime() - new Date(job.scheduledFor).getTime()) / (1000 * 60))
			})),
			upcoming: recentScheduledJobs.map(job => ({
				name: job.name,
				scheduledFor: job.scheduledFor,
				status: job.status,
				minutesToExecution: Math.floor((new Date(job.scheduledFor).getTime() - now.getTime()) / (1000 * 60))
			}))
		});
		
	} catch (err) {
		console.error('❌ JOB MONITOR ERROR:', err);
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
	}
};