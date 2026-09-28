const fs = require('fs');
const path = 'src/services/edhrec/client.ts';
let content = fs.readFileSync(path, 'utf8');

// Add helper
const helper = `export class EdhrecHttpError extends Error {`;
const helperReplacement = `function isMissingPage(error: unknown): boolean {
  if (!error) return false;
  if ((error as any).status === 403 || (error as any).status === 404) return true;
  if (error instanceof Error && (error.message.includes('403') || error.message.includes('404'))) return true;
  return false;
}

export class EdhrecHttpError extends Error {`;

content = content.replace(helper, helperReplacement);

// Replace in fetchCommanderData
content = content.replace(
  `if (((lastError as EdhrecHttpError)?.status === 403 || (lastError as EdhrecHttpError)?.status === 404)) {`,
  `if (isMissingPage(lastError)) {`
);

// Replace in fetchCommanderThemeData
content = content.replace(
  `if (((lastError as EdhrecHttpError)?.status === 403 || (lastError as EdhrecHttpError)?.status === 404)) {`,
  `if (isMissingPage(lastError)) {`
);

// Replace in fetchCommanderCombos
const combosTarget = `} catch (error) {
      console.error(\`[EDHREC] Failed to fetch combos for \${commanderName}:\`, error);
      return [];
    }`;
const combosReplacement = `} catch (error) {
      if (isMissingPage(error)) return [];
      console.error(\`[EDHREC] Failed to fetch combos for \${commanderName}:\`, error);
      return [];
    }`;

content = content.replace(combosTarget, combosReplacement);

fs.writeFileSync(path, content);
