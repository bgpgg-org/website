---
title: Getting Started
weight: 1
---

# Getting Started with bgpgg

This guide will help you install and run your first BGP router with bgpgg.

## Installation

### Download Pre-built Binary

Download the latest release for your platform from [GitHub releases](https://github.com/bgpgg-org/bgpgg/releases/latest).

For Linux x86_64:

```bash
# Replace v0.2.0 with the latest version
curl -LO https://github.com/bgpgg-org/bgpgg/releases/download/v0.2.0/bgpgg-v0.2.0-x86_64-linux.tar.gz
tar xzf bgpgg-v0.2.0-x86_64-linux.tar.gz
cd bgpgg-v0.2.0-x86_64-linux
```

The archive contains two binaries:
- `bgpggd` - The BGP daemon
- `bgpgg` - The CLI tool for managing the daemon

### Build from Source

Requirements:
- Rust 1.70 or later
- Cargo

```bash
git clone https://github.com/bgpgg-org/bgpgg
cd bgpgg
make
```

Binaries will be in `target/release/`:
- `target/release/bgpggd`
- `target/release/bgpgg`

## Quick Start

### 1. Create a Configuration File

Create `config.yaml`:

```yaml
asn: 65000
router_id: 1.1.1.1
listen_addr: "0.0.0.0:17900"  # Use high port to avoid needing root
grpc_listen_addr: "[::1]:50051"
log_level: "info"

peers:
  - address: "192.168.1.2:17900"
    asn: 65001
```

### 2. Start the Daemon

```bash
./bgpggd -c config.yaml
```

Or if built from source:

```bash
./target/release/bgpggd -c config.yaml
```

The daemon will:
- Start listening for BGP connections on port 17900
- Start the gRPC API server on port 50051
- Attempt to peer with configured neighbors

### 3. Check Peer Status

In another terminal:

```bash
./bgpgg peer list
```

Output:
```
ADDRESS              ASN     STATE         UPTIME
192.168.1.2:17900    65001   Established   5m 23s
```

### 4. Add a Route

Announce a route to your peers:

```bash
./bgpgg global rib add 10.0.0.0/24 --nexthop 192.168.1.1
```

### 5. View the Routing Table

```bash
./bgpgg global rib show
```

## Try with Docker

The easiest way to try bgpgg is with Docker Compose:

```bash
# Download docker-compose.yml
curl -LO https://raw.githubusercontent.com/bgpgg-org/bgpgg/master/docker/docker-compose.yml

# Start two peered BGP routers
docker compose up -d

# Check peering status
docker exec bgpgg1 bgpgg peer list

# Add a route on router 1
docker exec bgpgg1 bgpgg global rib add 10.0.0.0/24 --nexthop 172.20.0.10

# See it propagate to router 2
docker exec bgpgg2 bgpgg global rib show
```

## Common Tasks

### Add a Peer at Runtime

```bash
bgpgg peer add 192.168.1.3:17900 65002
```

### Remove a Peer

```bash
bgpgg peer del 192.168.1.3:17900
```

### View Server Information

```bash
bgpgg global info
```

### View Statistics Summary

```bash
bgpgg global summary
```

### Remove a Route

```bash
bgpgg global rib del 10.0.0.0/24
```

## Configuration Notes

- **Port Selection**: Using ports above 1024 (like 17900) avoids needing root privileges. The standard BGP port 179 requires root.
- **Router ID**: Must be a valid IPv4 address. Typically uses a loopback or management IP.
- **ASN**: Your Autonomous System Number. Use private ASNs (64512-65534) for testing.

## Next Steps

- [Configuration Guide](configuration) - Learn about all configuration options
- [CLI Reference](cli) - Explore all CLI commands
- [Architecture](architecture) - Understand how bgpgg works internally
