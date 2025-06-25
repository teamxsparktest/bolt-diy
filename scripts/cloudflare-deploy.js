#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Parse command line arguments
const args = process.argv.slice(2);
const deployTarget = args[0] || 'pages'; // Default to pages if not specified
const projectName = 'bolt-diy';

const rootDir = path.resolve(process.cwd());
const wranglerPath = path.join(rootDir, 'wrangler.toml');
const wranglerBackupPath = path.join(rootDir, 'wrangler.toml.bak');
const wranglerPagesPath = path.join(rootDir, 'wrangler.pages.toml');

console.log(`🚀 Preparing for Cloudflare ${deployTarget.toUpperCase()} deployment...`);

// Build the application
console.log('🔨 Building application...');
try {
  // Set NODE_OPTIONS directly in the environment
  process.env.NODE_OPTIONS = '--max_old_space_size=3072';

  execSync('npx remix vite:build --config vite.cloudflare.config.ts', {
    stdio: 'inherit',
    env: { ...process.env }
  });
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Handle deployment based on target
if (deployTarget === 'pages') {
  deployToPages();
} else if (deployTarget === 'workers') {
  deployToWorkers();
} else {
  console.error('❌ Invalid deployment target. Use "pages" or "workers".');
  process.exit(1);
}

function deployToPages() {
  console.log('📄 Deploying to Cloudflare Pages...');

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
    execSync(`npx wrangler pages deploy ./build/client --project-name ${projectName}`, {
      stdio: 'inherit'
    });

    console.log('✅ Pages deployment completed successfully!');
  } catch (error) {
    console.error('❌ Pages deployment failed:', error.message);
    process.exitCode = 1;
  } finally {
    // Restore original wrangler.toml
    if (fs.existsSync(wranglerBackupPath)) {
      console.log('🔄 Restoring original wrangler.toml...');
      fs.renameSync(wranglerBackupPath, wranglerPath);
    }
  }
}

function deployToWorkers() {
  console.log('👷 Deploying to Cloudflare Workers...');

  try {
    // Deploy using wrangler
    execSync(`npx wrangler deploy`, {
      stdio: 'inherit'
    });

    console.log('✅ Workers deployment completed successfully!');
  } catch (error) {
    console.error('❌ Workers deployment failed:', error.message);
    process.exitCode = 1;
  }
}
