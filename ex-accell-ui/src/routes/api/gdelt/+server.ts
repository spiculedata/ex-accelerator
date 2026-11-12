// GDELT Events API — optimised for map display
import { json } from '@sveltejs/kit';
import { apiFail, apiOk, apiServerError } from '$lib/server/apiResponse';
import { validateDateParams } from '$lib/server/dateBounds';
import { isMissingRelationError } from '$lib/server/queryErrors';
import { postgresPool } from '$lib/services/postgres';

export async function GET({ url }) {
	try {
		const goldsteinMin = parseFloat(url.searchParams.get('goldsteinMin') || '-10');
		const goldsteinMax = parseFloat(url.searchParams.get('goldsteinMax') || '10');
		if (!Number.isFinite(goldsteinMin) || !Number.isFinite(goldsteinMax)) {
			return apiFail('Invalid goldstein scale values', 400);
		}

		// GDELT days may come as 2026-01-31 or 20260131; both are checked as real days, and a reversed range is refused
		const days = new URLSearchParams();
		for (const name of ['dateStart', 'dateEnd']) {
			const value = url.searchParams.get(name);
			if (value) days.set(name, /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}` : value);
		}
		const dateProblem = validateDateParams(days);
		if (dateProblem) return apiFail(dateProblem, 400);
		const dateStart = days.get('dateStart');
		const dateEnd = days.get('dateEnd');

		const conditions: string[] = [
			'actiongeo_lat IS NOT NULL',
			'actiongeo_long IS NOT NULL',
			'goldsteinscale BETWEEN $1 AND $2'
		];
		const params: any[] = [goldsteinMin, goldsteinMax];
		let paramIndex = 3;

		// Default to last 3 months if no date specified (prevents full table scan)
		if (dateStart) {
			conditions.push(`sqldate >= $${paramIndex}`);
			params.push(parseInt(dateStart.replace(/-/g, '')));
			paramIndex++;
		} else {
			const threeMonthsAgo = new Date();
			threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
			const defaultStart = parseInt(threeMonthsAgo.toISOString().slice(0, 10).replace(/-/g, ''));
			conditions.push(`sqldate >= $${paramIndex}`);
			params.push(defaultStart);
			paramIndex++;
		}

		if (dateEnd) {
			conditions.push(`sqldate <= $${paramIndex}`);
			params.push(parseInt(dateEnd.replace(/-/g, '')));
			paramIndex++;
		}

		// Fast query: use TABLESAMPLE for random selection instead of ORDER BY RANDOM()
		// This gives a representative sample without sorting millions of rows
		const query = `
			SELECT
				globaleventid,
				actor1name,
				actor2name,
				eventcode,
				actiongeo_countrycode,
				actiongeo_fullname,
				actiongeo_lat,
				actiongeo_long,
				goldsteinscale,
				avgtone,
				sqldate
			FROM gdelt_events TABLESAMPLE SYSTEM(1)
			WHERE ${conditions.join(' AND ')}
			LIMIT 5000
		`;

		const rows = await postgresPool.query(query, params);

		const events = rows.map((row: any) => ({
			id: typeof row.globaleventid === 'bigint' ? Number(row.globaleventid) : row.globaleventid,
			actor1: row.actor1name,
			actor2: row.actor2name,
			eventCode: row.eventcode,
			country: row.actiongeo_countrycode,
			location: row.actiongeo_fullname,
			lat: typeof row.actiongeo_lat === 'string' ? parseFloat(row.actiongeo_lat) : row.actiongeo_lat,
			lng: typeof row.actiongeo_long === 'string' ? parseFloat(row.actiongeo_long) : row.actiongeo_long,
			goldstein: typeof row.goldsteinscale === 'string' ? parseFloat(row.goldsteinscale) : row.goldsteinscale,
			tone: typeof row.avgtone === 'string' ? parseFloat(row.avgtone) : row.avgtone,
			date: typeof row.sqldate === 'bigint' ? Number(row.sqldate) : row.sqldate
		}));

		return apiOk({ events, count: events.length }, { events, count: events.length });

	} catch (err) {
		// No gdelt_events table means GDELT has not been loaded: report no events, flagged, not an error
		if (isMissingRelationError(err)) {
			return json({ success: true, events: [], count: 0, unavailable: true, data: { events: [], count: 0 }, meta: { unavailable: true } });
		}
		return apiServerError('GET /api/gdelt', err, 'Internal server error');
	}
}
