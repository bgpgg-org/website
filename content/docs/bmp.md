---
title: BMP
weight: 6
---

# BGP Monitoring Protocol (BMP)

bgpgg implements RFC 7854 BGP Monitoring Protocol to export BGP session state and routing information to external monitoring collectors.

## Overview

BMP allows you to:
- Monitor BGP sessions in real-time
- Track route updates and withdrawals
- Collect statistics about BGP operations
- Debug routing issues
- Audit BGP changes

bgpgg acts as a **BMP client** that connects to external BMP collectors (servers).

## Quick Start

### 1. Configure BMP Server

Add to `config.yaml`:

```yaml
bmp_servers:
  - address: "127.0.0.1:11019"
    statistics_timeout: 60  # Send stats every 60 seconds
```

Or add at runtime:

```bash
# Via CLI (not yet implemented in CLI, use API)
# Via gRPC API
```

### 2. Run a BMP Collector

Use an existing BMP collector like:

- [bioCollector](https://github.com/bio-routing/bio-rd)
- [pmacct](https://github.com/pmacct/pmacct)
- [SNAS.io](https://www.snas.io/)
- Custom collector implementing RFC 7854

Example with netcat for testing:

```bash
# Listen on BMP port
nc -l 11019 > bmp.dump

# Or with tcpdump
tcpdump -i lo port 11019 -w bmp.pcap
```

### 3. Start bgpgg

```bash
bgpggd -c config.yaml
```

bgpgg will connect to the BMP collector and start sending:
- Initiation message on startup
- Peer Up messages for established sessions
- Route Monitoring messages for all routes
- Statistics Reports (if configured)
- Termination message on shutdown

## Configuration

### BMP Servers

```yaml
bmp_servers:
  - address: "127.0.0.1:11019"
    statistics_timeout: 60

  - address: "192.168.1.100:11019"
    statistics_timeout: 0  # Disable statistics
```

Configuration fields:

#### `address`

BMP collector address and port.

- Format: `IP:PORT`
- Default port: 11019
- bgpgg connects TO this address

#### `statistics_timeout`

Statistics reporting interval in seconds.

- `0` or omit: Disable statistics reports
- `> 0`: Send Statistics Report messages every N seconds
- Recommended: 60-300 seconds

### System Information

Customize BMP system information:

```yaml
sys_name: "bgp-router-01"
sys_descr: "Production BGP Router - DC1"
```

Sent in BMP Initiation messages:

- `sys_name`: System name (default: `bgpgg {router_id}`)
- `sys_descr`: System description (default: `bgpgg version {VERSION}`)

## BMP Message Types

### Initiation (Type 4)

Sent when connection is established.

Information:
- sysName: System name
- sysDescr: System description

### Peer Up (Type 3)

Sent when a BGP peer reaches Established state.

Information:
- Local address
- Local port
- Remote address
- Remote port
- Sent OPEN message
- Received OPEN message
- Timestamp

### Peer Down (Type 2)

Sent when a BGP peer leaves Established state.

Reasons:
- `LocalNotificationClose`: Local NOTIFICATION sent
- `RemoteNotificationClose`: Remote NOTIFICATION received
- `LocalNoNotificationClose`: Local close without NOTIFICATION
- `RemoteNoNotificationClose`: Remote close detected
- `PeerDeconfigured`: Peer removed from configuration
- `LocalSystemClosedFsmEventFollows`: Local system event
- `RemoteSystemClosedFsmEventFollows`: Remote system event

### Route Monitoring (Type 0)

Sent for each UPDATE message received from peers.

Contains:
- Peer header (address, ASN, timestamp)
- Complete BGP UPDATE message

Sent in real-time as routes are learned/withdrawn.

### Statistics Report (Type 1)

Sent periodically if `statistics_timeout` is configured.

Current statistics:
- `RoutesInAdjRibIn`: Number of routes in Adj-RIB-In per peer

Future statistics may include:
- Number of prefixes rejected by policy
- Number of duplicate updates
- Number of withdraw messages

### Termination (Type 5)

Sent when BMP connection is closing.

Reason:
- `PermanentlyAdminClose`: Normal shutdown

### Route Mirroring (Type 6)

Message structure defined but not yet implemented.

## BMP Architecture

### Per-Destination Tasks

Each BMP collector gets its own independent task:

```
┌─────────────────────┐
│   Server Task       │
│ - Broadcasts BmpOp  │
└──────┬──────────────┘
       │ Arc<BmpOp> (broadcast to all tasks)
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐
│  BMP Task 1  │ │BMP Task 2│ │BMP Task N│
└──────┬───────┘ └────┬─────┘ └────┬─────┘
       ▼              ▼            ▼
  collector1     collector2    collector3
```

Each task:
- Maintains independent TCP connection
- Batches messages for efficiency
- Reconnects automatically on failure
- Non-blocking (won't impact BGP core)

### Message Batching

BMP messages are batched for efficiency:

- **Max batch size**: 100 messages
- **Max batch time**: 100ms
- Whichever comes first triggers write

All messages serialized into a single buffer before `write_all()` syscall.

Benefits:
- Reduces syscalls (better performance)
- Reduces TCP packets (lower overhead)
- Still maintains low latency (100ms max)

### Auto-Reconnection

BMP TCP connections automatically reconnect on failure:

- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
- Continues until connection succeeds
- Resends Initiation and full state on reconnect

## New Collector Connection

When adding a BMP server to a running system with existing peers:

1. **Connect** to BMP collector
2. **Send Initiation** message
3. **For each established peer**:
   - Send Peer Up message
4. **For each peer** (established or not):
   - Send all routes in Adj-RIB-In as Route Monitoring messages
5. **Continue** with real-time updates

This ensures new collectors get full BGP state immediately.

## Runtime Management

### Add BMP Server (gRPC API)

```python
import grpc
from proto import bgp_pb2, bgp_pb2_grpc

channel = grpc.insecure_channel('127.0.0.1:50051')
client = bgp_pb2_grpc.BgpServiceStub(channel)

request = bgp_pb2.AddBmpServerRequest(
    address="127.0.0.1:11019",
    statistics_timeout=60
)
response = client.AddBmpServer(request)
print(f"Success: {response.success}")
```

### Remove BMP Server

```python
request = bgp_pb2.RemoveBmpServerRequest(
    address="127.0.0.1:11019"
)
response = client.RemoveBmpServer(request)
```

### List BMP Servers

```python
request = bgp_pb2.ListBmpServersRequest()
response = client.ListBmpServers(request)
for address in response.addresses:
    print(f"BMP Server: {address}")
```

## BMP Collectors

### Open Source Collectors

#### bio-routing bioCollector

```bash
# Install bio-rd
git clone https://github.com/bio-routing/bio-rd
cd bio-rd/cmd/bio-rd
go build

# Run with BMP receiver
./bio-rd -bmp.listen.addr=:11019
```

#### pmacct

```bash
# Install pmacct
apt-get install pmacct

# Configure nfacctd for BMP
cat > nfacctd.conf <<EOF
daemonize: false
bmp_daemon: true
bmp_daemon_ip: 0.0.0.0
bmp_daemon_port: 11019
bmp_daemon_msglog_file: /var/log/bmp.log
EOF

# Run
nfacctd -f nfacctd.conf
```

### Commercial Collectors

- SNAS.io
- Cisco Crosswork
- Juniper Paragon Insights

## Use Cases

### Route Change Auditing

Track all route changes for compliance and debugging:

```
BMP Collector -> Database -> Query Interface
```

Example queries:
- "Show all route changes in the last hour"
- "Which peer advertised prefix 10.0.0.0/8?"
- "When did peer X go down?"

### Real-Time Monitoring

Feed BMP data into monitoring systems:

```
bgpgg -> BMP Collector -> Prometheus/Grafana
```

Metrics:
- Active peers count
- Routes per peer
- BGP state transitions
- Message rates

### Troubleshooting

Capture BMP stream during issues:

```bash
# Capture BMP data
nc -l 11019 > issue-$(date +%Y%m%d-%H%M%S).bmp

# Reproduce issue
# ...

# Analyze offline
```

### Multi-Router Visibility

Centralized view of multiple BGP routers:

```
Router 1 ---\
Router 2 ----+---> BMP Collector -> Dashboard
Router 3 ---/
```

## Performance Considerations

### CPU Impact

BMP has minimal CPU impact:
- Non-blocking channel communication
- Batched writes
- Independent tasks per destination
- No impact on BGP decision process

### Network Impact

Bandwidth usage depends on:
- Number of peers
- Route churn rate
- Statistics interval

Typical usage:
- Idle: < 1 Kbps per BMP connection
- Active (1000 routes/sec): ~100-500 Kbps
- Statistics (60s interval): ~1-10 Kbps

### Memory Impact

Per BMP destination:
- ~1 MB for task and buffers
- Channel buffer: Up to 100 pending messages

Total: Negligible for typical deployments.

## Security Considerations

### Network Security

BMP connections are unauthenticated TCP:

- Use firewall rules to restrict access
- Deploy collectors on trusted networks
- Consider VPN/tunnels for remote collectors

### Data Privacy

BMP exports complete routing data:

- Contains all BGP attributes
- Includes peer IP addresses
- May contain sensitive topology information

Ensure collectors are properly secured.

## Troubleshooting

### Connection Refused

```
[ERROR] BMP task: Failed to connect to 127.0.0.1:11019
```

Check:
- BMP collector is running
- Correct IP and port
- Firewall rules
- Network connectivity

### High Message Rates

```
[WARN] BMP task: Message queue growing (500 pending)
```

Indicates:
- Collector is slow to consume
- Network congestion
- High route churn

Solutions:
- Increase collector capacity
- Reduce statistics interval
- Check network performance

### Missing Routes

If routes aren't appearing in collector:

1. Verify peer is established: `bgpgg peer list`
2. Check routes exist: `bgpgg global rib show`
3. Verify BMP connection: Check bgpgg logs
4. Test collector: `tcpdump port 11019`

## Future Enhancements

Planned features:

### SQLite BMP Destination

Local state export for CLI/Web UI:

```
bgpgg -> BmpDestination::Sqlite -> SQLite DB -> CLI queries
```

Benefits:
- No external collector needed
- Fast local queries
- Built-in observability

### Additional Statistics

- Routes rejected by policy
- Duplicate update count
- Best path changes
- Memory usage per peer

### Message Filtering

Configure which messages to send:

```yaml
bmp_servers:
  - address: "127.0.0.1:11019"
    filter:
      peer_up: true
      peer_down: true
      route_monitoring: true
      statistics: false
```

## References

- RFC 7854: BGP Monitoring Protocol (BMP)
- RFC 8671: BMP Support for Adj-RIB-Out
- [Architecture Guide](architecture) - BMP implementation details
- [Configuration Guide](configuration) - BMP configuration reference
