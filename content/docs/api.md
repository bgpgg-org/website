---
title: API Reference
weight: 5
---

# API Reference

bgpgg provides a gRPC API for programmatic control and monitoring. The CLI tool uses this same API.

## gRPC Service

Service definition: `bgp.BgpService`

Default endpoint: `http://127.0.0.1:50051`

Configure via `grpc_listen_addr` in config file:

```yaml
grpc_listen_addr: "127.0.0.1:50051"  # Local only
grpc_listen_addr: "0.0.0.0:50051"    # Allow remote access
```

## Proto Definition

Complete protocol buffer definition: [`proto/bgp.proto`](https://github.com/bgpgg-org/bgpgg/blob/master/proto/bgp.proto)

## Peer Management

### AddPeer

Add a new BGP peer.

```protobuf
rpc AddPeer(AddPeerRequest) returns (AddPeerResponse);

message AddPeerRequest {
    string address = 1;              // IP:PORT format
    optional SessionConfig config = 2;  // Optional peer config
}

message AddPeerResponse {
    bool success = 1;
    string message = 2;
}
```

Example (Python):

```python
import grpc
from proto import bgp_pb2, bgp_pb2_grpc

channel = grpc.insecure_channel('127.0.0.1:50051')
client = bgp_pb2_grpc.BgpServiceStub(channel)

request = bgp_pb2.AddPeerRequest(
    address="192.168.1.2:17900"
)
response = client.AddPeer(request)
print(f"Success: {response.success}, Message: {response.message}")
```

With session config:

```python
config = bgp_pb2.SessionConfig(
    idle_hold_time_secs=30,
    damp_peer_oscillations=True,
    max_prefix=bgp_pb2.MaxPrefixSetting(
        limit=10000,
        action=bgp_pb2.MaxPrefixAction.TERMINATE
    )
)

request = bgp_pb2.AddPeerRequest(
    address="192.168.1.2:17900",
    config=config
)
response = client.AddPeer(request)
```

### RemovePeer

Remove a BGP peer.

```protobuf
rpc RemovePeer(RemovePeerRequest) returns (RemovePeerResponse);

message RemovePeerRequest {
    string address = 1;
}

message RemovePeerResponse {
    bool success = 1;
    string message = 2;
}
```

### DisablePeer

Administratively disable a peer (RFC 4486).

```protobuf
rpc DisablePeer(DisablePeerRequest) returns (DisablePeerResponse);

message DisablePeerRequest {
    string address = 1;
}
```

Sends CEASE notification with Administrative Shutdown.

### EnablePeer

Re-enable an administratively disabled peer.

```protobuf
rpc EnablePeer(EnablePeerRequest) returns (EnablePeerResponse);

message EnablePeerRequest {
    string address = 1;
}
```

### ResetPeer

Reset a BGP session (soft or hard reset).

```protobuf
rpc ResetPeer(ResetPeerRequest) returns (ResetPeerResponse);

message ResetPeerRequest {
    string address = 1;
    ResetType reset_type = 2;
    optional Afi afi = 3;
    optional Safi safi = 4;
}

enum ResetType {
    SOFT_IN = 0;   // Refresh routes from peer
    SOFT_OUT = 1;  // Re-send routes to peer
    SOFT = 2;      // Both SOFT_IN and SOFT_OUT
    HARD = 3;      // Tear down and re-establish session
}
```

### ListPeers

List all configured peers.

```protobuf
rpc ListPeers(ListPeersRequest) returns (ListPeersResponse);

message ListPeersRequest {}

message ListPeersResponse {
    repeated Peer peers = 1;
}

message Peer {
    string address = 1;
    uint32 asn = 2;
    BgpState state = 3;
    AdminState admin_state = 4;
    bool configured = 5;
    repeated string import_policies = 6;
    repeated string export_policies = 7;
}

enum BgpState {
    IDLE = 0;
    CONNECT = 1;
    ACTIVE = 2;
    OPEN_SENT = 3;
    OPEN_CONFIRM = 4;
    ESTABLISHED = 5;
}

enum AdminState {
    UP = 0;
    DOWN = 1;
    PREFIX_LIMIT_EXCEEDED = 2;
}
```

### ListPeersStream

Stream peers as they're found (for large lists).

```protobuf
rpc ListPeersStream(ListPeersRequest) returns (stream Peer);
```

### GetPeer

Get detailed information about a specific peer.

```protobuf
rpc GetPeer(GetPeerRequest) returns (GetPeerResponse);

message GetPeerRequest {
    string address = 1;
}

message GetPeerResponse {
    Peer peer = 1;
    PeerStatistics statistics = 2;
}

message PeerStatistics {
    uint64 open_sent = 1;
    uint64 keepalive_sent = 2;
    uint64 update_sent = 3;
    uint64 notification_sent = 4;
    uint64 open_received = 5;
    uint64 keepalive_received = 6;
    uint64 update_received = 7;
    uint64 notification_received = 8;
}
```

## Route Management

### AddRoute

Add a route to the global RIB.

```protobuf
rpc AddRoute(AddRouteRequest) returns (AddRouteResponse);

message AddRouteRequest {
    string prefix = 1;
    string next_hop = 2;
    Origin origin = 3;
    repeated AsPathSegment as_path = 4;
    optional uint32 local_pref = 5;
    optional uint32 med = 6;
    bool atomic_aggregate = 7;
    repeated uint32 communities = 8;
    repeated ExtendedCommunity extended_communities = 9;
    repeated LargeCommunity large_communities = 10;
}

enum Origin {
    IGP = 0;
    EGP = 1;
    INCOMPLETE = 2;
}

message AsPathSegment {
    AsPathSegmentType segment_type = 1;
    repeated uint32 asns = 2;
}

enum AsPathSegmentType {
    AS_SET = 0;
    AS_SEQUENCE = 1;
}
```

Example (Python):

```python
request = bgp_pb2.AddRouteRequest(
    prefix="10.0.0.0/24",
    next_hop="192.168.1.1",
    origin=bgp_pb2.Origin.IGP,
    as_path=[
        bgp_pb2.AsPathSegment(
            segment_type=bgp_pb2.AsPathSegmentType.AS_SEQUENCE,
            asns=[65001, 65002, 65003]
        )
    ],
    local_pref=200,
    communities=[
        (65001 << 16) | 100,  # 65001:100
        0xFFFFFF01,           # NO_EXPORT
    ]
)
response = client.AddRoute(request)
```

### AddRouteStream

Bulk add routes via streaming.

```protobuf
rpc AddRouteStream(stream AddRouteRequest) returns (AddRouteStreamResponse);

message AddRouteStreamResponse {
    uint64 count = 1;  // Number of routes successfully added
    string message = 2;
}
```

Example (Python):

```python
def route_generator():
    for i in range(1000):
        yield bgp_pb2.AddRouteRequest(
            prefix=f"10.{i//256}.{i%256}.0/24",
            next_hop="192.168.1.1",
            origin=bgp_pb2.Origin.IGP
        )

response = client.AddRouteStream(route_generator())
print(f"Added {response.count} routes")
```

### RemoveRoute

Remove a route from the global RIB.

```protobuf
rpc RemoveRoute(RemoveRouteRequest) returns (RemoveRouteResponse);

message RemoveRouteRequest {
    string prefix = 1;
}

message RemoveRouteResponse {
    bool success = 1;
    string message = 2;
}
```

### ListRoutes

List routes in the routing table.

```protobuf
rpc ListRoutes(ListRoutesRequest) returns (ListRoutesResponse);

message ListRoutesRequest {
    optional RibType rib_type = 1;
    optional string peer_address = 2;
}

enum RibType {
    GLOBAL = 0;   // Global RIB (Loc-RIB)
    ADJ_IN = 1;   // Per-peer Adj-RIB-In
    ADJ_OUT = 2;  // Per-peer Adj-RIB-Out (computed on-demand)
}

message ListRoutesResponse {
    repeated Route routes = 1;
}

message Route {
    string prefix = 1;
    repeated Path paths = 2;
}

message Path {
    Origin origin = 1;
    repeated AsPathSegment as_path = 2;
    string next_hop = 3;
    string peer_address = 4;
    optional uint32 local_pref = 5;
    optional uint32 med = 6;
    bool atomic_aggregate = 7;
    repeated UnknownAttribute unknown_attributes = 8;
    repeated uint32 communities = 9;
    repeated ExtendedCommunity extended_communities = 10;
    repeated LargeCommunity large_communities = 11;
}
```

Example queries:

```python
# Get global RIB
request = bgp_pb2.ListRoutesRequest(
    rib_type=bgp_pb2.RibType.GLOBAL
)
response = client.ListRoutes(request)

# Get routes learned from specific peer
request = bgp_pb2.ListRoutesRequest(
    rib_type=bgp_pb2.RibType.ADJ_IN,
    peer_address="192.168.1.2:17900"
)
response = client.ListRoutes(request)
```

### ListRoutesStream

Stream routes (for large routing tables).

```protobuf
rpc ListRoutesStream(ListRoutesRequest) returns (stream Route);
```

## Server Info

### GetServerInfo

Get server information.

```protobuf
rpc GetServerInfo(GetServerInfoRequest) returns (GetServerInfoResponse);

message GetServerInfoRequest {}

message GetServerInfoResponse {
    string listen_addr = 1;
    uint32 listen_port = 2;
    uint64 num_routes = 3;
}
```

## BMP Management

### AddBmpServer

Add a BMP monitoring server.

```protobuf
rpc AddBmpServer(AddBmpServerRequest) returns (AddBmpServerResponse);

message AddBmpServerRequest {
    string address = 1;
    optional uint64 statistics_timeout = 2;
}

message AddBmpServerResponse {
    bool success = 1;
    string message = 2;
}
```

Example:

```python
request = bgp_pb2.AddBmpServerRequest(
    address="127.0.0.1:11019",
    statistics_timeout=60  # Send stats every 60 seconds
)
response = client.AddBmpServer(request)
```

### RemoveBmpServer

Remove a BMP monitoring server.

```protobuf
rpc RemoveBmpServer(RemoveBmpServerRequest) returns (RemoveBmpServerResponse);

message RemoveBmpServerRequest {
    string address = 1;
}
```

### ListBmpServers

List configured BMP servers.

```protobuf
rpc ListBmpServers(ListBmpServersRequest) returns (ListBmpServersResponse);

message ListBmpServersRequest {}

message ListBmpServersResponse {
    repeated string addresses = 1;
}
```

## Policy Management

### AddDefinedSet

Add or update a defined set for policy matching.

```protobuf
rpc AddDefinedSet(AddDefinedSetRequest) returns (AddDefinedSetResponse);

message AddDefinedSetRequest {
    DefinedSetConfig set = 1;
    bool replace = 2;  // Replace existing set
}
```

### RemoveDefinedSet

Remove a defined set.

```protobuf
rpc RemoveDefinedSet(RemoveDefinedSetRequest) returns (RemoveDefinedSetResponse);
```

### ListDefinedSets

List all defined sets.

```protobuf
rpc ListDefinedSets(ListDefinedSetsRequest) returns (ListDefinedSetsResponse);
```

### AddPolicy

Add or update a policy definition.

```protobuf
rpc AddPolicy(AddPolicyRequest) returns (AddPolicyResponse);
```

### RemovePolicy

Remove a policy definition.

```protobuf
rpc RemovePolicy(RemovePolicyRequest) returns (RemovePolicyResponse);
```

### ListPolicies

List all policy definitions.

```protobuf
rpc ListPolicies(ListPoliciesRequest) returns (ListPoliciesResponse);
```

### SetPolicyAssignment

Assign policies to a peer.

```protobuf
rpc SetPolicyAssignment(SetPolicyAssignmentRequest) returns (SetPolicyAssignmentResponse);
```

## Communities

### Standard Communities

32-bit values in format `ASN:VALUE`:

```python
# 65001:100
community = (65001 << 16) | 100

# Well-known communities
NO_EXPORT = 0xFFFFFF01
NO_ADVERTISE = 0xFFFFFF02
NO_EXPORT_SUBCONFED = 0xFFFFFF03
NOPEER = 0xFFFFFF04
```

### Extended Communities

```protobuf
message ExtendedCommunity {
  oneof community {
    TwoOctetAsSpecific two_octet_as = 1;
    IPv4AddressSpecific ipv4_address = 2;
    FourOctetAsSpecific four_octet_as = 3;
    LinkBandwidth link_bandwidth = 4;
    Color color = 5;
    Encapsulation encapsulation = 6;
    RouterMac router_mac = 7;
    Opaque opaque = 8;
    Unknown unknown = 9;
  }
}
```

Example Route Target:

```python
ec = bgp_pb2.ExtendedCommunity(
    two_octet_as=bgp_pb2.ExtendedCommunity.TwoOctetAsSpecific(
        is_transitive=True,
        sub_type=0x02,  # Route Target
        asn=65001,
        local_admin=100
    )
)
```

### Large Communities

```protobuf
message LargeCommunity {
    uint32 global_admin = 1;
    uint32 local_data_1 = 2;
    uint32 local_data_2 = 3;
}
```

Example:

```python
lc = bgp_pb2.LargeCommunity(
    global_admin=65001,
    local_data_1=1,
    local_data_2=100
)
```

## Client Examples

### Python

Install dependencies:

```bash
pip install grpcio grpcio-tools
python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. proto/bgp.proto
```

Full example:

```python
import grpc
from proto import bgp_pb2, bgp_pb2_grpc

# Connect to server
channel = grpc.insecure_channel('127.0.0.1:50051')
client = bgp_pb2_grpc.BgpServiceStub(channel)

# Add a peer
response = client.AddPeer(bgp_pb2.AddPeerRequest(
    address="192.168.1.2:17900"
))
print(f"Add peer: {response.success}")

# List peers
response = client.ListPeers(bgp_pb2.ListPeersRequest())
for peer in response.peers:
    print(f"Peer: {peer.address}, State: {bgp_pb2.BgpState.Name(peer.state)}")

# Add a route
response = client.AddRoute(bgp_pb2.AddRouteRequest(
    prefix="10.0.0.0/24",
    next_hop="192.168.1.1",
    origin=bgp_pb2.Origin.IGP,
    local_pref=200
))
print(f"Add route: {response.success}")

# List routes
response = client.ListRoutes(bgp_pb2.ListRoutesRequest(
    rib_type=bgp_pb2.RibType.GLOBAL
))
for route in response.routes:
    print(f"Route: {route.prefix}")
    for path in route.paths:
        print(f"  Next-hop: {path.next_hop}, Local-pref: {path.local_pref}")
```

### Go

```go
package main

import (
    "context"
    "log"

    "google.golang.org/grpc"
    pb "github.com/bgpgg-org/bgpgg/proto"
)

func main() {
    conn, err := grpc.Dial("127.0.0.1:50051", grpc.WithInsecure())
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    client := pb.NewBgpServiceClient(conn)

    // Add peer
    resp, err := client.AddPeer(context.Background(), &pb.AddPeerRequest{
        Address: "192.168.1.2:17900",
    })
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Add peer: %v", resp.Success)

    // List peers
    listResp, err := client.ListPeers(context.Background(), &pb.ListPeersRequest{})
    if err != nil {
        log.Fatal(err)
    }
    for _, peer := range listResp.Peers {
        log.Printf("Peer: %s, State: %v", peer.Address, peer.State)
    }
}
```

### Rust

```rust
use tonic::Request;
use bgp::bgp_service_client::BgpServiceClient;
use bgp::{AddPeerRequest, ListPeersRequest};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = BgpServiceClient::connect("http://127.0.0.1:50051").await?;

    // Add peer
    let request = Request::new(AddPeerRequest {
        address: "192.168.1.2:17900".to_string(),
        config: None,
    });
    let response = client.add_peer(request).await?;
    println!("Add peer: {}", response.get_ref().success);

    // List peers
    let request = Request::new(ListPeersRequest {});
    let response = client.list_peers(request).await?;
    for peer in response.get_ref().peers.iter() {
        println!("Peer: {}, State: {:?}", peer.address, peer.state);
    }

    Ok(())
}
```

## Error Handling

gRPC status codes:

- `OK`: Success
- `INVALID_ARGUMENT`: Invalid request parameters
- `NOT_FOUND`: Resource not found (peer, route, etc.)
- `ALREADY_EXISTS`: Resource already exists
- `UNAVAILABLE`: Service unavailable
- `INTERNAL`: Internal server error

Always check response messages for details:

```python
try:
    response = client.AddPeer(request)
    if not response.success:
        print(f"Failed: {response.message}")
except grpc.RpcError as e:
    print(f"gRPC error: {e.code()}: {e.details()}")
```

## Authentication

Currently bgpgg does not implement gRPC authentication. Use firewall rules or VPN to restrict access to the gRPC port.

Future versions may support:
- TLS with client certificates
- Token-based authentication
- mTLS

## See Also

- [CLI Reference](cli) - Command-line usage
- [Configuration Guide](configuration) - YAML configuration
- [Architecture](architecture) - Internal design
