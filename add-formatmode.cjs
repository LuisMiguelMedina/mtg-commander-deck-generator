const fs = require('fs');
const path = 'src/types/index.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `export interface UserCardList {
  id: string;
  type?: 'list' | 'deck';`;
const replacement = `export interface UserCardList {
  id: string;
  type?: 'list' | 'deck';
  formatMode?: FormatMode;`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
