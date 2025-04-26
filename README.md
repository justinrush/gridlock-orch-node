## Gridlock Orchestration Node

The orchestration node (orch node) is a crucial component of the Gridlock Network. It acts as the heart of the network, facilitating communication between clients and guardians. The orch node enables complex interactions such as creating new wallets or signing transactions.

While the orchestration node ensures the smooth operation of the system, it is designed as a simple, secure component that maintains the privacy and security of the data without seeing any of the information being passed.

To understand how the full system works, see [SystemOverview.md](./SystemOverview.md).  
Related: [Guardian Node](https://github.com/GridlockNetwork/guardian-node) | [SDK](https://github.com/GridlockNetwork/gridlock-sdk) | [CLI](https://github.com/GridlockNetwork/gridlock-cli)

## Prerequisites

Setting up the orchestration node requires three essential components:

1. **Docker Network**: Required for local development and testing

   ```sh
   docker network create gridlock-net
   ```

   Note: This is only needed if you're running other containers locally (Guardian Nodes, MongoDB, NATS). If you're connecting to internet-based MongoDB and NATS services, you don't need this network.

2. **MongoDB Database**: Required for data persistence

   - Follow the [MongoDB Setup Guide](MongoDBSetup.md) to get started

3. **NATS Messaging**: Required for communication between components
   - Follow the [NATS Setup Guide](NatsSetup.md) to get started

Both MongoDB and NATS can be set up quickly using Docker, and their basic configurations are sufficient for development and testing purposes.

## Quick Start

The easiest way to get started is to run the official Docker image:

```sh
# Pull and run the latest image
docker run --rm --name orch-node --network gridlock-net \
  -p 3000:3000 \
  gridlocknetwork/orch-node:latest
```

This will use the default configuration. To customize, you'll want to provide your own configuration as described below.

## Local Development Setup

To run the project locally, copy and run these commands:

```sh
# Install dependencies and run in development mode
npm install
npm run compile
npm run dev
```

## Configuration

The application supports two configuration options:

1. Default config (baked into the image from example.env)
2. User config (overrides default)

We recommend storing your config file at the absolute path: `/Users/USERNAME/.gridlock-orch-node/.env` (replace `USERNAME` with your actual username).

### Using Docker Desktop

1. Open Docker Desktop
2. Search for and pull the `gridlocknetwork/orch-node` image
3. Go to the "Images" tab
4. Find the `gridlocknetwork/orch-node:latest` image
5. Click "Run"
6. In the "Optional settings" section:
   - Set the container name (optional)
   - Under "Volumes", click "Add volume"
   - Set the "Host path" to `/Users/USERNAME/.gridlock-orch-node/.env` (use absolute path)
   - Set the "Container path" to `/app/.env`
7. Click "Run"

### Using Command Line

```sh
# Run with user config (recommended)
docker run --rm -v /Users/USERNAME/.gridlock-orch-node/.env:/app/.env -p 3000:3000 gridlocknetwork/orch-node:latest

# Run with default config
docker run --rm -p 3000:3000 gridlocknetwork/orch-node:latest
```

Note: The default config is baked into the image from `.env.dev`. To use your own config, create it at `/Users/USERNAME/.gridlock-orch-node/.env` and mount it as shown above.

## Development

For those who want to develop or modify the orch-node, please refer to the development documentation in the repository.
