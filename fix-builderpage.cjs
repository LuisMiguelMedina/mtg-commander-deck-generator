const fs = require('fs');
const path = 'src/pages/BuilderPage.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `<div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                      2
                    </div>
                    Archetype
                  </CardTitle>`;
const replacement = `<div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                      2
                    </div>
                    {customization.formatMode === 'brawl100' ? 'Popular Cards' : 'Archetype'}
                  </CardTitle>`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
