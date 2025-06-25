#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Bolt.diy Cloudflare Deployment Script ===${NC}"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: wrangler is not installed. Please install it with 'npm install -g wrangler'${NC}"
    exit 1
fi

# Check if logged in to Cloudflare
echo -e "${YELLOW}Checking Cloudflare login status...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Cloudflare. Please login:${NC}"
    wrangler login
fi

# Validate wrangler.toml configuration
echo -e "${YELLOW}Validating wrangler.toml configuration...${NC}"
if grep -q "placeholder-db-id" wrangler.toml || grep -q "placeholder-kv-id" wrangler.toml; then
    echo -e "${RED}Error: You need to update the placeholder IDs in wrangler.toml with your actual Cloudflare resource IDs.${NC}"
    exit 1
fi

# Build the application
echo -e "${YELLOW}Building the application...${NC}"
pnpm run build

# Initialize the database if it doesn't exist
echo -e "${YELLOW}Checking if database schema needs to be initialized...${NC}"
DB_ID=$(grep -oP 'database_id\s*=\s*"\K[^"]+' wrangler.toml)
if [ -n "$DB_ID" ]; then
    echo -e "${YELLOW}Initializing database schema...${NC}"
    wrangler d1 execute bolt-database --file=./schema.sql
else
    echo -e "${RED}Error: Could not find database_id in wrangler.toml${NC}"
    exit 1
fi

# Deploy to Cloudflare Pages
echo -e "${YELLOW}Deploying to Cloudflare Pages...${NC}"
wrangler pages deploy ./build/client --project-name bolt-diy

echo -e "${GREEN}Deployment complete! Your application is now live on Cloudflare.${NC}"
echo -e "${YELLOW}Don't forget to check the Cloudflare dashboard for your application URL and settings.${NC}"
