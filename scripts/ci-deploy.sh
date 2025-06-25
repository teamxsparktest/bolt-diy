#!/bin/bash
set -e

# Default to pages if not specified
DEPLOY_TARGET=${1:-pages}
PROJECT_NAME="bolt-diy"

echo "🚀 Preparing for Cloudflare ${DEPLOY_TARGET} deployment..."

# Build the application
echo "🔨 Building application..."
cross-env NODE_OPTIONS=--max_old_space_size=3072 remix vite:build --config vite.cloudflare.config.ts

if [ "$DEPLOY_TARGET" = "pages" ]; then
  echo "📄 Deploying to Cloudflare Pages..."

  # Backup original wrangler.toml if it exists
  if [ -f wrangler.toml ]; then
    echo "📦 Backing up original wrangler.toml..."
    mv wrangler.toml wrangler.toml.bak
  fi

  # Copy Pages-specific config to wrangler.toml
  echo "📝 Setting up Pages-specific wrangler configuration..."
  cp wrangler.pages.toml wrangler.toml

  # Deploy to Pages
  echo "🚀 Deploying to Cloudflare Pages..."
  npx wrangler pages deploy ./build/client --project-name $PROJECT_NAME

  # Restore original wrangler.toml
  if [ -f wrangler.toml.bak ]; then
    echo "🔄 Restoring original wrangler.toml..."
    mv wrangler.toml.bak wrangler.toml
  fi

  echo "✅ Pages deployment completed successfully!"
elif [ "$DEPLOY_TARGET" = "workers" ]; then
  echo "👷 Deploying to Cloudflare Workers..."

  # Deploy using wrangler
  npx wrangler deploy

  echo "✅ Workers deployment completed successfully!"
else
  echo "❌ Invalid deployment target. Use 'pages' or 'workers'."
  exit 1
fi
