// GDELT Mentions API — queries PostgreSQL via pg_duckdb
import { json } from '@sveltejs/kit';
import { postgresPool } from '$lib/services/postgres';

async function fetchMentions(eventIds: number[]) {
	if (eventIds.length === 0) return [];

	// Build parameterized placeholders: $1, $2, $3...
	const placeholders = eventIds.map((_, i) => `$${i + 1}`).join(',');

	const query = `
		SELECT
			globaleventid,
			eventtimedate,
			mentiontimedate,
			mentiontype,
			mentionsourcename,
			mentionidentifier,
			sentenceid,
			actor1charoffset,
			actor2charoffset,
			actioncharoffset,
			inrawtext,
			confidence,
			mentiondoclen,
			mentiondoctone,
			mentiondoctranslationinfo,
			extras
		FROM gdelt_mentions
		WHERE globaleventid IN (${placeholders})
		ORDER BY mentiontimedate DESC, confidence DESC
		LIMIT 1000
	`;

	const rows = await postgresPool.duckdbQuery(query, eventIds);

	return rows.map((row: any) => ({
		globalEventId: typeof row.globaleventid === 'bigint' ? Number(row.globaleventid) : row.globaleventid,
		eventTimeDate: typeof row.eventtimedate === 'bigint' ? Number(row.eventtimedate) : row.eventtimedate,
		mentionTimeDate: typeof row.mentiontimedate === 'bigint' ? Number(row.mentiontimedate) : row.mentiontimedate,
		mentionType: row.mentiontype,
		mentionSourceName: row.mentionsourcename,
		mentionIdentifier: row.mentionidentifier,
		sentenceId: row.sentenceid,
		actor1CharOffset: row.actor1charoffset,
		actor2CharOffset: row.actor2charoffset,
		actionCharOffset: row.actioncharoffset,
		inRawText: row.inrawtext,
		confidence: row.confidence,
		mentionDocLen: row.mentiondoclen,
		mentionDocTone: typeof row.mentiondoctone === 'string' ? parseFloat(row.mentiondoctone) : row.mentiondoctone,
		mentionDocTranslationInfo: row.mentiondoctranslationinfo,
		extras: row.extras
	}));
}

export async function GET({ url }) {
	try {
		const eventId = url.searchParams.get('eventId');

		if (!eventId) {
			return json({ error: 'Event ID is required' }, { status: 400 });
		}

		const eventIdNum = parseInt(eventId);
		if (isNaN(eventIdNum)) {
			return json({ error: 'Invalid event ID' }, { status: 400 });
		}

		const mentions = await fetchMentions([eventIdNum]);
		return json({ mentions, count: mentions.length });

	} catch (err) {
		console.error('Mentions API Error (GET):', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { eventIds } = body;

		if (!eventIds || !Array.isArray(eventIds)) {
			return json({ error: 'Event IDs array is required' }, { status: 400 });
		}

		const eventIdArray = eventIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
		if (eventIdArray.length === 0) {
			return json({ error: 'No valid event IDs' }, { status: 400 });
		}
		if (eventIdArray.length > 1000) {
			return json({ error: 'Maximum 1000 event IDs allowed' }, { status: 400 });
		}

		const mentions = await fetchMentions(eventIdArray);
		return json({ mentions, count: mentions.length });

	} catch (err) {
		console.error('Mentions API Error (POST):', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
