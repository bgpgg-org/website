+++
title = 'Initial release'
date = 2025-12-27T18:45:37-08:00
slug = 'initial-release'
draft = false
+++

bgpgg v0.1.0 is now available, implementing RFC4271 (BGP-4) in Rust. This is the foundation—the bare minimum needed to get started. The vision is to build a BGP router designed for observability from the ground up, exporting state to SQLite so monitoring systems, dashboards, and CLI tools can query routing information without impacting the router's performance under load.
