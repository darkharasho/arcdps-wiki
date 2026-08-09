---
title: Parsing EVTC logs in practice
description: A tested, minimal Python walkthrough of reading a .zevtc log — header, agent table, skill table, and event stream.
source: community
---

The [EVTC log format](/reference/evtc-format/) page specifies the
binary layout; this page walks through actually reading one, with a
minimal Python parser. **The code below was run against a real
revision-1 WvW `.zevtc` log (arcdps build 20260114) while writing this
page**, and the observed values are quoted after each step — so what
you see here is verified behavior, not just transcription.

If you're building anything serious, use an established parser
([Elite Insights](https://github.com/baaron4/GW2-Elite-Insights-Parser)
for C#, [`evtc_parse`](https://github.com/Zerthox/arcdps-rs) for Rust)
— this walkthrough exists to make the format concrete. If you want to see
what each step below turns into once it is carried all the way to
EI-comparable numbers, [axilog](/axilog/) documents its
[derivations](/axilog/methodology/) and
[how they are calibrated](/axilog/accuracy/) here on the wiki.

## 1. Unwrap the zip

A `.zevtc` is a standard zip archive with a single entry. Note the
inner entry may have **no file extension** (in our test log the entry
was named `20260125-202439`, not `…​.evtc`):

```python
import zipfile, struct, collections

with zipfile.ZipFile("20260125-202439.zevtc") as z:
    data = z.read(z.namelist()[0])
```

## 2. Header (16 bytes)

```python
magic = data[0:4]                              # b'EVTC'
build = data[4:12].decode()                    # '20260114' (yyyymmdd)
revision = data[12]                            # 1
boss_id = struct.unpack_from('<H', data, 13)[0]  # 1 -> WvW log
# data[15] is unused
assert magic == b'EVTC'
```

Observed: `rev=1`, `boss=1` — a WvW log, exactly per the header spec
(`1` = WvW, `2` = map log, otherwise a boss species id from the
[encounter list](/reference/encounter-ids/)).

## 3. Agent table

```python
off = 16
(agent_count,) = struct.unpack_from('<I', data, off); off += 4

agents = []
for _ in range(agent_count):            # 96 bytes each
    iid, prof, is_elite = struct.unpack_from('<QII', data, off)
    tough, conc, heal, hb_width, cond, defunc = \
        struct.unpack_from('<hhhHhH', data, off + 16)
    name_parts = data[off+28 : off+92].split(b'\x00')
    agents.append((iid, prof, is_elite, name_parts))
    off += 96
```

Classification (the official rules, mechanically):

```python
def kind(prof, is_elite):
    if is_elite == 0xFFFFFFFF:
        return "gadget" if (prof >> 16) == 0xFFFF else "npc"
    return "player"
```

Observed on the test log: 133 agents — 44 players, 61 NPCs, 28
gadgets; no misclassifications.

Player name combo strings behave exactly as specified. A squad member
decoded as:

```
['Wag Toof', ':Wag Z.8294', '3']   # character, :account, subgroup
```

Two real-world confirmations worth knowing:

- **Enemy players** in WvW decoded with only a single name part (a
  server-randomized character name) and **no account name** — matching
  the community observation that hostile players' account data isn't
  available.
- **Stats were all zero** for every player in this log — consistent
  with the anonymization step (values are reduced to 0 or 10 relative
  to the squad max; don't read them as real attributes).

## 4. Skill table

```python
(skill_count,) = struct.unpack_from('<I', data, off); off += 4
skills = {}
for _ in range(skill_count):            # 68 bytes each
    (sid,) = struct.unpack_from('<i', data, off)
    skills[sid] = data[off+4 : off+68].split(b'\x00')[0].decode('utf8')
    off += 68
```

Observed: 800 skills, UTF-8 names.

## 5. Event stream

Everything from here to end-of-file is 64-byte
[`cbtevent`](/reference/data-structures/cbtevent/) structs:

```python
n_events, rem = divmod(len(data) - off, 64)
assert rem == 0                          # held: 162,262 events exactly

hist = collections.Counter()
for i in range(n_events):
    o = off + i*64
    time, src_agent, dst_agent = struct.unpack_from('<QQQ', data, o)
    value, buff_dmg = struct.unpack_from('<ii', data, o + 24)
    overstack, skillid = struct.unpack_from('<II', data, o + 32)
    is_statechange = data[o + 56]
    hist[is_statechange] += 1
```

Dispatch on `is_statechange` using the
[statechange payloads](/reference/enums/statechange-payloads/)
reference. The test log's histogram is a useful reality check on what
dominates a modern log:

| Count | Statechange | Note |
| --- | --- | --- |
| 75,382 | `CBTS_COMBAT` (0) | actual combat events — under half the file |
| 18,862 / 17,534 / 13,882 | `CBTS_POSITION` / `CBTS_VELOCITY` / `CBTS_FACING` | movement telemetry is a huge share |
| 5,656 | `CBTS_HEALTHPCTUPDATE` | |
| 5,049 / 3,269 | `CBTS_EFFECTAGENTCREATE` / `CBTS_EFFECTGROUNDCREATE` | |
| 3,409 | `CBTS_EXTENSIONCOMBAT` (49) | injected by a loaded extension via [`e10`](/reference/extension-api/arcdps-exports/#e10--add-event-with-skill-processing) — expect third-party events in real logs |
| 2,169 / 2,339 / 2,112 | `CBTS_MISSILECREATE` / `LAUNCH` / `REMOVE` | |

Metadata events decoded as specified: `CBTS_LANGUAGE` → `0`
(English), `CBTS_GWBUILD` → `194363`, and `CBTS_ARCBUILD` yielded the
null-terminated string `20260114.194045-576-x64` in `src_agent`'s
bytes — which is also the format of the `arcversionstr` your
extension receives in `get_init_addr`.

## 6. Then apply the standard recipe

From here, follow the official three-pass algorithm on the
[format page](/reference/evtc-format/#the-standard-parsing-recipe):
assign instance ids and aware windows, resolve minion masters, then
extract your data.

## Revision 0 logs

If `header[12] == 0` you have an old-format log: `overstack_value`
and `skillid` are 2-byte fields, `dst_master_instid` doesn't exist,
and padding fills the difference (events are still 64 bytes). See the
[revision notes](/reference/evtc-format/#revision-history-notes) and
Elite Insights' `ReadCombatItem` for the authoritative rev-0 reader.

## See also

- [EVTC log format](/reference/evtc-format/) — the specification this
  walkthrough exercises.
- [Statechange payloads](/reference/enums/statechange-payloads/) —
  per-event field semantics for step 5.
- [Ecosystem](/guides/ecosystem/) — production-grade parsers to build
  on instead.
