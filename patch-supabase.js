// Patches @supabase/supabase-js to remove dynamic import() that Hermes can't compile
const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, 'node_modules/@supabase/supabase-js/dist/index.cjs'),
  path.join(__dirname, 'node_modules/@supabase/supabase-js/dist/index.mjs'),
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  const patched = content.replace(
    /otelModulePromise = import\(\s*\/\*[^*]*\*\/\s*\/\*[^*]*\*\/\s*OTEL_PKG\s*\)/g,
    'otelModulePromise = Promise.resolve(null)'
  );
  if (patched !== content) {
    fs.writeFileSync(file, patched);
    console.log('Patched:', file);
  }
});
