+++
title = 'First rogg deployment'
date = 2026-07-26T12:00:00-07:00
slug = 'first-rogg-deployment'
draft = false
+++

rogg now runs a live network on <a href="https://dn42.dev/" target="_blank" rel="noopener">dn42</a>, a decentralized peer-to-peer network. It operates AS4242423930, originating a /27 IPv4 and /48 IPv6 block from two points of presence. Both POPs run on AWS and are linked by iBGP; one of them also holds an eBGP session with an upstream that carries the full dn42 table (~2,300 routes). bgpgg exports per-peer session state, RIB sizes, and process memory as Prometheus metrics and CloudWatch EMF logs.

Live dashboards and network maps are available at <a href="https://dn42.roggnetwork.com/" target="_blank" rel="noopener">dn42.roggnetwork.com</a>.
