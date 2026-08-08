---
title: EVTC log format
description: Placeholder — a full binary-format spec for arcdps' .evtc/.zevtc combat logs is a planned follow-on.
source: community
---

:::note[Planned]
This page is a stub. A full field-by-field breakdown of the `.evtc`/`.zevtc`
binary combat-log format is planned as a follow-on to this wiki, but is not
written yet. Nothing below should be read as a format specification —
no offsets, struct layouts, or field semantics are documented here.
:::

## Why this isn't the exports reference

The rest of this wiki documents the arcdps DLL's live extension API — the
exports and structs (`cbtevent`, `ag`, and friends) that a loaded extension
module receives at runtime, described starting at
[Getting Started](/getting-started/) and the [Exports](/reference/exports/)
section.

`.evtc`/`.zevtc` logs are a different thing: arcdps writes them to disk after
a combat encounter, and they're consumed **offline**, after the fact, by
separate tooling — not by extension DLLs at runtime.

## How most consumers actually work today

In practice, almost nobody writing a Node, Python, or Rust tool that reads
arcdps logs does so by linking against arcdps or writing a native extension
module. Instead, they parse the `.evtc`/`.zevtc` file directly as a
combat-log file format — the same approach
[Elite Insights](https://github.com/baaron4/GW2-Elite-Insights-Parser) takes.
This is the practical path for anyone building a log parser, uploader, or
analysis tool in a language other than C/C++.

## Authoritative source, for now

Until this page grows into a full spec, the authoritative description of the
EVTC binary format is deltaconnected's own EVTC documentation:

- <https://www.deltaconnected.com/arcdps/evtc/>

Treat that page as the source of truth for field layouts and semantics in
the meantime. A community-maintained spec here is planned but intentionally
deferred — see [Contributing](/contributing/) if you'd like to help write it.
