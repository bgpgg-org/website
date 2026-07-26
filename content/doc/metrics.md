+++
title = 'Metrics'
weight = 4
+++

## Overview

bgpgg emits operational metrics through pluggable sinks. The same set of
metrics is rendered in three formats:

- **JSON** — one self-contained JSON line per metric, for platform-side
  extraction (GCP log-based metrics, Datadog, Azure, Loki, ...).
- **CloudWatch EMF** — Embedded Metric Format; CloudWatch Logs extracts the
  metrics server-side.
- **Prometheus** — a pull endpoint scraped over HTTP.

JSON and CloudWatch EMF are push sinks and are mutually exclusive. Prometheus
is a separate pull endpoint and can run alongside either. Enable a sink with a
`telemetry` block -- see [Configuration](/doc/configuration/#telemetry).

## Naming

Metric names are PascalCase (the CloudWatch convention). Names end in their
unit as a full word (`Count`, `Seconds`, `Milliseconds`, `Bytes`), except
cumulative counters which end in `Total`. Names are a public contract:
renames break dashboards.

Every metric carries a `RouterId` dimension (the local router-id). Other
dimensions shape the time series; context fields are logged alongside a metric
but are never turned into series.

## Output formats

The examples below all show the same event: a session to `10.0.0.1` reached
Established on router `1.1.1.1`.

**JSON** — the metric name, value, unit, timestamp, and `router_id` are
top-level fields; dimensions sit under `dim`:

```json
{"dim":{"Peer":"10.0.0.1"},"metric":"SessionEstablishedCount","router_id":"1.1.1.1","ts":"2026-07-25T23:00:00.000Z","unit":"Count","value":1}
```

**CloudWatch EMF** — the `_aws` block declares the dimension sets and unit;
`RouterId` is added to every set:

```json
{"Peer":"10.0.0.1","RouterId":"1.1.1.1","SessionEstablishedCount":1,"_aws":{"CloudWatchMetrics":[{"Dimensions":[["Peer","RouterId"]],"Metrics":[{"Name":"SessionEstablishedCount","Unit":"Count"}],"Namespace":"Rogg/Bgpgg"}],"Timestamp":1785024000000}}
```

**Prometheus** — names are converted to snake_case with a `bgpgg_` prefix
(`SessionState` becomes `bgpgg_session_state`), and dimensions become
snake_case labels. Identity comes from the scraper's `instance`/`job` labels,
so there is no `router_id` label:

```
# TYPE bgpgg_session_state gauge
bgpgg_session_state{peer="10.0.0.1"} 6
```

The Prometheus endpoint serves the text format at `/metrics`. Default port is
9273 (loopback, unauthenticated by convention).

## Event metrics

Emitted once per occurrence, at the event site.

| Metric | Value | Unit | Dimensions | Context |
|---|---|---|---|---|
| `SessionEstablishedCount` | 1 | Count | Peer | |
| `SessionDownCount` | 1 | Count | Peer | Reason |
| `ConnectRetryCount` | 1 | Count | Peer | |
| `TcpConnectionCount` | 1 | Count | Peer, Direction | |
| `CollisionDetectedCount` | 1 | Count | Peer | |
| `CollisionDialedWinsCount` | 1 | Count | Peer | |
| `CollisionAcceptedWinsCount` | 1 | Count | Peer | |
| `CollisionCandidateDroppedCount` | 1 | Count | Peer | |
| `HoldTimerExpiredCount` | 1 | Count | Peer | |
| `NotificationReceivedCount` | 1 | Count | Peer, Code | Subcode |
| `NotificationSentCount` | 1 | Count | Peer, Code | Subcode |
| `BmpConnectionDownCount` | 1 | Count | Destination | |
| `SessionConvergenceMilliseconds` | Established → EoR elapsed | Milliseconds | Peer, AfiSafi | |
| `InitialAdvertisementMilliseconds` | Full-table send elapsed | Milliseconds | Peer, AfiSafi | |
| `RouteRefreshProcessingMilliseconds` | Adj-rib-out resend elapsed | Milliseconds | Peer, AfiSafi | |
| `ConfigReloadSuccessCount` | 1 | Count | | DurationMs |
| `ConfigReloadFailureCount` | 1 | Count | | DurationMs |

## Periodic metrics

Sampled on the server timer every 60 seconds.

| Metric | Value | Unit | Dimensions |
|---|---|---|---|
| `PeerCount` | Configured peer count | Count | |
| `SessionState` | FSM state code (1=Idle, 2=Connect, 3=Active, 4=OpenSent, 5=OpenConfirm, 6=Established) | Count | Peer |
| `SessionUptimeSeconds` | Seconds since Established | Seconds | Peer |
| `LocRibRouteCount` | Loc-rib route count | Count | AfiSafi |
| `AdjRibInRouteCount` | Per-peer route count | Count | Peer |
| `AdjRibInAfiSafiRouteCount` | Per-family route count | Count | Peer, AfiSafi |
| `AdjRibInRouteTotalCount` | Routes received across all peers | Count | |
| `AdjRibOutRouteCount` | Per-peer route count | Count | Peer |
| `AdjRibOutAfiSafiRouteCount` | Per-family route count | Count | Peer, AfiSafi |
| `AdjRibOutRouteTotalCount` | Routes advertised across all peers | Count | |
| `ProcessMemoryBytes` | Resident set size | Bytes | |
| `MessagesReceivedTotal` | Cumulative messages received | Count | Peer, MessageType |
| `MessagesSentTotal` | Cumulative messages sent | Count | Peer, MessageType |

`MessageType` values: `Open`, `Keepalive`, `Update`, `Notification`,
`RouteRefresh` (lowercase `open`, `keepalive`, ... as Prometheus label values).
