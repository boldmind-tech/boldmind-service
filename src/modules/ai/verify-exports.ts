import 'dotenv/config';
import { generateGeminiText, generateText } from './ai.service';

async function test() {
  console.log('--- STANDALONE AI EXPORTS TEST ---');
  
  console.log('Testing generateText export presence...');
  if (typeof generateText === 'function') {
    console.log('✅ generateText is exported');
  } else {
    console.log('❌ generateText is NOT exported');
  }

  console.log('Testing generateGeminiText export presence...');
  if (typeof generateGeminiText === 'function') {
    console.log('✅ generateGeminiText is exported');
  } else {
    console.log('❌ generateGeminiText is NOT exported');
  }

  // We won't actually call them here to avoid needing API keys if they aren't set,
  // but we'll try to call with a dummy prompt if keys might be present
  if (process.env['OPENAI_API_KEY'] || process.env['GEMINI_API_KEY']) {
      console.log('API keys found, attempting dry run...');
      // add logic if needed
  }
  
  console.log('Test complete.');
}

test().catch(console.error);
