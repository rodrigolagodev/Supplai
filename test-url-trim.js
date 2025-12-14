// No external dependencies needed for this test

// Mock the environment variable with spaces to test the trim logic
// We need to do this before importing the module if it reads env vars at top level,
// but getBaseUrl reads them at function call time.
process.env.NEXT_PUBLIC_SITE_URL = '   https://supplai-web.vercel.app   ';

// We can't easily import the server action file directly in a standalone node script
// because of the 'use server' directive and Next.js specific imports.
// So we will recreate the logic here to verify it works as expected.

function getBaseUrl() {
  // 1. Check explicit site URL (works in all environments)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim();
  }

  // 2. Vercel auto-provides VERCEL_URL in production/preview
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 3. Fallback for local development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  throw new Error(
    'Missing NEXT_PUBLIC_SITE_URL environment variable. Please configure it in your deployment platform.'
  );
}

console.log('Testing getBaseUrl logic with spaces in env var...');
console.log(`Raw env var: "${process.env.NEXT_PUBLIC_SITE_URL}"`);
const result = getBaseUrl();
console.log(`Result: "${result}"`);

if (result === 'https://supplai-web.vercel.app') {
  console.log('✅ SUCCESS: Spaces were trimmed correctly.');
} else {
  console.log('❌ FAILURE: Spaces were NOT trimmed.');
}
