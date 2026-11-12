import { json } from '@sveltejs/kit';
import { executeQuery } from './executeQuery';
import type { AnalyticsContext, AnalyticsHandler } from './types';

async function gdeltNarrativeSummary({ url }: AnalyticsContext): Promise<Response> {
  try {
    const country = url.searchParams.get('country');
    const dateStart = url.searchParams.get('dateStart');
    const dateEnd = url.searchParams.get('dateEnd');
    const topic = url.searchParams.get('topic') || 'general overview';

    // Gather context data for the LLM
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (country) {
      conditions.push(`actiongeo_countrycode = $${paramIndex}`);
      params.push(country);
      paramIndex++;
    }
    if (dateStart) {
      conditions.push(`sqldate >= $${paramIndex}`);
      params.push(parseInt(dateStart.replace(/-/g, '')));
      paramIndex++;
    }
    if (dateEnd) {
      conditions.push(`sqldate <= $${paramIndex}`);
      params.push(parseInt(dateEnd.replace(/-/g, '')));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Get summary stats for context
    const stats = await executeQuery(`
      SELECT COUNT(*) as total_events,
             AVG(goldsteinscale) as avg_goldstein,
             AVG(avgtone) as avg_tone,
             COUNT(DISTINCT actor1name) as unique_actors
      FROM gdelt_events ${whereClause}
    `, params);

    // Get top actors
    const actors = await executeQuery(`
      SELECT actor1name as actor, COUNT(*) as mentions
      FROM gdelt_events ${whereClause} ${conditions.length > 0 ? 'AND' : 'WHERE'} actor1name IS NOT NULL AND actor1name != ''
      GROUP BY actor1name ORDER BY mentions DESC LIMIT 5
    `, params);

    // Get top event types
    const eventTypes = await executeQuery(`
      SELECT eventrootcode, COUNT(*) as cnt
      FROM gdelt_events ${whereClause} ${conditions.length > 0 ? 'AND' : 'WHERE'} eventrootcode IS NOT NULL
      GROUP BY eventrootcode ORDER BY cnt DESC LIMIT 5
    `, params);

    const cameoLabels: Record<string, string> = {
      '1': 'Public Statements', '2': 'Appeals', '3': 'Cooperation',
      '4': 'Consultations', '5': 'Diplomatic Actions', '6': 'Material Cooperation',
      '7': 'Aid', '8': 'Concessions', '9': 'Investigations',
      '10': 'Demands', '11': 'Disapproval', '12': 'Rejection',
      '13': 'Threats', '14': 'Protests', '15': 'Military Posturing',
      '16': 'Sanctions', '17': 'Coercion', '18': 'Assault',
      '19': 'Armed Conflict', '20': 'Military Force'
    };

    const stat = stats[0] || {};
    const actorList = actors.map((a: any) => `${a.actor} (${a.mentions} events)`).join(', ');
    const eventList = eventTypes.map((e: any) => `${cameoLabels[e.eventrootcode] || e.eventrootcode}: ${e.cnt}`).join(', ');

    const countryName = country || 'Global';
    const goldsteinDesc = (stat.avg_goldstein || 0) > 1 ? 'cooperative' :
                          (stat.avg_goldstein || 0) < -1 ? 'conflictual' : 'mixed';
    const toneDesc = (stat.avg_tone || 0) > 1 ? 'positive' :
                     (stat.avg_tone || 0) < -1 ? 'negative' : 'neutral';

    const prompt = `You are a geopolitical intelligence analyst. Write a concise intelligence briefing (3-4 paragraphs) about ${countryName} based on GDELT event data.

Context data:
- Total events: ${stat.total_events || 0}
- Average Goldstein scale: ${Number(stat.avg_goldstein || 0).toFixed(2)} (${goldsteinDesc} — scale is -10 conflict to +10 cooperation)
- Average media tone: ${Number(stat.avg_tone || 0).toFixed(2)} (${toneDesc})
- Unique actors: ${stat.unique_actors || 0}
- Top actors: ${actorList || 'none'}
- Top event types: ${eventList || 'none'}
- Topic focus: ${topic}
${dateStart ? `- Date range: ${dateStart} to ${dateEnd || 'present'}` : ''}

Write a professional intelligence briefing that:
1. Summarizes the overall situation and key dynamics
2. Highlights the most significant actors and their roles
3. Notes any patterns in event types (cooperation vs conflict)
4. Provides a brief outlook or assessment

Be factual and analytical. Do not speculate beyond what the data suggests.`;

    // Call Ollama
    const ollamaHost = process.env.OLLAMA_HOST || 'http://ollama:11434';
    const ollamaResponse = await fetch(`${ollamaHost}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:4b',
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 500 }
      })
    });

    if (!ollamaResponse.ok) {
      const errText = await ollamaResponse.text();
      console.error('Ollama error:', errText);
      return json({ success: false, error: `LLM unavailable: ${ollamaResponse.status}` }, { status: 502 });
    }

    const ollamaData = await ollamaResponse.json() as any;
    const narrative = ollamaData.response || '';

    return json({
      success: true,
      data: {
        narrative,
        context: {
          country: countryName,
          totalEvents: stat.total_events,
          avgGoldstein: Number(stat.avg_goldstein || 0).toFixed(2),
          avgTone: Number(stat.avg_tone || 0).toFixed(2),
          topActors: actors.map((a: any) => a.actor),
          model: 'gemma3:4b'
        }
      }
    });
  } catch (error: any) {
    console.error('GDELT narrative summary failed:', error);
    return json({ success: false, error: error.message || 'Failed to generate narrative' }, { status: 500 });
  }
}

export const gdeltNarrativeHandlers: Record<string, AnalyticsHandler> = {
  'gdelt-narrative-summary': gdeltNarrativeSummary
};
