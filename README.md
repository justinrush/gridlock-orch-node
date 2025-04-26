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
docker run --rm --name orch-node --network gridlock-net \
  -p 3000:3000 \
  gridlocknetwork/orch-node:latest
```

This will use the default configuration. To customize, you'll want to provide your own configuration as described below.

## Configuration

The application supports two configuration options:

1. Default config (baked into the image from example.env)
2. User config (overrides default)

We recommend storing your config file at the absolute path: `/Users/USERNAME/.gridlock-orch-node/.env` (replace `USERNAME` with your actual username).

To run with a custom configuration:

```sh
docker run --rm --name orch-node --network gridlock-net \
  -v /Users/USERNAME/.gridlock-orch-node/.env:/app/.env \
  -p 3000:3000 \
  gridlocknetwork/orch-node:latest
```

## Local Development Setup

To run the project locally, copy and run these commands:

```sh
npm install
npm run compile
npm run dev
```