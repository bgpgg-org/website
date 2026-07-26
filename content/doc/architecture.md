+++
title = 'Architecture'
weight = 1
+++

## Core Design

bgpgg is written in async Rust using Tokio. Each peer session runs in its own task. The management plane (gRPC API, BMP) is decoupled from the routing plane.

## Architecture

```text
                        MgmtOp (from ggsh / gRPC)
                                  |
                                  v
                         +------------------+
                         |   Server Task    |
                         |                  |
                         | - peers HashMap  |
                         | - route selection|
                         +------------------+
                                 |      ^
                          PeerOp |      | ServerOp
                                 v      |
                         +---------------+
                         |  Peer Task    |
                         | (runs forever)|
                         +---------------+
                                 |
                   +-------------+-------------+
                   |             |             |
                   v             v             v
              +---------+   +---------+   +-----------+
              |  Idle   |   | Connect |   | OpenSent  |
              |  state  |   |  state  |   | OpenConfirm|
              +---------+   +---------+   | Established|
                   |             |        +-----------+
                   |             |             |
              Wait for      Attempt TCP    Handle BGP
              ManualStart   connection     messages
```

Server spawns peer tasks via `spawn_peer()`. Each peer runs as a long-lived task that cycles through the BGP FSM across connection attempts. Server and peers communicate via async channels: `PeerOp` (server → peer), `ServerOp` (peer → server).

## Components

- **bgpggd** — BGP daemon. Reads `rogg.conf`, listens for peers and gRPC, streams to BMP.
- **ggsh** — gg shell. Interactive and scripting client; speaks gRPC to `bgpggd` and rewrites `rogg.conf` on commit.
- **BMP** — Streams BGP events to external collectors (RFC 7854).

## Routing Tables

- **Adj-RIB-In** - Per-peer incoming routes
- **Loc-RIB** - Global best paths
- **Adj-RIB-Out** - Per-peer outgoing routes (enables ADD-PATH)

## Protocol Support

- **RFC 1997** - BGP Communities Attribute
- **RFC 2385** - Protection of BGP Sessions via the TCP MD5 Signature Option
- **RFC 2918** - Route Refresh Capability for BGP-4
- **RFC 4271** - A Border Gateway Protocol 4 (BGP-4)
- **RFC 4486** - Subcodes for BGP Cease Notification Message
- **RFC 4360** - BGP Extended Communities Attribute
- **RFC 4456** - BGP Route Reflection
- **RFC 4724** - Graceful Restart Mechanism for BGP
- **RFC 4760** - Multiprotocol Extensions for BGP-4
- **RFC 6286** - Autonomous-System-Wide Unique BGP Identifier for BGP-4
- **RFC 6793** - BGP Support for Four-Octet Autonomous System (AS) Number Space
- **RFC 7606** - Revised Error Handling for BGP UPDATE Messages
- **RFC 7854** - BGP Monitoring Protocol (BMP)
- **RFC 7911** - Advertisement of Multiple Paths in BGP (ADD-PATH)
- **RFC 7947** - Internet Exchange BGP Route Server
- **RFC 8092** - BGP Large Communities Attribute
- **RFC 8326** - Graceful BGP Session Shutdown
- **RFC 5082** - The Generalized TTL Security Mechanism (GTSM)
- **RFC 6811** - BGP Prefix Origin Validation (RPKI)
- **RFC 8210** - The Resource Public Key Infrastructure (RPKI) to Router Protocol
- **RFC 7313** - Enhanced Route Refresh Capability for BGP-4
- **RFC 9494** - Long-Lived Graceful Restart for BGP
- **RFC 9552** - Distribution of Link-State and Traffic Engineering Information Using BGP
