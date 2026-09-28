const fs = require('fs');
const path = 'src/services/spellchroma/tagIndex.ts';
let content = fs.readFileSync(path, 'utf8');

const dictTarget = `const file: TagDictionaryFile = await res.json();`;
const dictReplacement = `const text = await res.text();
      let file: TagDictionaryFile;
      try {
        file = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid JSON response: ' + text.slice(0, 100));
      }`;

const indexTarget = `const file: TagIndexFile = await res.json();`;
const indexReplacement = `const text = await res.text();
      let file: TagIndexFile;
      try {
        file = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid JSON response: ' + text.slice(0, 100));
      }`;

content = content.replace(dictTarget, dictReplacement).replace(indexTarget, indexReplacement);

fs.writeFileSync(path, content);
