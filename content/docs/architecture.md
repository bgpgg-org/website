---
title: Architecture
weight: 4
---

# Architecture

This document describes bgpgg's internal design and architecture.

## Design Philosophy

bgpgg follows these principles:

1. **Peer tasks run forever** - Independent of TCP connection state, like modern BGP implementations
2. **No adj-rib-out tracking** - Routes sent directly from adj-rib-in for efficiency
3. **Channel-based communication** - Server and peers communicate via async channels
4. **Async I/O** - Built on Tokio for high performance

## System Overview

```
                                +------------------+
                                |     Server       |
                                +------------------+
                                       |
                  AddPeer              |              IncomingTCP
                     |                 |                   |
                     v                 v                   v
               +-----------+     +-----------+       +-----------+
               | spawn_peer|     |  peers    |       |new_connected|
               +-----------+     |  HashMap  |       +-----------+
                     |           +-----------+             |
                     |                                     |
                     +-------------+  +--------------------+
                                   |  |
                                   v  v
                           +---------------+
                           |  Peer Task    |
                           |  (runs forever)|
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
                or AutoStart
```

## Core Components

### Server (core/src/server.rs)

The server is the central coordinator that:

- Maintains a HashMap of all peers (`peers: HashMap<String, PeerInfo>`)
- Spawns Peer tasks for configured and incoming connections
- Routes messages between peers
- Handles gRPC API requests
- Broadcasts BMP events to monitoring collectors

#### PeerInfo Structure

```rust
struct PeerInfo {
    admin_state: AdminState,       // Up or Down
    state: BgpState,               // Cached from Peer
    peer_tx: Option<UnboundedSender>,  // Channel to Peer task
    session_config: SessionConfig,
    consecutive_down_count: u32,   // Cached from Peer
    // ...
}
```

The server never directly manipulates peer BGP state. All BGP logic is in the Peer task.

### Peer (core/src/peer.rs)

Each peer runs in an independent async task with its own FSM:

```rust
struct Peer {
    addr: String,
    port: u16,
    fsm: Fsm,                          // FSM state machine
    conn: Option<TcpConnection>,       // None when disconnected
    session_config: SessionConfig,
    consecutive_down_count: u32,       // For DampPeerOscillations
    // ...
}
```

Key methods:

- **Peer::new()** - Creates peer in Idle state, no TCP connection
- **Peer::new_connected()** - Creates peer with established TCP (for incoming connections)
- **Peer::run()** - Main event loop, handles all FSM states forever

The peer task never exits (survives connection failures). This design:
- Simplifies state management
- Enables automatic reconnection
- Matches behavior of production BGP implementations

### FSM State Machine

bgpgg implements RFC 4271 BGP-4 Finite State Machine:

```
    ManualStart
         |
         v
    +--------+    TcpConnectionFails    +--------+
    |  Idle  | <----------------------- | Connect|
    +--------+                          +--------+
         |                                   |
         | AutomaticStart                    | TcpConnectionConfirmed
         | (after idle_hold_time)            |
         v                                   v
    +--------+    ConnectRetryExpires   +----------+
    | Connect| -----------------------> |  Active  |
    +--------+                          +----------+
         |                                   |
         | TcpConnectionConfirmed            | TcpConnectionConfirmed
         v                                   v
    +----------+                        +----------+
    | OpenSent | <--------------------- | OpenSent |
    +----------+                        +----------+
         |
         | Receive OPEN
         v
    +-------------+
    | OpenConfirm |
    +-------------+
         |
         | Receive KEEPALIVE
         v
    +-------------+
    | Established |
    +-------------+
```

States:

- **Idle**: Initial state, waiting for start event
- **Connect**: Attempting TCP connection
- **Active**: Waiting for connection retry timer
- **OpenSent**: TCP established, OPEN sent, waiting for OPEN
- **OpenConfirm**: OPEN received, KEEPALIVE sent, waiting for KEEPALIVE
- **Established**: Full BGP session, exchanging routes

## Message Flow

Communication between Server and Peer tasks uses channels:

```
Server                          Peer Task
   |                                |
   |-- PeerOp::ManualStart -------->|
   |                                |-- TCP connect -->
   |                                |<-- TCP established
   |                                |-- send OPEN -->
   |<-- ServerOp::PeerStateChanged -|
   |                                |<-- receive OPEN
   |<-- ServerOp::PeerHandshake ----|
   |                                |<-- receive KEEPALIVE
   |<-- ServerOp::PeerStateChanged -|   (Established)
   |                                |
   |-- PeerOp::SendUpdate --------->|-- send UPDATE -->
   |                                |
   |<-- ServerOp::PeerUpdate -------|<-- receive UPDATE
   |                                |
   |-- PeerOp::Shutdown ----------->|-- send NOTIFICATION -->
   |                                |   (task exits)
```

### PeerOp (Server -> Peer)

Operations the server sends to peers:

- `ManualStart`: Start connection attempt
- `AutomaticStart`: Automatic reconnection after idle_hold_time
- `ManualStop`: Admin shutdown
- `TcpConnectionConfirmed`: Incoming TCP accepted
- `SendUpdate`: Send UPDATE to peer
- `Shutdown`: Graceful shutdown

### ServerOp (Peer -> Server)

Operations peers send to the server:

- `PeerStateChanged`: BGP state transition
- `PeerHandshake`: Handshake completed (router ID, ASN)
- `PeerUpdate`: UPDATE message received
- `PeerDown`: Connection lost

## Routing Information Base

### Adj-RIB-In

Each peer maintains routes learned from that peer:

```rust
adj_rib_in: HashMap<IpNetwork, Path>
```

Stored in the Peer task for isolation.

### Loc-RIB (Global RIB)

Server maintains the global routing table:

```rust
global_rib: HashMap<IpNetwork, Vec<Path>>
```

Routes from all peers + locally originated routes.

Best path selection (RFC 4271):

1. Highest local preference
2. Shortest AS_PATH
3. Lowest origin (IGP < EGP < INCOMPLETE)
4. Lowest MED (if from same AS)
5. eBGP over iBGP
6. Lowest IGP cost (not implemented)
7. Lowest router ID

### No Adj-RIB-Out

bgpgg does NOT track adj-rib-out per peer for efficiency.

Routes are sent directly from:
- Adj-RIB-In (other peers)
- Loc-RIB (best paths)

This design:
- Reduces memory usage
- Simplifies code
- Matches modern BGP implementations

## Damping (RFC 4271 8.1.1)

When `damp_peer_oscillations` is enabled:

```
idle_hold_time = base * 2^consecutive_down_count
```

- Exponentially increases delay on repeated failures
- Capped at 120 seconds
- Reset to 0 when peer reaches Established and completes handshake

Example progression:
- 1st failure: 30s wait
- 2nd failure: 60s wait
- 3rd failure: 120s wait (capped)

Prevents flapping peers from consuming resources.

## Passive Mode

When `passive_mode` is enabled:

- Peer stays in Idle state
- Ignores `ManualStart` (doesn't initiate TCP)
- Waits for incoming TCP connection from remote peer

Useful for:
- Peers behind NAT
- Security policies requiring incoming-only connections
- Testing

## Connection Collision Handling

RFC 4271 Section 6.8: When both sides initiate connections simultaneously:

1. Compare BGP identifiers (router IDs)
2. Keep connection from higher router ID
3. Close connection from lower router ID

bgpgg implements this correctly in OpenSent and OpenConfirm states.

Optional: `collision_detect_established_state` extends this to Established state (non-standard).

## BMP (BGP Monitoring Protocol)

bgpgg implements RFC 7854 BMP to export BGP state to monitoring collectors.

### Architecture

```
┌─────────────┐
│  Peer Task  │
└──────┬──────┘
       │ ServerOp::PeerUpdate
       │ ServerOp::PeerStateChanged
       │ ServerOp::PeerHandshakeComplete
       ▼
┌─────────────────────┐
│   Server Task       │
│ - Handles ServerOp  │
│ - Broadcasts BmpOp  │
└──────┬──────────────┘
       │ Arc<BmpOp> (broadcast to all BMP tasks)
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐
│  BMP Task 1  │ │BMP Task 2│ │BMP Task N│
│ (per dest)   │ │          │ │          │
└──────┬───────┘ └────┬─────┘ └────┬─────┘
       │              │            │
       ▼              ▼            ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐
│BmpDestination│ │          │ │          │
│ ::TcpClient  │ │          │ │          │
└──────┬───────┘ └────┬─────┘ └────┬─────┘
       │              │            │
       ▼              ▼            ▼
  collector1:11019  collector2   collector3
  (external)
```

### BMP Task (per destination)

Each BMP collector gets its own task that:

1. Converts `BmpOp` to BMP messages (RFC 7854 format)
2. Batches messages (up to 100 messages or 100ms)
3. Manages lifecycle (Initiation, Termination)
4. Sends periodic statistics (if configured)

Batching constants:

```rust
const MAX_BATCH_SIZE: usize = 100;
const MAX_BATCH_TIME: Duration = Duration::from_millis(100);
```

### BMP Destination

```rust
pub enum BmpDestination {
    TcpClient(BmpTcpClient),
    // Future: Sqlite(BmpSqliteClient),
}
```

#### TcpClient

- Connects to external BMP collector servers
- Auto-reconnection with exponential backoff (1s, 2s, 4s, ... max 30s)
- Batched writes - serializes multiple BMP messages into single write syscall
- Non-blocking - won't impact BGP core even if collector is slow

### BMP Message Types

Implemented:

- **Initiation** (Type 4): sysName, sysDescr on startup
- **Termination** (Type 5): PermanentlyAdminClose on shutdown
- **Route Monitoring** (Type 0): Forwards UPDATE messages
- **Peer Up** (Type 3): Includes sent/received OPEN messages
- **Peer Down** (Type 2): Various reasons (notification, timeout, etc.)
- **Statistics Report** (Type 1): Periodic stats (routes in adj-rib-in)
- **Route Mirroring** (Type 6): Structure defined (not yet used)

### New Collector Connection

When adding a BMP server to a running system:

1. Send Initiation message
2. For each established peer, send PeerUp
3. For each peer, send all routes in adj-rib-in as RouteMonitoring
4. Continue with real-time updates

Ensures collectors get full BGP state on connection.

## Timers

### Hold Timer

- Configured per server (default: 180s)
- Negotiated to minimum of local and remote values
- Minimum allowed: 3 seconds
- Keepalive sent at hold_time / 3 interval
- Connection closed if no messages received within hold_time

### ConnectRetry Timer

- Default: 30 seconds
- Time to wait before retrying failed TCP connection
- Active in Connect and Active states

### Idle Hold Timer

- Configurable per peer (default: 30s)
- Delay before automatic restart after failure
- Can be disabled (no automatic restart)
- Subject to damping if `damp_peer_oscillations` enabled

### DelayOpen Timer

- Optional per-peer setting
- Delays sending OPEN after TCP connection
- Helps avoid race conditions in simultaneous connections

### MinRouteAdvertisementInterval Timer

- Default: 30s for eBGP, 5s for iBGP
- Minimum time between UPDATE messages with same prefix
- Rate limits route flapping

## Performance Considerations

### No Adj-RIB-Out

Not tracking per-peer adj-rib-out saves:

- Memory: ~32 bytes per route per peer
- CPU: No need to diff RIB changes per peer
- Complexity: Simpler code paths

### Batched BMP Writes

BMP batching reduces syscalls:

- Up to 100 messages batched
- Single write_all() call
- Non-blocking channels prevent BGP impact

### Async I/O

Built on Tokio for efficient async I/O:

- Single-threaded async runtime
- No blocking operations in hot path
- Scales to thousands of peers on one CPU core

### Direct Route Sending

Routes sent directly from adj-rib-in without copying:

- Zero-copy message forwarding where possible
- Efficient for route reflection scenarios

## Code Organization

```
bgpgg/
├── cli/              # Command-line tool
│   └── src/
│       ├── main.rs   # CLI entry point
│       └── commands/ # Peer, global commands
├── daemon/           # BGP daemon
│   └── src/
│       └── main.rs   # Daemon entry point
└── core/             # BGP implementation
    ├── src/
    │   ├── server.rs         # Server task
    │   ├── peer.rs           # Peer task & FSM
    │   ├── fsm.rs            # FSM implementation
    │   ├── config.rs         # Configuration
    │   ├── rib.rs            # Routing tables
    │   ├── policy/           # Policy engine
    │   ├── bgp/              # BGP message codecs
    │   │   ├── msg.rs
    │   │   ├── msg_open.rs
    │   │   ├── msg_update.rs
    │   │   ├── msg_keepalive.rs
    │   │   └── msg_notification.rs
    │   └── bmp/              # BMP implementation
    │       ├── task.rs
    │       ├── destination.rs
    │       └── msg_*.rs
    └── tests/        # Integration tests
        ├── common/   # Test helpers
        └── *.rs      # Test files
```

## Testing Architecture

See [Development Guide](development) for details on:

- Integration test helpers
- FakePeer for FSM testing
- Polling helpers (avoid sleep)
- Route propagation testing

## Future Enhancements

Planned features:

- **SQLite BMP destination**: Local state export for CLI/Web UI
- **Multiprotocol support**: IPv6, L3VPN, EVPN
- **ADD-PATH**: Multiple paths per prefix
- **Graceful Restart**: RFC 4724
- **Route Refresh**: RFC 2918
- **4-byte ASN**: Full 32-bit ASN support

## References

- RFC 4271: BGP-4
- RFC 4272: BGP Security
- RFC 7854: BGP Monitoring Protocol (BMP)
- RFC 4724: Graceful Restart
- RFC 2918: Route Refresh
- RFC 4360: BGP Extended Communities
