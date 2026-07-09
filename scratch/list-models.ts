import { config } from '../src/config/env';

async function run() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.geminiApiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json() as any;
    console.log('--- Supported models with generateContent ---');
    for (const m of data.models || []) {
      if (m.supportedGenerationMethods?.includes('generateContent')) {
        console.log(m.name);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run();
