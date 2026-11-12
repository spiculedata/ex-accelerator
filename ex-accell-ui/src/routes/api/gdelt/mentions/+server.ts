// GDELT Mentions API — queries PostgreSQL via pg_duckdb
import { apiFail, apiOk, apiServerError, readJsonObject } from '$lib/server/apiResponse';
import { postgresPool } from '$lib/services/postgres';

const MAX_BODY_BYTES = 256 * 1024;

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
			return apiFail('Event ID is required', 400);
		}

		const eventIdNum = parseInt(eventId);
		if (isNaN(eventIdNum)) {
			return apiFail('Invalid event ID', 400);
		}

		const mentions = await fetchMentions([eventIdNum]);
		return apiOk({ mentions, count: mentions.length }, { mentions, count: mentions.length });

	} catch (err) {
		return apiServerError('GET /api/gdelt/mentions', err, 'Internal server error');
	}
}

export async function POST({ request }) {
	const parsed = await readJsonObject(request, MAX_BODY_BYTES);
	if ('failure' in parsed) return parsed.failure;
	const { eventIds } = parsed.body;
	if (!eventIds || !Array.isArray(eventIds)) return apiFail('Event IDs array is required', 400);

	try {

		const eventIdArray = eventIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
		if (eventIdArray.length === 0) {
			return apiFail('No valid event IDs', 400);
		}
		if (eventIdArray.length > 1000) {
			return apiFail('Maximum 1000 event IDs allowed', 400);
		}

		const mentions = await fetchMentions(eventIdArray);
		return apiOk({ mentions, count: mentions.length }, { mentions, count: mentions.length });

	} catch (err) {
		return apiServerError('POST /api/gdelt/mentions', err, 'Internal server error');
	}
}
