import { fetchCommunityBrawlPopularity } from '../../src/services/brawl/fetchCommunityBrawlPopularity';
import { fetchBrawlTopCommandersServer } from '../../src/services/brawl/fetchBrawlTopCommanders';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=3600',
  'Access-Control-Allow-Origin': '*',
};

export async function handleBrawlPopularity(params: Record<string, string | undefined>) {
  const commanderName = params.commanderName?.trim();
  if (!commanderName) {
    return { statusCode: 400, body: JSON.stringify({ error: 'commanderName required' }) };
  }

  const result = await fetchCommunityBrawlPopularity(commanderName);
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify(result),
  };
}

export async function handleBrawlTopCommanders() {
  const result = await fetchBrawlTopCommandersServer();
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify(result),
  };
}
