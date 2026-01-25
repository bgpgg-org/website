---
title: CLI Reference
weight: 3
---

# CLI Reference

The `bgpgg` command-line tool provides control over the BGP daemon (`bgpggd`) via gRPC.

## Global Options

### `--addr`

gRPC server address to connect to.

```bash
bgpgg --addr http://127.0.0.1:50051 peer list
```

- Default: `http://127.0.0.1:50051`
- Use this to manage remote bgpgg instances

## Peer Commands

Manage BGP peers.

### `bgpgg peer add`

Add a new BGP peer.

```bash
bgpgg peer add <ADDRESS> <REMOTE_AS> [OPTIONS]
```

Arguments:
- `ADDRESS`: Peer IP address and port (e.g., `192.168.1.2:17900`)
- `REMOTE_AS`: Remote AS number

Options:
- `--max-prefix-limit <NUMBER>`: Maximum number of prefixes to accept
- `--max-prefix-action <ACTION>`: Action when limit reached (`terminate` or `discard`)

Examples:

```bash
# Add a basic peer
bgpgg peer add 192.168.1.2:17900 65001

# Add peer with prefix limit
bgpgg peer add 192.168.1.2:17900 65001 \
  --max-prefix-limit 10000 \
  --max-prefix-action terminate

# Add peer with discard action
bgpgg peer add 192.168.1.3:17900 65002 \
  --max-prefix-limit 5000 \
  --max-prefix-action discard
```

### `bgpgg peer del`

Remove a BGP peer.

```bash
bgpgg peer del <ADDRESS>
```

Arguments:
- `ADDRESS`: Peer IP address and port

Examples:

```bash
bgpgg peer del 192.168.1.2:17900
```

### `bgpgg peer show`

Show detailed information about a specific peer.

```bash
bgpgg peer show <ADDRESS>
```

Arguments:
- `ADDRESS`: Peer IP address and port

Examples:

```bash
bgpgg peer show 192.168.1.2:17900
```

Output includes:
- Peer address and ASN
- Current BGP state
- Uptime/downtime
- Message counters (OPEN, UPDATE, KEEPALIVE, NOTIFICATION)
- Route counts

### `bgpgg peer list`

List all configured peers.

```bash
bgpgg peer list
```

Examples:

```bash
bgpgg peer list
```

Output:
```
ADDRESS              ASN     STATE         UPTIME
192.168.1.2:17900    65001   Established   1h 23m 45s
192.168.1.3:17900    65002   Connect       -
192.168.1.4:17900    65003   Idle          -
```

BGP states:
- `Idle`: Not attempting connection
- `Connect`: Attempting TCP connection
- `Active`: Waiting for connection retry
- `OpenSent`: Sent OPEN message
- `OpenConfirm`: Received OPEN, sent KEEPALIVE
- `Established`: Fully established, exchanging routes

## Global RIB Commands

Manage the global routing information base.

### `bgpgg global rib show`

Display the global routing table.

```bash
bgpgg global rib show
```

Examples:

```bash
bgpgg global rib show
```

Output includes:
- Prefix
- Next hop
- AS path
- Origin
- Local preference
- MED
- Communities

### `bgpgg global rib add`

Add a route to the global RIB.

```bash
bgpgg global rib add <PREFIX> --nexthop <NEXTHOP> [OPTIONS]
```

Arguments:
- `PREFIX`: CIDR prefix (e.g., `10.0.0.0/24`)

Options:
- `--nexthop <IP>`: Next hop IPv4 address (required)
- `--origin <TYPE>`: Origin type (`igp`, `egp`, `incomplete`), default: `igp`
- `--as-path <PATH>`: AS path as space-separated ASNs (e.g., `"100 200 300"`)
- `--local-pref <NUMBER>`: Local preference value
- `--med <NUMBER>`: Multi-exit discriminator
- `--atomic-aggregate`: Set atomic aggregate flag
- `--community <COMMUNITY>`: BGP community (can be used multiple times)

Examples:

```bash
# Add a basic route
bgpgg global rib add 10.0.0.0/24 --nexthop 192.168.1.1

# Add route with origin
bgpgg global rib add 10.0.0.0/24 --nexthop 192.168.1.1 --origin igp

# Add route with AS path
bgpgg global rib add 10.0.0.0/24 \
  --nexthop 192.168.1.1 \
  --as-path "65001 65002 65003"

# Add route with local preference
bgpgg global rib add 10.0.0.0/24 \
  --nexthop 192.168.1.1 \
  --local-pref 200

# Add route with MED
bgpgg global rib add 10.0.0.0/24 \
  --nexthop 192.168.1.1 \
  --med 100

# Add route with communities
bgpgg global rib add 10.0.0.0/24 \
  --nexthop 192.168.1.1 \
  --community 65001:100 \
  --community NO_EXPORT

# Add route with all attributes
bgpgg global rib add 10.0.0.0/24 \
  --nexthop 192.168.1.1 \
  --origin igp \
  --as-path "65001 65002" \
  --local-pref 200 \
  --med 50 \
  --atomic-aggregate \
  --community 65001:100 \
  --community NO_EXPORT
```

### `bgpgg global rib del`

Delete a route from the global RIB.

```bash
bgpgg global rib del <PREFIX>
```

Arguments:
- `PREFIX`: CIDR prefix (e.g., `10.0.0.0/24`)

Examples:

```bash
bgpgg global rib del 10.0.0.0/24
```

This withdraws the route from all established peers.

## Global Info Commands

View server information and statistics.

### `bgpgg global info`

Display server information.

```bash
bgpgg global info
```

Examples:

```bash
bgpgg global info
```

Output includes:
- Router ID
- Local AS number
- BGP listening address
- gRPC listening address
- Uptime
- bgpgg version

### `bgpgg global summary`

Display quick statistics summary.

```bash
bgpgg global summary
```

Examples:

```bash
bgpgg global summary
```

Output includes:
- Total peers configured
- Peers in Established state
- Total routes in RIB
- Total prefixes received
- Total prefixes sent

## Well-Known Communities

bgpgg recognizes standard BGP communities:

- `NO_EXPORT` (0xFFFFFF01): Do not advertise to eBGP peers
- `NO_ADVERTISE` (0xFFFFFF02): Do not advertise to any peer
- `NO_EXPORT_SUBCONFED` (0xFFFFFF03): Do not advertise outside confederation
- `NOPEER` (0xFFFFFF04): Do not advertise to peers

Use them in commands:

```bash
bgpgg global rib add 10.0.0.0/24 \
  --nexthop 192.168.1.1 \
  --community NO_EXPORT
```

Or use numeric format:

```bash
bgpgg global rib add 10.0.0.0/24 \
  --nexthop 192.168.1.1 \
  --community 65535:65281
```

## Community Formats

### Standard Communities

Format: `ASN:VALUE` or decimal

```bash
--community 65001:100
--community 4259905636  # (65001 << 16) | 100
```

### Extended Communities

Format: `TYPE:ASN:VALUE`

```bash
--community rt:65001:100        # Route Target
--community soo:65001:200       # Site of Origin
```

### Large Communities

Format: `GA:LD1:LD2`

```bash
--community 65001:1:100
```

## Exit Codes

- `0`: Success
- `1`: Error (connection failed, command failed, etc.)

## Examples Workflows

### Setting Up Two Peered Routers

Router 1:

```bash
# Add peer pointing to router 2
bgpgg peer add 192.168.1.2:17900 65001

# Announce a route
bgpgg global rib add 10.0.0.0/24 --nexthop 192.168.1.1
```

Router 2:

```bash
# Add peer pointing to router 1
bgpgg peer add 192.168.1.1:17900 65000

# Check that route was received
bgpgg global rib show
```

### Managing Peers with Prefix Limits

```bash
# Add customer peer with 10,000 prefix limit
bgpgg peer add 192.168.1.10:17900 65010 \
  --max-prefix-limit 10000 \
  --max-prefix-action terminate

# Check peer status
bgpgg peer show 192.168.1.10:17900

# If peer is receiving too many prefixes, they'll be disconnected
# Use "discard" action to keep session up:
bgpgg peer del 192.168.1.10:17900
bgpgg peer add 192.168.1.10:17900 65010 \
  --max-prefix-limit 10000 \
  --max-prefix-action discard
```

### Monitoring Routes

```bash
# Show all routes
bgpgg global rib show

# Get summary stats
bgpgg global summary

# Check peer statistics
bgpgg peer list
bgpgg peer show 192.168.1.2:17900
```

### Manipulating Routes

```bash
# Add route with high local preference (prefer this path)
bgpgg global rib add 10.1.0.0/16 \
  --nexthop 192.168.1.1 \
  --local-pref 200

# Add route with low MED (prefer this path over eBGP)
bgpgg global rib add 10.2.0.0/16 \
  --nexthop 192.168.1.1 \
  --med 10

# Add route with NO_EXPORT (don't advertise to eBGP peers)
bgpgg global rib add 10.3.0.0/16 \
  --nexthop 192.168.1.1 \
  --community NO_EXPORT

# Withdraw route
bgpgg global rib del 10.1.0.0/16
```

## Remote Management

Manage bgpgg instances on other hosts:

```bash
# Connect to remote instance
bgpgg --addr http://192.168.1.10:50051 peer list

# Add peer on remote instance
bgpgg --addr http://192.168.1.10:50051 \
  peer add 192.168.1.2:17900 65001
```

Note: Ensure the remote instance's `grpc_listen_addr` allows external connections:

```yaml
# config.yaml on remote instance
grpc_listen_addr: "0.0.0.0:50051"  # Listen on all interfaces
```

## Troubleshooting

### Connection Refused

```
Error: Failed to execute command: transport error
```

- Check that `bgpggd` is running
- Verify gRPC address matches configuration
- Check firewall rules

### Peer Not Establishing

```bash
# Check peer state
bgpgg peer show 192.168.1.2:17900

# Check logs on daemon
journalctl -u bgpggd -f
```

Common issues:
- TCP port not reachable (firewall)
- ASN mismatch
- Router ID conflict
- Hold timer negotiation failure

### Routes Not Propagating

```bash
# Verify route exists locally
bgpgg global rib show

# Check peer is established
bgpgg peer list

# Verify policies aren't blocking routes
# (Check configuration import-policy/export-policy)
```

## See Also

- [Configuration Guide](configuration) - Configure peers via YAML
- [API Reference](api) - gRPC API documentation
- [Architecture](architecture) - Understand BGP state machine
