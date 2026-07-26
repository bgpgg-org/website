+++
title = 'First rogg deployment'
date = 2026-07-26T12:00:00-07:00
slug = 'first-rogg-deployment'
draft = false
+++

rogg now runs a live network on <a href="https://dn42.dev/" target="_blank" rel="noopener">dn42</a>, the decentralized peer-to-peer network. It powers AS4242423930, which originates /27 IPv4 and /48 IPv6 blocks from two points of presence. Both POPs run on AWS, connected by iBGP. SEA1 holds an eBGP session with an upstream carrying the full dn42 table (~2,300 routes). bgpgg streams per-peer session state, RIB sizes, and process memory to Prometheus and CloudWatch metrics through emf logs.
