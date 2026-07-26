+++
title = 'Policy'
weight = 5
+++

Policies decide which routes are accepted from a peer and which are advertised back. They live inside `service bgp { ... }` and reference reusable defined-sets (prefix lists, neighbor sets, AS-path patterns, communities).

## Defined Sets

```
prefix-list internal-prefixes {
  10.0.0.0/8
  10.0.0.0/8 ge 16 le 24
  192.168.0.0/16 exact
}

neighbor-set upstream-neighbors {
  192.168.1.1
  192.168.1.2
}

as-path-set upstream-asns {
  "^65001$"
  "_65000_"
}

community-set no-export-communities {
  65000:100
  no-export
}

ext-community-set rt-set {
  rt:65000:100
}

large-community-set lc-set {
  65000:100:200
}
```

`prefix-list` entries can take an optional masklength qualifier:

- `<prefix> exact` — match only the exact masklength.
- `<prefix> ge N` / `le M` — match masklengths in the given range.

## Policy Blocks

The shorthand form covers the common case of "match a set, decide":

```
policy import-from-customer {
  match internal-prefixes accept
  default reject
}
```

For richer logic, use `statement` blocks:

```
policy import-from-customer {
  statement prefer-customer {
    match prefix-set internal-prefixes
    match neighbor-set upstream-neighbors invert
    match rpki valid
    set local-pref 200
    set community add 65000:100
    accept
  }
  statement drop-invalid {
    match rpki invalid
    reject
  }
  default reject
}
```

A policy is evaluated top to bottom; the first statement whose match clauses all hold decides the route. If no statement matches, the policy's `default` action applies.

### Match Clauses

| Clause | Description |
|---|---|
| `match prefix-set <name> [any\|all\|invert]` | Match against a `prefix-list`. |
| `match neighbor-set <name> [any\|all\|invert]` | Match against a `neighbor-set`. |
| `match as-path-set <name> [any\|all\|invert]` | Match against an `as-path-set`. |
| `match community-set <name> [any\|all\|invert]` | Match against a `community-set`. |
| `match ext-community-set <name> [any\|all\|invert]` | Match against an `ext-community-set`. |
| `match large-community-set <name> [any\|all\|invert]` | Match against a `large-community-set`. |
| `match prefix <CIDR>` | Inline prefix match. |
| `match neighbor <addr>` | Inline neighbor match. |
| `match has-asn <ASN>` | AS_PATH contains ASN. |
| `match route-type <ebgp\|ibgp\|local>` | |
| `match community <AA:NN>` | Inline community match. |
| `match rpki <valid\|invalid\|not-found>` | RFC 8097 origin validation state. |
| `match afi-safi <afi-safi>` | |
| `match ls-nlri-type <type>` | BGP-LS NLRI type. |
| `match ls-protocol-id <id>` | |
| `match ls-instance-id <N>` | |
| `match ls-node-as <ASN>` | |
| `match ls-node-router-id <addr>` | |

The `any` / `all` / `invert` modifier on set matches:

- `any` (default) — at least one element matches.
- `all` — every element matches.
- `invert` — no element matches.

### Set Clauses

| Clause | Description |
|---|---|
| `set local-pref <N>` | Set LOCAL_PREF. |
| `set local-pref force <N>` | Set LOCAL_PREF unconditionally. |
| `set med <N>` | Set MED. |
| `set med remove` | Strip MED. |
| `set community <add\|remove\|replace> <AA:NN>...` | Edit COMMUNITIES. |
| `set ext-community <add\|remove\|replace> <...>` | Edit extended communities. |
| `set large-community <add\|remove\|replace> <GA:LD1:LD2>...` | Edit large communities. |
| `set rpki-state <valid\|invalid\|not-found>` | Override RPKI state. |

### Disposition

Each statement ends with `accept` or `reject`. The policy's `default <accept|reject>` line decides routes not matched by any statement.

## Attaching Policies

Policies bind to a peer's address family:

```
peer 192.168.1.1 {
  remote-as 65001

  family ipv4 unicast {
    import policy import-from-customer
    export policy to-upstreams
  }
}
```

Each family takes one `import` and one `export` policy. Setting it again through `ggsh configure` replaces the previous binding.
