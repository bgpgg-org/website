---
title: Configuration
weight: 2
---

## Overview

bgpgg is configured using TOML configuration files.

## Configuration File

The main configuration file is located at `/etc/bgpgg/config.toml`.

### BGP Settings

```toml
[bgp]
router_id = "192.0.2.1"
local_as = 65000
```

### Neighbors

Configure BGP neighbors:

```toml
[[neighbors]]
address = "192.0.2.2"
remote_as = 65001
```

## Advanced Configuration

### Route Policies

Define route policies for filtering and manipulation.

### Observability

Enable metrics and logging:

```toml
[observability]
metrics_enabled = true
metrics_port = 9090
log_level = "info"
```
