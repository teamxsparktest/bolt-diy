#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Bolt.diy Cloudflare Pages Deployment Script ===${NC}"

# Memory optimization for Node.js
export NODE_OPTIONS="--max_old_space_size=3072"

# Build the application with optimized settings
echo -e "${YELLOW}Building the application with memory optimizations...${NC}"
remix vite:build --config vite.cloudflare.config.ts

# Deploy to Cloudflare Pages
echo -e "${YELLOW}Deploying to Cloudflare Pages...${NC}"
wrangler pages deploy ./build/client --project-name bolt-diy

echo -e "${GREEN}Deployment complete! Your application should be live on Cloudflare Pages.${NC}"
echo -e "${YELLOW}Check the Cloudflare dashboard for your application URL and settings.${NC}"
