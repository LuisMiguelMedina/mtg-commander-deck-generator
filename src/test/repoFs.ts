/**
 * Test-only filesystem reads. The app tsconfig has no @types/node, so the
 * Node builtin is loaded through a variable specifier (tsc leaves it as any).
 */

type DirEnt = {
  name: string;
  isDirectory: () => boolean;
  isFile: () => boolean;
};

type NodeFs = {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
  readdirSync: (path: string, options: { withFileTypes: true }) => DirEnt[];
};

async function nodeFs(): Promise<NodeFs> {
  const specifier = 'node:fs';
  return import(/* @vite-ignore */ specifier) as Promise<NodeFs>;
}

function abs(relative: string): string {
  return new URL(`../../${relative}`, import.meta.url).pathname;
}

export async function repoPathExists(relative: string): Promise<boolean> {
  const fs = await nodeFs();
  return fs.existsSync(abs(relative));
}

export async function readRepoText(relative: string): Promise<string> {
  const fs = await nodeFs();
  return fs.readFileSync(abs(relative), 'utf8');
}

export async function walkRepoTs(relative: string): Promise<string[]> {
  const fs = await nodeFs();
  const root = abs(relative);
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const visit = (dir: string, prefix: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(`${dir}/${entry.name}`, rel);
      else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(`${relative}/${rel}`);
    }
  };
  visit(root, '');
  return out;
}
