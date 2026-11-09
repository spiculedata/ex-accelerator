// GDELT Events API — optimised for map display
import { json } from '@sveltejs/kit';
import { isMissingRelationError } from '$lib/server/queryErrors';
import { postgresPool } from '$lib/services/postgres';

export async function GET({ url }) {
	try {
		const goldsteinMin = parseFloat(url.searchParams.get('goldsteinMin') || '-10');
		const goldsteinMax = parseFloat(url.searchParams.get('goldsteinMax') || '10');
		if (!Number.isFinite(goldsteinMin) || !Number.isFinite(goldsteinMax)) {
			return json({ error: 'Invalid goldstein scale values' }, { status: 400 });
		}

		const dateStart = url.searchParams.get('dateStart');
		const dateEnd = url.searchParams.get('dateEnd');
		const dateFormat = /^\d{8}$/;
		if (dateStart && !dateFormat.test(dateStart.replace(/-/g, ''))) {
			return json({ error: 'Invalid dateStart format' }, { status: 400 });
		}
		if (dateEnd && !dateFormat.test(dateEnd.replace(/-/g, ''))) {
			return json({ error: 'Invalid dateEnd format' }, { status: 400 });
		}

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

		return json({ events, count: events.length });

	} catch (err) {
		// No gdelt_events table means GDELT has not been loaded: report no events, flagged, not an error
		if (isMissingRelationError(err)) {
			return json({ events: [], count: 0, unavailable: true });
		}
		console.error('GDELT API Error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
