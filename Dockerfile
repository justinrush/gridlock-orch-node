# Development stage
FROM node:lts-alpine AS development

# Labels for Docker Desktop to automatically configure 
LABEL com.docker.desktop.extension.icon="https://cdn-icons-png.flaticon.com/512/5968/5968322.png"
LABEL com.docker.container.network.publish.3000="3000"

# OCI Labels
LABEL org.opencontainers.image.title="Gridlock Orchestrator Node"
LABEL org.opencontainers.image.description="The orchestrator node manages and coordinates the Gridlock network operations, ensuring secure and efficient transaction processing."
LABEL org.opencontainers.image.vendor="Gridlock Network"
LABEL org.opencontainers.image.source="https://github.com/GridlockNetwork/orch-node"
LABEL org.opencontainers.image.licenses="Apache-2.0"

# Set working directory
WORKDIR /app

# Copy all application files
COPY package.json package-lock.json tsconfig.json ecosystem.config.json ./
COPY src/ ./src/
COPY example.env ./.env.default

# Install dependencies (including dev dependencies)
RUN npm ci && \
    npm run compile

# Install nodemon globally for better compatibility
RUN npm install -g nodemon

# Expose the port the app runs on
EXPOSE 3000

# Create development entrypoint script
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'if [ -f "/app/.env" ]; then' >> /app/entrypoint.sh && \
    echo '  echo "Using external .env file"' >> /app/entrypoint.sh && \
    echo '  cp /app/.env /app/.env.current' >> /app/entrypoint.sh && \
    echo 'else' >> /app/entrypoint.sh && \
    echo '  echo "Using development .env.dev values"' >> /app/entrypoint.sh && \
    echo '  cp /app/.env.default /app/.env' >> /app/entrypoint.sh && \
    echo 'fi' >> /app/entrypoint.sh && \
    echo 'exec "$@"' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Set the entrypoint to handle env vars and then run the app
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npm", "run", "dev"]

# Build stage - compile TypeScript
FROM node:18-alpine3.18 AS builder

WORKDIR /app

# Install only the build dependencies needed for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Install only dependencies needed for building
RUN npm ci && \
    npm prune --omit=optional

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build the application
RUN npm run compile

# Clean production dependencies stage with native module builds
FROM node:18-alpine3.18 AS dependencies

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Install ONLY production dependencies - with proper native builds
RUN npm ci --omit=dev --no-audit --no-fund && \
    npm prune --production && \
    # Clean up npm cache and tmp files
    rm -rf /root/.npm /tmp/* package-lock.json && \
    # Clean up unnecessary files in node_modules
    find node_modules -type d \( -name "test" -o -name "tests" -o -name "example" -o -name "examples" -o -name "docs" -o -name ".git" -o -name ".github" \) | xargs rm -rf || true && \
    # Remove unnecessary files by extension
    find node_modules -type f \( -name "*.md" -o -name "*.ts" -not -name "*.d.ts" -o -name "*.map" -o -name "*.min.js.map" -o -name "*.ts.map" -o -name "CHANGELOG*" -o -name "README*" -o -name "Makefile" -o -name "*.npmignore" -o -name "*.gitignore" -o -name "*.editorconfig" -o -name "*.eslintrc*" \) | xargs rm -f || true && \
    # Remove typescript and all .bin directories
    rm -rf node_modules/typescript || true

# Final production stage - ultra minimal
FROM node:18-alpine3.18 AS production

# Labels for Docker Desktop to automatically configure 
LABEL com.docker.desktop.extension.icon="https://cdn-icons-png.flaticon.com/512/5968/5968322.png"
LABEL com.docker.container.network.publish.3000="3000"

# OCI Labels
LABEL org.opencontainers.image.title="Gridlock Orchestrator Node"
LABEL org.opencontainers.image.description="The orchestrator node manages and coordinates the Gridlock network operations, ensuring secure and efficient transaction processing."
LABEL org.opencontainers.image.vendor="Gridlock Network"
LABEL org.opencontainers.image.source="https://github.com/GridlockNetwork/orch-node"
LABEL org.opencontainers.image.licenses="Apache-2.0"

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production

# Copy only the bare minimum files needed to run the application
COPY --from=builder /app/dist ./dist
COPY --from=dependencies /app/node_modules ./node_modules
COPY ecosystem.config.json ./
COPY example.env ./.env.default

# Create startup script to handle config
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'if [ -f "/app/.env" ]; then' >> /app/start.sh && \
    echo '  cp /app/.env /app/.env.current' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "No config mounted. Using default config."' >> /app/start.sh && \
    echo '  echo "For custom config, mount your config file at /app/.env"' >> /app/start.sh && \
    echo '  echo "Example: docker run -v /Users/USERNAME/.gridlock-orch-node/.env:/app/.env -p 3000:3000 gridlocknetwork/orch-node:latest"' >> /app/start.sh && \
    echo '  cp /app/.env.default /app/.env' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'exec "$@"' >> /app/start.sh && \
    chmod +x /app/start.sh

# Use a non-root user with minimal permissions
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app && \
    # Remove unnecessary files
    rm -rf /var/cache/apk/* /tmp/*

USER appuser

# Expose the port the app runs on
EXPOSE 3000

# Set the entrypoint to handle config and then run the app
ENTRYPOINT ["/app/start.sh"]
CMD ["node", "dist/index.js"]
