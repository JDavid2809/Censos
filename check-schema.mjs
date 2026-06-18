import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

let supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'] || "";
if (supabaseUrl.endsWith('/rest/v1/')) supabaseUrl = supabaseUrl.slice(0, -'/rest/v1/'.length);
if (supabaseUrl.endsWith('/rest/v1')) supabaseUrl = supabaseUrl.slice(0, -'/rest/v1'.length);
supabaseUrl = supabaseUrl.replace(/\/+$/, '');

async function check() {
  console.log("URL:", supabaseUrl);
  const url = `${supabaseUrl}/rest/v1/?apikey=${envVars['SUPABASE_SERVICE_ROLE_KEY']}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    fs.writeFileSync('schema.json', text);
    console.log("Saved OpenAPI schema to schema.json");
  } catch (err) {
    console.error(err);
  }
}
check();
