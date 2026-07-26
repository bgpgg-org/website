+++
title = 'ggsh Reference'
weight = 6
+++

`ggsh` is the gg shell — an interactive tool for inspecting and reconfiguring a running `bgpggd`. It speaks gRPC to the daemon and also reads and writes `rogg.conf` directly when committing changes.

## Invocation

```bash
ggsh                                       # Interactive
ggsh show bgp summary                      # One-shot
echo show bgp routes | ggsh                # Piped
```

By default, ggsh discovers the daemon's gRPC address from `/run/rogg/bgpggd.json` (the daemon's runtime status file). Override either side:

```bash
ggsh --bgpgg-addr http://192.168.1.1:50051 show bgp summary
ggsh --runtime-dir /tmp/peer1-run show bgp summary
ggsh --config /etc/rogg/rogg.conf            # Path used by configure mode
```

## Modes

ggsh has three modes, shown in the prompt:

| Prompt | Mode | Entered by |
|---|---|---|
| `ggsh>` | Operational | Default |
| `ggsh(config)>` | Configure (root) | `configure` |
| `ggsh(config-bgp)>` | Configure / BGP service | `service bgp` (from `(config)`) |

`exit` (or Ctrl-D) pops one level. From `(config)`, `exit` discards the candidate and releases the configure lock. From operational, it quits ggsh.

Tab completion and inline help are available at every level. Hitting Tab on a partial command lists valid continuations with help text.

## Operational Commands

```
show bgp summary                        # Peer table overview
show bgp info                           # Server info (ASN, router-id, uptime)
show bgp peers                          # List peers
show bgp peers <addr>                   # Peer detail
show bgp peers <addr> in [afi safi]     # Adj-RIB-In for a peer
show bgp peers <addr> out [afi safi]    # Adj-RIB-Out for a peer
show bgp routes [afi safi]              # Loc-RIB
show bgp routes <prefix>                # Routes for a specific prefix

show rpki caches                        # RPKI cache status
show rpki roa                           # ROA table
show rpki validate <prefix> origin <asn>

show config history                     # Stored config snapshots
show version
```

AFIs accepted in show commands: `ipv4`, `ipv6`, `ls`. SAFIs: `unicast`, `multicast`.

## Configure Mode

Editing happens against an in-memory candidate copy of `rogg.conf`. `commit` validates, applies the new config to the running daemon, and atomically writes `rogg.conf` (rotating the prior version into `rogg.1.conf`). `exit` discards the candidate.

While configure mode is active, ggsh holds an exclusive lock (`<config>.lock`) — concurrent `configure` sessions and imperative gRPC mutations are refused.

```
ggsh> configure
ggsh(config)> service bgp
ggsh(config-bgp)> asn 65000
ggsh(config-bgp)> router-id 1.1.1.1
ggsh(config-bgp)> peer 192.168.1.1 remote-as 65001
ggsh(config-bgp)> peer 192.168.1.1 family ipv4 unicast import policy customers
ggsh(config-bgp)> commit
ggsh>
```

### Settings

```
asn <ASN>
router-id <IPv4>
listen-addr <host:port>
grpc-listen-addr <host:port>
log-level <error|warn|info|debug|trace>
hold-time <seconds>
connect-retry <seconds>
cluster-id <IPv4>
sys-name <string>
sys-descr <string>
enhanced-rr-stale-ttl <seconds>
```

### Originate

```
originate <prefix> nexthop <addr>
```

### Peer

```
peer <addr> remote-as <ASN>
peer <addr> port <u16>
peer <addr> interface <name>
peer <addr> md5-key-file <path>
peer <addr> ttl-min <u8>
peer <addr> next-hop-self <bool>
peer <addr> passive <bool>
peer <addr> rr-client <bool>
peer <addr> rs-client <bool>
peer <addr> graceful-shutdown <bool>
peer <addr> enforce-first-as <bool>
peer <addr> send-rpki-community <bool>
peer <addr> admin-down <bool>
peer <addr> family <afi> <safi> import policy <name>
peer <addr> family <afi> <safi> export policy <name>
```

### Policy and Sets

```
policy <name> match <set-name> <accept|reject>
policy <name> default <accept|reject>
prefix-list <name> <prefix>
```

### Service Blocks

```
bmp-server <host:port> statistics-timeout <seconds>

rpki-cache <host:port> preference <u8>
rpki-cache <host:port> transport <tcp|ssh>
rpki-cache <host:port> ssh-username <user>
rpki-cache <host:port> ssh-private-key-file <path>
rpki-cache <host:port> ssh-known-hosts-file <path>
rpki-cache <host:port> retry-interval <seconds>
rpki-cache <host:port> refresh-interval <seconds>
rpki-cache <host:port> expire-interval <seconds>

bgp-ls instance-id <u64>

telemetry json                                 # JSON sink (mutually exclusive with cloudwatch-emf)
telemetry cloudwatch-emf namespace <namespace> # CloudWatch EMF sink
telemetry prometheus                           # Prometheus endpoint, default 127.0.0.1:9273
telemetry prometheus listen <host:port>        # Prometheus endpoint, explicit address
```

See [Metrics](/doc/metrics/) for the sink formats and metric reference.

### Removing State

`unset` mirrors the set surface and drops the value, an entry, or a whole block:

```
unset asn                             # Remove a top-level setting
unset originate <prefix>              # Stop originating
unset peer <addr>                     # Remove an entire peer
unset peer <addr> remote-as           # Clear one peer setting
unset peer <addr> family <afi> <safi> # Remove a family block
unset policy <name>                   # Remove a policy
unset prefix-list <name>              # Remove a prefix-list
unset prefix-list <name> <prefix>     # Remove one entry
unset bmp-server <addr>
unset rpki-cache <addr>
unset bgp-ls
unset telemetry                       # Remove all telemetry sinks
```

### Inspection

```
show diff               # Candidate vs running config
show running-config     # The committed, on-disk config
show candidate          # The in-memory candidate (config-bgp only)
```

### Commit Constraints

`asn`, `router-id`, `listen-addr`, and `grpc-listen-addr` cannot be changed at runtime. A commit that touches them returns an error; restart `bgpggd` after editing `rogg.conf` directly.

## Scripting

ggsh accepts commands as positional arguments or on stdin and exits with a non-zero status on parse or execution errors:

```bash
ggsh show bgp summary
echo show bgp routes | ggsh
ggsh <<EOF
configure
service bgp
peer 10.0.0.2 remote-as 65001
peer 10.0.0.2 port 179
commit
exit
exit
EOF
```

Errors during interactive sessions print a message and continue; in one-shot mode they exit non-zero.

## Files

See [Configuration / Files and Paths](/doc/configuration/#files-and-paths) for `rogg.conf`, the daemon discovery file, and where ggsh stores its command history.
