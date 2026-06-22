import fs from 'fs';

function refactorFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Add import if not exists
  if (!code.includes('import { sileo }')) {
    code = code.replace(/import \{ useState/g, 'import { sileo }\nimport { useState');
    // if no useState import, find first import
    if (!code.includes('import { sileo }')) {
      code = code.replace(/import /, 'import { sileo } from "sileo"\nimport ');
    }
  }

  // Remove error state
  code = code.replace(/const \[error, setError\] = useState<string \| null>\(null\);?\n?\s*/g, '');
  code = code.replace(/const \[error, setError\] = useState<string \| null>\(null\)/g, '');

  // Remove success state
  code = code.replace(/const \[success, setSuccess\] = useState\(false\);?\n?\s*/g, '');
  code = code.replace(/const \[successMsg, setSuccessMsg\] = useState<string \| null>\(null\);?\n?\s*/g, '');

  // Replace setError
  code = code.replace(/setError\(([^)]+)\)/g, (match, msg) => {
    if (msg.trim() === 'null') return '';
    return `sileo.error({ title: "Error", description: ${msg} })`;
  });

  // Replace setSuccess
  code = code.replace(/setSuccess\(([^)]+)\)/g, (match, msg) => {
    if (msg.trim() === 'false') return '';
    if (msg.trim() === 'true') return `sileo.success({ title: "Éxito", description: "Operación completada" })`;
    return `sileo.success({ title: "Éxito", description: ${msg} })`;
  });

  // Replace setSuccessMsg
  code = code.replace(/setSuccessMsg\(([^)]+)\)/g, (match, msg) => {
    if (msg.trim() === 'null') return '';
    return `sileo.success({ title: "Éxito", description: ${msg} })`;
  });

  // Remove <Alert variant="destructive"> blocks using {error && ...}
  code = code.replace(/\{error &&[^{}]*<Alert variant="destructive">[\s\S]*?<\/Alert>\s*\)\}\n?/g, '');
  code = code.replace(/\{error && xmlColumns\.length === 0 && \([\s\S]*?<\/Alert>\s*\)\}\n?/g, '');
  
  // Remove {success && ...} blocks
  code = code.replace(/\{successMsg &&[^{}]*<Alert className="bg-emerald-50[\s\S]*?<\/Alert>\s*\)\}\n?/g, '');

  // Specific fix for tabs in importar-datos-client
  code = code.replace(/setError\(null\);/g, '');
  code = code.replace(/; setResult\(null\)/g, 'setResult(null)');
  code = code.replace(/\{ setActiveTab\(v\); ; setResult\(null\); setMapping\(\{\} \)\}/g, '{ setActiveTab(v); setResult(null); setMapping({}) }');

  // Fix props in ImportActions
  code = code.replace(/error=\{error\}\s*/g, '');
  code = code.replace(/error: string \| null\s*/g, '');
  
  // Fix double semicolons
  code = code.replace(/; ;/g, ';');
  code = code.replace(/\{\s*;\s*/g, '{ ');

  fs.writeFileSync(filePath, code);
  console.log(`Refactored ${filePath}`);
}

const files = [
  'components/importar-datos-client.tsx',
  'components/gestion-usuarios-client.tsx',
  'components/exportar-datos-client.tsx',
  'components/editar-censo-client.tsx',
  'components/configurar-campos-client.tsx',
  'components/capturar-registro-client.tsx'
];

files.forEach(refactorFile);
