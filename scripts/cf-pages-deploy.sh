#!/bin/bash
set -e

echo "🚀 Preparing for Cloudflare Pages deployment..."

# Backup original wrangler.toml if it exists
if [ -f wrangler.toml ]; then
  echo "📦 Backing up original wrangler.toml..."
  mv wrangler.toml wrangler.toml.bak
fi

# Copy Pages-specific config to wrangler.toml
echo "📝 Setting up Pages-specific wrangler configuration..."
cp wrangler.pages.toml wrangler.toml

# Deploy to Cloudflare Pages
echo "🚀 Deploying to Cloudflare Pages..."
npx wrangler pages deploy ./build/client --project-name bolt-diy

# Restore original wrangler.toml
if [ -f wrangler.toml.bak ]; then
  echo "🔄 Restoring original wrangler.toml..."
  mv wrangler.toml.bak wrangler.toml
fi

echo "✅ Deployment completed!"
