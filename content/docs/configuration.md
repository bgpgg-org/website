---
title: Configuration
weight: 2
---

# Configuration Reference

bgpgg uses YAML configuration files. This guide covers all configuration options.

## Configuration File Location

By default, bgpgg looks for configuration in:
- `/etc/bgpgg/config.yaml`
- Specify custom location: `bgpggd -c /path/to/config.yaml`

## Basic Configuration

Minimal configuration:

```yaml
asn: 65000
router_id: 1.1.1.1
```

Complete basic example:

```yaml
asn: 65000
router_id: 1.1.1.1
listen_addr: "0.0.0.0:17900"
grpc_listen_addr: "[::1]:50051"
hold_time_secs: 180
connect_retry_secs: 30
log_level: "info"

peers:
  - address: "192.168.1.2:17900"
    asn: 65001
```

## Global Settings

### `asn` (required)

Your Autonomous System Number.

```yaml
asn: 65000
```

- Public ASNs: 1-64511, 131072-4199999999
- Private ASNs: 64512-65534, 4200000000-4294967294

### `router_id` (required)

Router identifier as an IPv4 address.

```yaml
router_id: 1.1.1.1
```

Must be unique in your BGP network. Typically a loopback or management IP.

### `listen_addr`

BGP TCP listening address and port.

```yaml
listen_addr: "0.0.0.0:17900"
```

- Default: `0.0.0.0:179` (standard BGP port, requires root)
- Use ports > 1024 to avoid requiring root privileges
- IPv6: `[::]:17900`

### `grpc_listen_addr`

gRPC API server listening address and port.

```yaml
grpc_listen_addr: "127.0.0.1:50051"
```

- Default: `127.0.0.1:50051`
- The CLI uses this to communicate with the daemon
- IPv6: `[::1]:50051`

### `hold_time_secs`

BGP hold timer in seconds (RFC 4271).

```yaml
hold_time_secs: 180
```

- Default: 180 seconds (3 minutes)
- Keepalive interval is hold_time / 3
- Minimum: 3 seconds (negotiated with peer)

### `connect_retry_secs`

Connect retry timer in seconds.

```yaml
connect_retry_secs: 30
```

- Default: 30 seconds
- Time to wait before retrying failed TCP connections

### `accept_unconfigured_peers`

Accept BGP connections from unconfigured peers.

```yaml
accept_unconfigured_peers: true
```

- Default: `false`
- When enabled, accepts connections from any peer
- Security implications: See RFC 4272

### `log_level`

Logging verbosity level.

```yaml
log_level: "info"
```

Options: `error`, `warn`, `info` (default), `debug`

## Peer Configuration

Configure BGP neighbors:

```yaml
peers:
  - address: "192.168.1.2:17900"
    asn: 65001
    idle_hold_time_secs: 30
    damp_peer_oscillations: true
    passive_mode: false
```

### Peer Settings

#### `address` (required)

Peer IP address and port.

```yaml
address: "192.168.1.2:17900"
```

Format: `IP:PORT` or `[IPv6]:PORT`

#### `asn`

Remote AS number (added at runtime, not typically in config file).

#### `idle_hold_time_secs`

Delay before automatic restart after connection failure (RFC 4271 8.1.1).

```yaml
idle_hold_time_secs: 30
```

- Default: 30 seconds
- `null` or omit: Disable automatic restart
- `0`: Immediate restart

#### `damp_peer_oscillations`

Enable exponential backoff for flapping peers (RFC 4271 8.1.1).

```yaml
damp_peer_oscillations: true
```

- Default: `true`
- Increases idle_hold_time exponentially on repeated failures: `base * 2^consecutive_down_count`
- Capped at 120 seconds
- Reset when peer reaches Established and completes handshake

#### `allow_automatic_stop`

Allow the FSM to automatically stop the peer.

```yaml
allow_automatic_stop: true
```

- Default: `true`

#### `passive_mode`

Wait for peer to initiate connection instead of connecting actively.

```yaml
passive_mode: true
```

- Default: `false`
- When enabled, peer stays in Idle state and waits for incoming connections
- Useful for peers behind NAT or firewalls

#### `delay_open_time_secs`

Delay before sending OPEN message (RFC 4271 8.1.1).

```yaml
delay_open_time_secs: 5
```

- Default: None (disabled)
- Helps avoid race conditions in simultaneous connections

#### `max_prefix`

Maximum number of prefixes to accept from peer.

```yaml
peers:
  - address: "192.168.1.2:17900"
    max_prefix:
      limit: 10000
      action: terminate  # or "discard"
```

Actions:
- `terminate`: Send CEASE notification and close session (default)
- `discard`: Silently discard new prefixes but keep session alive

#### `send_notification_without_open`

Allow sending NOTIFICATION before OPEN (RFC 4271 8.2.1.5).

```yaml
send_notification_without_open: true
```

- Default: `false`

#### `collision_detect_established_state`

Process connection collisions even in Established state (RFC 4271 8.1.1).

```yaml
collision_detect_established_state: true
```

- Default: `false`

#### `min_route_advertisement_interval_secs`

Minimum seconds between route advertisements (RFC 4271 9.2.1.1).

```yaml
min_route_advertisement_interval_secs: 30
```

- Default: 30 seconds for eBGP, 5 seconds for iBGP

#### `import_policy` / `export_policy`

Policy names to apply to routes (see [Policy Configuration](#policy-configuration)).

```yaml
peers:
  - address: "192.168.1.2:17900"
    import-policy:
      - block-rfc1918
      - set-local-pref
    export-policy:
      - announce-customer-routes
```

## BMP Configuration

Configure BGP Monitoring Protocol servers:

```yaml
bmp_servers:
  - address: "127.0.0.1:11019"
    statistics_timeout: 60
  - address: "192.168.1.10:11019"
```

### BMP Settings

#### `address`

BMP collector address and port.

```yaml
address: "127.0.0.1:11019"
```

- bgpgg acts as BMP client and connects to this server
- Default BMP port: 11019

#### `statistics_timeout`

Statistics reporting interval in seconds.

```yaml
statistics_timeout: 60
```

- Default: None (disabled)
- `0` or omit: Disable statistics reports
- Sends periodic BMP Statistics Report messages

### BMP System Information

#### `sys_name`

System name sent in BMP Initiation messages.

```yaml
sys_name: "bgp-router-01"
```

- Default: `bgpgg {router_id}`

#### `sys_descr`

System description sent in BMP Initiation messages.

```yaml
sys_descr: "Production BGP Router - DC1"
```

- Default: `bgpgg version {VERSION}`

## Policy Configuration

bgpgg supports route filtering and manipulation using policies.

### Defined Sets

Define named sets for matching routes:

```yaml
defined-sets:
  prefix-sets:
    - name: rfc1918
      prefixes:
        - prefix: "10.0.0.0/8"
          masklength-range: "8..32"
        - prefix: "172.16.0.0/12"
        - prefix: "192.168.0.0/16"

  neighbor-sets:
    - name: customers
      neighbors:
        - "192.168.1.2"
        - "192.168.1.3"

  as-path-sets:
    - name: transit-providers
      patterns:
        - "_174$"
        - "_1299$"

  community-sets:
    - name: no-export
      communities:
        - "NO_EXPORT"
        - "65000:999"

  ext-community-sets:
    - name: customer-routes
      ext-communities:
        - "rt:65000:100"

  large-community-sets:
    - name: local-routes
      large-communities:
        - "65000:1:1"
```

#### Prefix Sets

```yaml
prefix-sets:
  - name: customer-prefixes
    prefixes:
      - prefix: "10.0.0.0/8"
        masklength-range: "exact"  # Only /8
      - prefix: "172.16.0.0/12"
        masklength-range: "16..24"  # /16 to /24
      - prefix: "192.168.0.0/16"
        masklength-range: "24.."     # /24 or more specific
```

Masklength range formats:
- `exact`: Exact prefix length
- `21..24`: Range from /21 to /24
- `24..`: /24 or longer

#### AS Path Sets

Regex patterns for AS_PATH matching:

```yaml
as-path-sets:
  - name: from-customer-asn
    patterns:
      - "^65001"      # Starts with 65001
      - "_65002_"     # Contains 65002
      - "_65003$"     # Ends with 65003
```

#### Community Sets

```yaml
community-sets:
  - name: blackhole
    communities:
      - "65535:666"
      - "NO_EXPORT"
      - "NO_ADVERTISE"
```

### Policy Definitions

Define policies with conditions and actions:

```yaml
policy-definitions:
  - name: block-rfc1918
    statements:
      - name: deny-private-ranges
        conditions:
          match-prefix-set:
            set-name: rfc1918
            match-option: any
        actions:
          reject: true

  - name: set-local-pref
    statements:
      - name: customer-routes-high-pref
        conditions:
          match-neighbor-set:
            set-name: customers
            match-option: any
        actions:
          local-pref: 200

      - name: default-pref
        actions:
          local-pref: 100
```

### Conditions

Available match conditions:

```yaml
conditions:
  # Set-based matching
  match-prefix-set:
    set-name: "customer-prefixes"
    match-option: any  # any, all, invert

  match-neighbor-set:
    set-name: "customers"
    match-option: any

  match-as-path-set:
    set-name: "transit-providers"
    match-option: any

  match-community-set:
    set-name: "no-export"
    match-option: any

  match-ext-community-set:
    set-name: "customer-routes"
    match-option: any

  match-large-community-set:
    set-name: "local-routes"
    match-option: any

  # Direct matching
  prefix: "10.0.0.0/8"
  neighbor: "192.168.1.2"
  has-asn: 65001
  route-type: "ebgp"  # ebgp, ibgp, local
  community: "NO_EXPORT"
```

Match options:
- `any`: At least one element must match (default)
- `all`: All elements must match
- `invert`: No elements must match (logical NOT)

### Actions

Available route actions:

```yaml
actions:
  # Accept or reject
  accept: true
  reject: true

  # Set local preference
  local-pref: 200

  # Set local preference (force override)
  local-pref:
    value: 200
    force: true

  # Set MED
  med: 100

  # Remove MED
  med:
    remove: true

  # Community actions
  community:
    operation: add      # add, remove, replace
    communities:
      - "65000:100"
      - "NO_EXPORT"

  # Extended community actions
  ext-community:
    operation: replace
    ext-communities:
      - "rt:65000:100"

  # Large community actions
  large-community:
    operation: add
    large-communities:
      - "65000:1:100"
```

### Applying Policies

Apply policies to peers:

```yaml
peers:
  - address: "192.168.1.2:17900"
    import-policy:
      - block-rfc1918
      - set-local-pref
    export-policy:
      - announce-customer-routes
```

Policies are evaluated in order. First match wins unless the policy explicitly continues processing.

## Complete Example

```yaml
# Global BGP configuration
asn: 65000
router_id: 1.1.1.1
listen_addr: "0.0.0.0:17900"
grpc_listen_addr: "[::1]:50051"
hold_time_secs: 180
connect_retry_secs: 30
log_level: "info"

# BMP monitoring
bmp_servers:
  - address: "127.0.0.1:11019"
    statistics_timeout: 60

sys_name: "bgp-router-01"
sys_descr: "Production BGP Router"

# Defined sets for policy
defined-sets:
  prefix-sets:
    - name: customer-prefixes
      prefixes:
        - prefix: "10.100.0.0/16"
          masklength-range: "16..24"

  neighbor-sets:
    - name: customers
      neighbors:
        - "192.168.1.2"
        - "192.168.1.3"

# Policy definitions
policy-definitions:
  - name: customer-import
    statements:
      - name: set-high-pref
        conditions:
          match-prefix-set:
            set-name: customer-prefixes
            match-option: any
        actions:
          local-pref: 200
          accept: true

# BGP peers
peers:
  - address: "192.168.1.2:17900"
    idle_hold_time_secs: 30
    damp_peer_oscillations: true
    max_prefix:
      limit: 10000
      action: terminate
    import-policy:
      - customer-import

  - address: "192.168.1.3:17900"
    passive_mode: true
```

## Environment Variables

None currently supported. All configuration is via YAML file.

## Validation

bgpgg validates configuration on startup. Check logs for errors:

```bash
bgpggd -c config.yaml
```

Common validation errors:
- Invalid CIDR notation in prefix
- Invalid router_id format
- Invalid port numbers
- Missing required fields (asn, router_id)

## Runtime Configuration

Some settings can be changed at runtime via the CLI or gRPC API:

- Add/remove peers
- Add/remove routes
- View current configuration

See [CLI Reference](cli) and [API Reference](api) for details.
