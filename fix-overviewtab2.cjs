const fs = require('fs');
const path = 'src/components/deck/optimizer/OverviewTab.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `{/* Theme chips */}
        <div className="p-3 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Themes</span>
          </div>`;

const replacement = `{/* Theme chips */}
        {chipThemes.length > 0 && (
        <div className="p-3 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Themes</span>
          </div>`;

content = content.replace(target, replacement);

const target2 = `        </div>

        {/* Deck Size override */}`;

const replacement2 = `        </div>
        )}

        {/* Deck Size override */}`;

content = content.replace(target2, replacement2);
fs.writeFileSync(path, content);
