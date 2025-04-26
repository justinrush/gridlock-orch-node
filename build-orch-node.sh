#!/bin/bash
set -e

# Function to increment version number
increment_version() {
    local version=$1
    local major=$(echo $version | cut -d. -f1)
    local minor=$(echo $version | cut -d. -f2)
    local patch=$(echo $version | cut -d. -f3)
    echo "$major.$minor.$((patch + 1))"
}

# Get current version from package.json
CURRENT_VERSION=$(grep -m 1 '"version":' package.json | cut -d'"' -f4)
echo "Current version: $CURRENT_VERSION"

# Increment version
NEW_VERSION=$(increment_version $CURRENT_VERSION)
echo "New version: $NEW_VERSION"

# Update package.json with new version
# Handle both macOS and Linux sed syntax
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
else
    # Linux
    sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
fi

DOCKER_REPO="gridlocknetwork/orch-node"
echo "Building ${DOCKER_REPO} image (version: ${NEW_VERSION})..."

# Build using the Dockerfile, targeting the optimized production stage
docker build --target production -t ${DOCKER_REPO}:${NEW_VERSION} -t ${DOCKER_REPO}:latest .

# Output image size for verification
echo -e "\nImage size information:"
docker images ${DOCKER_REPO}:${NEW_VERSION} --format "{{.Repository}}:{{.Tag}} - {{.Size}}"

echo -e "\n✅ Done! Image built: ${DOCKER_REPO}:${NEW_VERSION}"
echo "To run: docker run --rm -v /Users/${USER}/.gridlock-orch-node/.env:/app/.env -p 3000:3000 ${DOCKER_REPO}:latest"
