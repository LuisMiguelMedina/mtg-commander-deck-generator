const fs = require('fs');
const path = 'src/components/deck/optimizer/OverviewTab.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `{/* Theme chips */}
        <div className="p-3 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Themes</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {chipThemes.map(chip => {`;

const replacement = `{/* Theme chips */}
        {chipThemes.length > 0 && (
          <div className="p-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-3 h-3 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Themes</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {chipThemes.map(chip => {`;

content = content.replace(target, replacement);

const target2 = `  {/* Tempo section */}`;
// Wait, is there a `{/* Tempo section */}`? Let's check what's right after chipThemes.map.
