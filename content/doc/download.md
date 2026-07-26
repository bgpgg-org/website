+++
title = 'Download'
weight = 2
+++

## Installation

### Pre-built Binaries

Download the [latest release](https://github.com/roggnetwork/rogg/releases/latest) for your platform:

```bash
curl -LO https://github.com/roggnetwork/rogg/releases/download/<version>/rogg-<version>-x86_64-linux.tar.gz
tar xzf rogg-<version>-x86_64-linux.tar.gz
```

Each release ships two binaries:

- `bgpggd` - the BGP daemon
- `ggsh` - the gg shell, used to manage `bgpggd`

### From Source

Requires Rust.

```bash
git clone https://github.com/roggnetwork/rogg.git
cd rogg
make
```

Binaries land in `target/release/`.

### Docker

```bash
docker pull roggnetwork/bgpgg
```

## Quick Start

Create `rogg.conf`:

```
service bgp {
  asn 65000
  router-id 1.1.1.1
  listen-addr 0.0.0.0:179

  peer 192.168.1.1 {
    remote-as 65001
  }
}
```

Start the daemon (defaults to `/etc/rogg/rogg.conf`):

```bash
./bgpggd --config rogg.conf
```

Use `ggsh` to query and manage the running daemon:

```bash
./ggsh show bgp summary
./ggsh show bgp routes
```

Or open an interactive session:

```bash
./ggsh
ggsh> show bgp summary
ggsh> exit
```

## Docker

Run with defaults:

```bash
docker run -d --name bgpggd -p 179:179 roggnetwork/bgpgg
```

Use a config file:

```bash
docker run -d --name bgpggd -p 179:179 \
  -v $(pwd)/rogg.conf:/etc/rogg/rogg.conf \
  roggnetwork/bgpgg
```

Use `ggsh` against the container:

```bash
docker exec bgpggd ggsh show bgp summary
docker exec bgpggd ggsh show bgp routes
```

For a multi-speaker example, see [`bgpgg/docker/docker-compose.yml`](https://github.com/roggnetwork/rogg/blob/master/bgpgg/docker/docker-compose.yml).
