[axilog](/axilog/) has two JSON outputs. The **native report**
(`--format json`, and what the Node and Python SDKs' `parseFile`/`parse_file`
return) is the primary one: everything axilog computes, in axilog's own
shape. The **EI-compat report** (`--format ei-json`) is a lossy projection of
the same data into Elite Insights' JSON shape, for tools that already read EI
exports.

The native format is versioned independently of the binary — the current
contract is **1.0**, carried in every document as `axilog.schema`. This page
covers it in full, then the EI-compat surface at the end.

This page is about **shape** — what keys exist, what they mean, and when they
are there. If you are looking for how to *get* one of these documents, start
at the [quickstart](/axilog/quickstart/). If you are looking for how a
particular number is *derived*, that is the
[calculation methodology](/axilog/methodology/), with dedicated deep dives for
[damage modifiers](/axilog/damage-modifiers/),
[buffs & boons](/axilog/buffs/) and [combat replay](/axilog/combat-replay/).
