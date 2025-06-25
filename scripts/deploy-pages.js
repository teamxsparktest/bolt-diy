import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

console.log('🚀 Preparing for Cloudflare Pages deployment...');

const rootDir = path.resolve(process.cwd());
const wranglerPath = path.join(rootDir, 'wrangler.toml');
const wranglerBackupPath = path.join(rootDir, 'wrangler.toml.bak');
const wranglerPagesPath = path.join(rootDir, 'wrangler.pages.toml');

// Backup original wrangler.toml if it exists
if (fs.existsSync(wranglerPath)) {
  console.log('📦 Backing up original wrangler.toml...');
  fs.renameSync(wranglerPath, wranglerBackupPath);
}

try {
  // Copy Pages-specific config to wrangler.toml
  console.log('📝 Setting up Pages-specific wrangler configuration...');
  fs.copyFileSync(wranglerPagesPath, wranglerPath);

  // Run the deploy command
  console.log('🚀 Deploying to Cloudflare Pages...');
  execSync('npx wrangler pages deploy ./build/client --project-name bolt-diy', {
    stdio: 'inherit'
  });

  console.log('✅ Deployment completed successfully!');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exitCode = 1;
} finally {
  // Restore original wrangler.toml
  if (fs.existsSync(wranglerBackupPath)) {
    console.log('🔄 Restoring original wrangler.toml...');
    fs.renameSync(wranglerBackupPath, wranglerPath);
  }
}
