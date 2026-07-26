+++
title = 'Configuration'
weight = 3
+++

## Configuration File

bgpgg uses a custom configuration language stored in `rogg.conf`. The default path is `/etc/rogg/rogg.conf`. Override with `--config`:

```bash
bgpggd --config /path/to/rogg.conf
```

The same file is read and rewritten by `ggsh` in [configure mode](/doc/cli-reference/#configure-mode). Each commit rotates the previous version into a numbered snapshot (`rogg.1.conf`, `rogg.2.conf`, ...) up to ten generations.

## Files and Paths

| Path | Purpose |
|---|---|
| `/etc/rogg/rogg.conf` | Daemon configuration. Override with `bgpggd --config <path>` and `ggsh --config <path>`. |
| `/etc/rogg/rogg.<N>.conf` | Snapshots rotated on commit, up to `.10`. |
| `/etc/rogg/rogg.conf.lock` | Sibling lock file. ggsh holds an exclusive flock for the duration of a configure session; concurrent sessions and imperative gRPC writes are refused. |
| `/run/rogg/bgpggd.json` | Daemon discovery file. Written by `bgpggd` after listeners bind; read by `ggsh` so the client can find the gRPC endpoint without flags. Override with `bgpggd --runtime-dir <dir>` and `ggsh --runtime-dir <dir>`. |
| `${XDG_STATE_HOME:-$HOME/.local/state}/rogg/ggsh_history` | Per-user `ggsh` command history. |

## Syntax

```
# Comments start with '#' and run to end of line.
service <kind> {
  <key> <value>
  <block> <name> { ... }
}
```

- Whitespace and blank lines are insignificant; one statement per line.
- Strings containing spaces or special characters must be double-quoted: `sys-descr "rogg edge router"`.
- Boolean settings take the literal `true` or `false`.
- A value of `service bgp { ... }` is the only currently supported service.

## Server Settings

Top-level settings inside `service bgp { ... }`:

```
service bgp {
  asn 65000                          # Required: local ASN
  router-id 1.1.1.1                  # Required: IPv4 router ID
  listen-addr 0.0.0.0:179            # Optional: BGP listen address
  grpc-listen-addr 127.0.0.1:50051   # Optional: ggsh/gRPC listen address
  log-level info                     # Optional: error|warn|info|debug|trace
  hold-time 180                      # Optional: BGP hold time (seconds)
  connect-retry 30                   # Optional: connect retry interval (seconds)
  cluster-id 1.1.1.1                 # Optional: route reflector cluster ID
  sys-name "bgpgg router"            # Optional: BMP system name
  sys-descr "BGP daemon"             # Optional: BMP system description
  enhanced-rr-stale-ttl 360          # Optional: RFC 7313 stale TTL (seconds)
}
```

`asn`, `router-id`, `listen-addr`, and `grpc-listen-addr` cannot be changed at runtime — a commit that touches them is rejected. Restart the daemon to apply.

## Peer Block

```
peer 192.168.1.1 {
  remote-as 65001
  port 179
  passive false
  idle-hold-time-secs 30
  damp-peer-oscillations true
  md5-key-file /etc/rogg/peer1.key
  ttl-min 255
  next-hop-self false
  graceful-shutdown false
  rr-client false
  rs-client false
  enforce-first-as true
  send-rpki-community false
  admin-down false

  family ipv4 unicast {
    import policy from-customers
    export policy to-upstreams
    max-prefix 1000 action terminate
    add-path-send all
  }
}
```

The block header is the peer's IP address (IPv4 or IPv6). Use `interface <name>` together with an IPv6 link-local address to peer over an unnumbered link.

| Key | Value | Description |
|---|---|---|
| `remote-as` | ASN | Required. Peer ASN. |
| `port` | u16 | TCP port (default 179). |
| `interface` | name | Outgoing interface for IPv6 link-local peers. |
| `md5-key-file` | path | TCP MD5 key file (RFC 2385). Mode 600 recommended. |
| `ttl-min` | u8 | RFC 5082 GTSM minimum TTL. |
| `passive` | bool | Do not initiate connections. |
| `next-hop-self` | bool | Rewrite NEXT_HOP to self when advertising. |
| `rr-client` | bool | Treat peer as a route reflector client (RFC 4456). |
| `rs-client` | bool | Treat peer as a route server client (RFC 7947). |
| `graceful-shutdown` | bool | Tag outbound routes with GRACEFUL_SHUTDOWN community (RFC 8326). |
| `enforce-first-as` | bool | Reject UPDATE if peer ASN is not first in AS_PATH (default `true`). |
| `send-rpki-community` | bool | Attach RPKI Origin Validation State extended community (RFC 8097). |
| `admin-down` | bool | Administratively disable the peer. |
| `idle-hold-time-secs` | u64 | Idle hold time before retry. |
| `delay-open-time-secs` | u64 | Delay before sending OPEN. |
| `damp-peer-oscillations` | bool | Exponential backoff on flaps. |
| `min-route-advertisement-interval-secs` | u64 | MRAI. |
| `allow-automatic-stop` | bool | FSM `AutomaticStop` enabled. |
| `send-notification-without-open` | bool | Send NOTIFICATION before OPEN. |

A peer cannot be both `rr-client` and `rs-client`. `rs-client` is also incompatible with receiving multiple paths (route servers use send-only ADD-PATH per RFC 7947).

### Family Block

`family <afi> <safi> { ... }` enables an address family on a peer and attaches per-family directives. AFIs: `ipv4`, `ipv6`, `ls`. SAFIs: `unicast`, `multicast`.

| Directive | Description |
|---|---|
| `import policy <name>` | Apply named policy to inbound updates. |
| `export policy <name>` | Apply named policy to outbound updates. |
| `max-prefix <N>` | Drop the session when more than N prefixes are received. |
| `max-prefix <N> action discard` | Silently ignore prefixes beyond N, keep session up. |
| `add-path-send all` | Advertise all available paths (RFC 7911). |
| `add-path-send disabled` | Send only the best path (default). |

For BGP-LS, enable `family ls unicast` on the peer.

## Originate

Inject a static route into Loc-RIB:

```
service bgp {
  ...
  originate 10.0.0.0/24 nexthop 192.168.1.1
  originate 2001:db8::/32 nexthop fe80::1
}
```

## RPKI Cache

Connect to RPKI-to-Router (RTR) caches for origin validation (RFC 6811, RFC 8210):

```
rpki-cache 10.0.0.2:323 {
  preference 0
  transport tcp
  retry-interval 600
  refresh-interval 3600
  expire-interval 7200
}

rpki-cache rpki-cache.example.com:22 {
  preference 1
  transport ssh
  ssh-username rpki
  ssh-private-key-file /etc/rogg/rpki.key
  ssh-known-hosts-file /etc/rogg/known_hosts
}
```

Caches are organized into preference tiers. Only caches in the lowest tier are active at startup; if every cache in the active tier goes down, bgpgg fails over to the next tier. Per-peer `send-rpki-community true` attaches the validation result to outbound routes.

## BMP Server

Stream BGP events to an external BMP collector (RFC 7854):

```
bmp-server 127.0.0.1:11019 {
  statistics-timeout 60
}
```

`statistics-timeout 0` disables the periodic statistics report.

## BGP-LS

RFC 9552 BGP Link-State carries IGP topology information over BGP. Enable AF on each peer with `family ls unicast` and configure the global block:

```
bgp-ls {
  instance-id 1
}
```

## Telemetry

Emit operational metrics to a sink. `json` and `cloudwatch-emf` are push sinks
and mutually exclusive; `prometheus` is a pull endpoint and can run alongside
either:

```
telemetry {
  cloudwatch-emf {
    namespace Rogg/Bgpgg
  }
  prometheus {
    listen 127.0.0.1:9273
  }
}
```

Use `telemetry { json {} }` for plain JSON lines, or `prometheus {}` to default
the listener to `127.0.0.1:9273`. See [Metrics](/doc/metrics/) for the sink
formats and the full metric reference.

## Policy and Sets

See [Policy](/doc/policy/) for `policy`, `prefix-list`, `neighbor-set`, `as-path-set`, `community-set`, `ext-community-set`, and `large-community-set` blocks.

## Snapshots

Each commit through `ggsh` rotates the previous `rogg.conf` into `rogg.1.conf`, the prior `.1` into `.2`, and so on up to `.10`. List them with `ggsh show config history`.

## Complete Example

```
service bgp {
  asn 65000
  router-id 1.1.1.1
  listen-addr 0.0.0.0:179
  grpc-listen-addr 127.0.0.1:50051
  log-level info

  peer 192.168.1.1 {
    remote-as 65001
    md5-key-file /etc/rogg/peer1.key

    family ipv4 unicast {
      import policy from-customers
      export policy to-upstreams
      max-prefix 1000 action discard
    }
  }

  peer fe80::1 {
    remote-as 65002
    interface eth0
  }

  originate 10.0.0.0/24 nexthop 192.168.1.1

  rpki-cache 10.0.0.2:323 {
    preference 0
  }

  bmp-server 127.0.0.1:11019 {
    statistics-timeout 60
  }

  telemetry {
    cloudwatch-emf {
      namespace Rogg/Bgpgg
    }
    prometheus {
      listen 127.0.0.1:9273
    }
  }

  prefix-list customer-prefixes {
    10.0.0.0/8
    192.168.0.0/16
  }

  policy from-customers {
    match customer-prefixes accept
    default reject
  }
}
```
