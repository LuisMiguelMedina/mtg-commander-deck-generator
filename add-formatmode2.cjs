const fs = require('fs');
const path = 'src/hooks/useUserLists.ts';
let content = fs.readFileSync(path, 'utf8');

const target1 = `interface CreateListOptions {
  type?: 'list' | 'deck';`;
const replacement1 = `interface CreateListOptions {
  type?: 'list' | 'deck';
  formatMode?: string;`;

content = content.replace(target1, replacement1);

const target2 = `const newList: UserCardList = {
      id: \`list-\${now}\`,
      type: options?.type ?? 'list',`;
const replacement2 = `const newList: UserCardList = {
      id: \`list-\${now}\`,
      type: options?.type ?? 'list',
      formatMode: options?.formatMode as any,`;

content = content.replace(target2, replacement2);
fs.writeFileSync(path, content);
