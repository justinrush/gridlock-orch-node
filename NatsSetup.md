# NATS Setup Guide

[← Back to Orchestration Node Setup](README.md)

Quick setup guide for NATS messaging system for the Gridlock storage layer.

## Prerequisites

- Docker installed on your system

## Quick Start

```bash
docker run -d --name nats-main --network gridlock-net \
  -p 4222:4222 -p 6222:6222 -p 8222:8222 \
  nats
```

## Test Connection

Subscribe to messages in one terminal:

```bash
nats sub test.subject --server nats://localhost:4222
```

Publish a message in another terminal:

```bash
nats pub test.subject "Testing NATS connection" --server nats://localhost:4222
```

Monitor all messages (optional):

```bash
nats sub '>' --server nats://localhost:4222
```

## Custom Configuration (Optional)

If you need custom NATS settings:

```bash
mkdir -p ~/.gridlock-orch-node
```

Create `~/.gridlock-orch-node/nats-server.conf`:

```conf
port: 4222
http_port: 8222
cluster {
  port: 6222
}
```

Run with custom config:

```bash
docker run -d --name nats-test \
  -p 4222:4222 \
  -p 8222:8222 \
  -p 6222:6222 \
  -v ~/.gridlock-orch-node/nats-server.conf:/etc/nats/nats-server.conf \
  nats:latest -c /etc/nats/nats-server.conf
```
