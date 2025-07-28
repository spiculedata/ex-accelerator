import { json } from '@sveltejs/kit';
import duckdb from '@duckdb/node-api';
import { resolve } from 'path';

export async function GET() {
	try {
		// Get the absolute path to the database file
		const dbPath = resolve('../etl/duckdatabase');
		
		// Create DuckDB instance with the database file
		const instance = await duckdb.DuckDBInstance.create(dbPath);
		const connection = await instance.connect();
		
		// Query the GDELT events with ActionGeo data
		const query = `
			SELECT 
				GLOBALEVENTID,
				Actor1Name,
				Actor2Name,
				EventCode,
				ActionGeo_CountryCode,
				ActionGeo_Fullname,
				ActionGeo_Lat,
				ActionGeo_Long,
				GoldsteinScale,
				AvgTone,
				SQLDATE
			FROM gdelt_events 
			WHERE ActionGeo_Lat IS NOT NULL 
			AND ActionGeo_Long IS NOT NULL
			AND ActionGeo_Lat BETWEEN -90 AND 90
			AND ActionGeo_Long BETWEEN -180 AND 180
			LIMIT 1000
		`;
		
		const reader = await connection.runAndReadAll(query);
		connection.closeSync();
		
		const rowObjects = reader.getRowObjects();
		
		const events = rowObjects.map((row: any) => ({
			id: typeof row.GLOBALEVENTID === 'bigint' ? Number(row.GLOBALEVENTID) : row.GLOBALEVENTID,
			actor1: row.Actor1Name,
			actor2: row.Actor2Name,
			eventCode: row.EventCode,
			country: row.ActionGeo_CountryCode,
			location: row.ActionGeo_Fullname,
			lat: row.ActionGeo_Lat,
			lng: row.ActionGeo_Long,
			goldstein: row.GoldsteinScale,
			tone: row.AvgTone,
			date: typeof row.SQLDATE === 'bigint' ? Number(row.SQLDATE) : row.SQLDATE
		}));
		
		return json({ events, count: events.length });
		
	} catch (error) {
		console.error('API Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}