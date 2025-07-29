import { json } from '@sveltejs/kit';
import duckdb from '@duckdb/node-api';
import { resolve } from 'path';

export async function GET({ url }) {
	try {
		// Get query parameters
		const goldsteinMin = parseFloat(url.searchParams.get('goldsteinMin') || '-10');
		const goldsteinMax = parseFloat(url.searchParams.get('goldsteinMax') || '10');
		const dateStart = url.searchParams.get('dateStart');
		const dateEnd = url.searchParams.get('dateEnd');
		
		// Get the absolute path to the database file
		const dbPath = resolve('../etl/duckdatabase');
		
		// Create DuckDB instance with the database file
		const instance = await duckdb.DuckDBInstance.create(dbPath);
		const connection = await instance.connect();
		
		// Query to get up to 1000 events per major event type category
		const query = `
			WITH event_categories AS (
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
					SQLDATE,
					CASE 
						WHEN EventCode LIKE '1%' THEN 'verbal_cooperation'
						WHEN EventCode LIKE '2%' THEN 'material_cooperation'
						WHEN EventCode LIKE '3%' THEN 'diplomacy'
						WHEN EventCode LIKE '4%' THEN 'support'
						WHEN EventCode LIKE '5%' THEN 'information'
						WHEN EventCode LIKE '6%' THEN 'economic'
						WHEN EventCode LIKE '7%' THEN 'political'
						WHEN EventCode LIKE '8%' THEN 'military'
						WHEN EventCode IN ('141', '142', '143', '144', '145') THEN 'protests'
						WHEN EventCode IN ('17', '18', '19', '190', '193', '194', '195') THEN 'violence'
						ELSE 'other'
					END as event_category,
					ROW_NUMBER() OVER (
						PARTITION BY CASE 
							WHEN EventCode LIKE '1%' THEN 'verbal_cooperation'
							WHEN EventCode LIKE '2%' THEN 'material_cooperation'
							WHEN EventCode LIKE '3%' THEN 'diplomacy'
							WHEN EventCode LIKE '4%' THEN 'support'
							WHEN EventCode LIKE '5%' THEN 'information'
							WHEN EventCode LIKE '6%' THEN 'economic'
							WHEN EventCode LIKE '7%' THEN 'political'
							WHEN EventCode LIKE '8%' THEN 'military'
							WHEN EventCode IN ('141', '142', '143', '144', '145') THEN 'protests'
							WHEN EventCode IN ('17', '18', '19', '190', '193', '194', '195') THEN 'violence'
							ELSE 'other'
						END 
						ORDER BY RANDOM()
					) as rn
				FROM gdelt_events 
				WHERE ActionGeo_Lat IS NOT NULL 
				AND ActionGeo_Long IS NOT NULL
				AND ActionGeo_Lat BETWEEN -90 AND 90
				AND ActionGeo_Long BETWEEN -180 AND 180
				AND GoldsteinScale IS NOT NULL
				AND GoldsteinScale BETWEEN ${goldsteinMin} AND ${goldsteinMax}
				${dateStart ? `AND SQLDATE >= ${dateStart.replace(/-/g, '')}` : ''}
				${dateEnd ? `AND SQLDATE <= ${dateEnd.replace(/-/g, '')}` : ''}
			)
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
			FROM event_categories
			WHERE rn <= 1000
			ORDER BY RANDOM()
			LIMIT 10000
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