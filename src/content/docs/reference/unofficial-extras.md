---
title: Unofficial Extras API
description: The arcdps_unofficial_extras companion addon's subscriber API — squad updates, chat messages, language changes, and keybind access.
source: community
---

[Unofficial Extras](https://github.com/Krappa322/arcdps_unofficial_extras_releases)
is a companion addon (by the author of `arcdps_healing_stats`) that
fills gaps arcdps deliberately leaves: squad roster with account
names, chat messages, language changes, and keybind reading. It is
**not part of arcdps** — it's a separate `arcdps_*.dll` extension
that other extensions subscribe to.

The addon is closed source "in compliance with requests made by Guild
Wars 2 community managers", but its API is public: every release
ships `Definitions.h` (plus `KeyBindStructs.h`/`KeyBindHelper.h`).
Everything below is sourced from `Definitions.h` at the repo's master
branch (fetched 2026-08-08); this page summarizes — the header is the
authority.

## Subscribing

Export this function from your extension DLL:

```cpp
void arcdps_unofficial_extras_subscriber_init(
    const ExtrasAddonInfo* pExtrasInfo,
    void* pSubscriberInfo);
```

It is "called once at startup. Can be called before or after arcdps
calls mod_init" — don't assume ordering relative to your arcdps
initialization.

`ExtrasAddonInfo` describes the running Unofficial Extras:

```cpp
struct ExtrasAddonInfo {
    uint32_t ApiVersion;      // "Current version is 2."
    uint32_t MaxInfoVersion;  // highest ExtrasSubscriberInfo version supported; "Current version is 4."
    const char* StringVersion;
    const char* SelfAccountName; // with leading ':'
    HMODULE ExtrasHandle;
};
```

You respond by filling a **versioned** `ExtrasSubscriberInfoV<N>`
struct through `pSubscriberInfo`, setting `InfoVersion` in its header
to the version whose layout you filled. Version negotiation matters:
the buffer is only guaranteed large enough for versions the running
Extras knows, so fill
`min(MaxInfoVersion, highest-version-you-support)` and never write
callbacks past the negotiated layout. Set `SubscriberName` to a
non-null string, or the subscription is treated as failed.

## Callbacks

```cpp
typedef void (*SquadUpdateCallbackSignature)(
    const UserInfo* pUpdatedUsers, uint64_t pUpdatedUsersCount);
typedef void (*LanguageChangedCallbackSignature)(Language pNewLanguage);
typedef void (*KeyBindChangedCallbackSignature)(
    KeyBinds::KeyBindChanged pChangedKeyBind);
typedef void (*ChatMessageCallbackSignature)(
    const SquadMessageInfo* pChatMessage);
typedef void (*ChatMessageInfoSignature2)(
    ChatMessageType pMessageType, ChatMessageInfo2 pChatMessage);
```

Later callbacks require later `InfoVersion`s (the squad-chat callback
arrived with version 2, the general chat-message callback with
version 3; version 4 changed `UserInfo` rather than adding a
callback).

## Squad updates: `UserInfo`

```cpp
struct UserInfo {
    const char* AccountName; // leading ':'; only valid during the callback
    uint64_t JoinTime;       // unix timestamp; 0 if unknown
    UserRole Role;
    uint8_t Subgroup;        // 0 = first subgroup or no subgroup
    bool ReadyStatus;
    // GroupType (Party/Squad) since InfoVersion 4
};

enum class UserRole : uint8_t {
    SquadLeader = 0, Lieutenant, Member, Invited, Applied,
    None,    // user was removed from squad
    Invalid,
};
```

Key semantics:

- `AccountName` pointers are **only valid during the call** — copy
  the strings out.
- `Role == None` means the user left/was removed; that's how you
  detect departures.
- **Ready checks**: a `SquadLeader` update with
  `ReadyStatus == true` means a ready check started; `false` means it
  finished or was cancelled. If every member received
  `ReadyStatus == true`, the check succeeded — after which per-user
  `false` updates follow.

## Chat messages

`SquadMessageInfo` carries channel id, type, subgroup (or
`UINT8_MAX` for the whole squad), an is-broadcast bit, an ISO-8601
server timestamp, and account name / character name / text with
explicit lengths. The version-3 general callback distinguishes
`ChatMessageType { Squad = 0, NPC = 1 }`, with `NpcMessageInfo`
providing character name, message, and a nanosecond timestamp.

## Language

```cpp
enum class Language { English = 0, French = 2, German = 3,
                      Spanish = 4, Chinese = 5 };
```

Identical values to arcdps' own
[`gwlanguage`](/reference/enums/#gwlanguage-text-language) (note the
gap at 1).

## Keybinds

Unofficial Extras exposes keybind *reading* two ways: the
`KeyBindChanged` callback, and exports on `ExtrasHandle` —
community bindings resolve `get_key` and `get_key_bind` via
`GetProcAddress`. Both return an empty/default key "if the key is not
set or if the functionality is disabled cause of missing patterns"
(i.e. after a game patch breaks its pattern scanning).

## Rust support

The [`arcdps-rs`](https://github.com/Zerthox/arcdps-rs) bindings
generate the subscriber export for you (only when an extras callback
is registered) and handle version negotiation; `arcdps_bindings`
(greaka) likewise supports `unofficial_extras_squad_update` in its
macro.

## See also

- [Writing an extension in practice](/guides/writing-an-extension/) —
  where Extras fits in a plugin's architecture.
- [Combat callback](/reference/extension-api/combat-callback/) — what
  arcdps itself does and doesn't tell you about squad members.
- [Ecosystem](/guides/ecosystem/) — the wider tool landscape.
