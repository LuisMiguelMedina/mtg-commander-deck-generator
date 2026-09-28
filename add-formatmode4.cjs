const fs = require('fs');
const path = 'src/components/lists/ListDeckView.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `  const customization = useStore(s => s.customization);
  const updateCustomization = useStore(s => s.updateCustomization);`;
const replacement = `  const customization = useStore(s => s.customization);
  const updateCustomization = useStore(s => s.updateCustomization);

  useEffect(() => {
    if (list.type === 'deck') {
      let mode = list.formatMode;
      if (!mode && list.generationSummary?.includes('Arena (Brawl)')) {
        mode = 'brawl100';
      }
      mode = mode || 'commander';
      
      if (customization.formatMode !== mode) {
        updateCustomization({ formatMode: mode });
      }
    }
  }, [list.id, list.type, list.formatMode, list.generationSummary, customization.formatMode, updateCustomization]);`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
