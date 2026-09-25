import { fetchCommunityBrawlPopularity } from '../../src/services/brawl/fetchCommunityBrawlPopularity';

export async function handleBrawlPopularity(params: Record<string, string | undefined>) {
  const commanderName = params.commanderName?.trim();
  if (!commanderName) {
    return { statusCode: 400, body: JSON.stringify({ error: 'commanderName required' }) };
  }

  const result = await fetchCommunityBrawlPopularity(commanderName);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(result),
  };
}
