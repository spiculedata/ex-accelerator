import { json } from '@sveltejs/kit';
import duckdb from '@duckdb/node-api';
import { resolve } from 'path';

async function fetchMentions(eventIds: number[]) {
	// Get the absolute path to the database file
	const dbPath = resolve('../etl/duckdatabase');
	
	// Create DuckDB instance with the database file
	const instance = await duckdb.DuckDBInstance.create(dbPath);
	const connection = await instance.connect();
	
	// Build WHERE clause for event IDs
	const whereClause = `WHERE GLOBALEVENTID IN (${eventIds.join(',')})`;

	// Query to get mentions for the specified event(s)
	const query = `
		SELECT 
			GLOBALEVENTID,
			EventTimeDate,
			MentionTimeDate,
			MentionType,
			MentionSourceName,
			MentionIdentifier,
			SentenceID,
			Actor1CharOffset,
			Actor2CharOffset,
			ActionCharOffset,
			InRawText,
			Confidence,
			MentionDocLen,
			MentionDocTone,
			MentionDocTranslationInfo,
			Extras
		FROM gdelt_mentions 
		${whereClause}
		ORDER BY MentionTimeDate DESC, Confidence DESC
		LIMIT 1000
	`;
	
	const reader = await connection.runAndReadAll(query);
	connection.closeSync();
	
	const rowObjects = reader.getRowObjects();
	
	const mentions = rowObjects.map((row: any) => ({
		globalEventId: typeof row.GLOBALEVENTID === 'bigint' ? Number(row.GLOBALEVENTID) : row.GLOBALEVENTID,
		eventTimeDate: typeof row.EventTimeDate === 'bigint' ? Number(row.EventTimeDate) : row.EventTimeDate,
		mentionTimeDate: typeof row.MentionTimeDate === 'bigint' ? Number(row.MentionTimeDate) : row.MentionTimeDate,
		mentionType: row.MentionType,
		mentionSourceName: row.MentionSourceName,
		mentionIdentifier: row.MentionIdentifier,
		sentenceId: row.SentenceID,
		actor1CharOffset: row.Actor1CharOffset,
		actor2CharOffset: row.Actor2CharOffset,
		actionCharOffset: row.ActionCharOffset,
		inRawText: row.InRawText,
		confidence: row.Confidence,
		mentionDocLen: row.MentionDocLen,
		mentionDocTone: row.MentionDocTone,
		mentionDocTranslationInfo: row.MentionDocTranslationInfo,
		extras: row.Extras
	}));
	
	return mentions;
}

export async function GET({ url }) {
	try {
		// Get single event ID from query parameters
		const eventId = url.searchParams.get('eventId');
		
		if (!eventId) {
			return json({ error: 'Event ID is required for GET requests' }, { status: 400 });
		}
		
		const eventIdNum = parseInt(eventId);
		if (isNaN(eventIdNum)) {
			return json({ error: 'Invalid event ID provided' }, { status: 400 });
		}
		
		const mentions = await fetchMentions([eventIdNum]);
		return json({ mentions, count: mentions.length });
		
	} catch (error) {
		console.error('Mentions API Error (GET):', error);
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
		
		// Validate and convert event IDs
		const eventIdArray = eventIds.map(id => parseInt(id)).filter(id => !isNaN(id));
		if (eventIdArray.length === 0) {
			return json({ error: 'No valid event IDs provided' }, { status: 400 });
		}
		
		// Limit the number of events to prevent excessive queries
		if (eventIdArray.length > 1000) {
			return json({ error: 'Too many event IDs. Maximum 1000 allowed.' }, { status: 400 });
		}
		
		const mentions = await fetchMentions(eventIdArray);
		return json({ mentions, count: mentions.length });
		
	} catch (error) {
		console.error('Mentions API Error (POST):', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}