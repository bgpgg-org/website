---
title: Getting Started
weight: 1
---

## Installation

Install bgpgg using your preferred method.

### Binary

Download the latest binary from GitHub releases.

### Build from source

```bash
git clone https://github.com/bgpgg-org/bgpgg
cd bgpgg
cargo build --release
```

## Configuration

Configure bgpgg by editing the configuration file.

### Basic configuration

Create a configuration file at `/etc/bgpgg/config.toml`:

```toml
[bgp]
router_id = "192.0.2.1"
local_as = 65000
```

## Running bgpgg

Start the BGP daemon:

```bash
bgpgg daemon start
```
