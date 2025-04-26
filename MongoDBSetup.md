# MongoDB Setup Guide

[← Back to Orchestration Node Setup](README.md)

Quick setup guide for MongoDB for the Gridlock storage layer.

## Prerequisites

- Docker installed on your system

## Quick Start

```bash
docker run -d --name mongodb --network gridlock-net \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=gridlock_admin \
  -e MONGO_INITDB_ROOT_PASSWORD=gridlock_dev_password \
  mongo:latest
```

Verify the connection:

```bash
docker exec -it mongodb mongosh -u gridlock_admin -p gridlock_dev_password
```

Note: The application will automatically create the necessary database and collections when it starts up.

## Custom Configuration (Optional)

If you need custom MongoDB settings:

```bash
mkdir -p ~/.gridlock-orch-node
```

Create `~/.gridlock-orch-node/mongodb.conf`:

```yaml
storage:
  dbPath: /data/db
net:
  port: 27017
  bindIp: 0.0.0.0
```

Run with custom config:

```bash
docker run -d --name mongodb \
  -p 27017:27017 \
  -v ~/.gridlock-orch-node/mongodb.conf:/etc/mongod.conf \
  -v mongodb_data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=gridlock_admin \
  -e MONGO_INITDB_ROOT_PASSWORD=gridlock_dev_password \
  mongo:latest --config /etc/mongod.conf
```

## Security Considerations

- Always use strong passwords for database users
- Enable authentication in production environments
- Consider using TLS for secure connections
- Implement proper access controls
- Regularly backup your data
- Keep MongoDB updated to the latest stable version
