// Test script to verify prisma.config.js loads correctly
import './prisma.config.js' with { type: 'json' };
import config from './prisma.config.js';

console.log('Config loaded successfully!');
console.log('DATABASE_URL is set:', !!config.default.datasource.url);
if (config.default.datasource.url) {
  const url = config.default.datasource.url;
  // Mask password in output
  const masked = url.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
  console.log('Database URL:', masked);
}

