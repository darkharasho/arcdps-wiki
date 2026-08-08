---
title: DirectX/DXGI proxy exports
description: The DXGI, D3D11, D3DKMT, PIX, and compat-shim exports arcdps' d3d11.dll forwards through to the real system DLL.
source: dll-exports
exportSymbols:
  - ApplyCompatResolutionQuirking
  - CompatString
  - CompatValue
  - CreateDXGIFactory
  - CreateDXGIFactory1
  - CreateDXGIFactory2
  - CreateDirect3D11DeviceFromDXGIDevice
  - CreateDirect3D11SurfaceFromDXGISurface
  - D3D11CoreCreateDevice
  - D3D11CoreCreateLayeredDevice
  - D3D11CoreGetLayeredDeviceSize
  - D3D11CoreRegisterLayers
  - D3D11CreateDevice
  - D3D11CreateDeviceAndSwapChain
  - D3D11CreateDeviceForD3D12
  - D3D11On12CreateDevice
  - D3DKMTCloseAdapter
  - D3DKMTCreateAllocation
  - D3DKMTCreateContext
  - D3DKMTCreateDevice
  - D3DKMTCreateSynchronizationObject
  - D3DKMTDestroyAllocation
  - D3DKMTDestroyContext
  - D3DKMTDestroyDevice
  - D3DKMTDestroySynchronizationObject
  - D3DKMTEscape
  - D3DKMTGetContextSchedulingPriority
  - D3DKMTGetDeviceState
  - D3DKMTGetDisplayModeList
  - D3DKMTGetMultisampleMethodList
  - D3DKMTGetRuntimeData
  - D3DKMTGetSharedPrimaryHandle
  - D3DKMTLock
  - D3DKMTOpenAdapterFromHdc
  - D3DKMTOpenResource
  - D3DKMTPresent
  - D3DKMTQueryAdapterInfo
  - D3DKMTQueryAllocationResidency
  - D3DKMTQueryResourceInfo
  - D3DKMTRender
  - D3DKMTSetAllocationPriority
  - D3DKMTSetContextSchedulingPriority
  - D3DKMTSetDisplayMode
  - D3DKMTSetDisplayPrivateDriverFormat
  - D3DKMTSetGammaRamp
  - D3DKMTSetVidPnSourceOwner
  - D3DKMTSignalSynchronizationObject
  - D3DKMTUnlock
  - D3DKMTWaitForSynchronizationObject
  - D3DKMTWaitForVerticalBlankEvent
  - D3DPerformance_BeginEvent
  - D3DPerformance_EndEvent
  - D3DPerformance_GetStatus
  - D3DPerformance_SetMarker
  - DXGID3D10CreateDevice
  - DXGID3D10CreateLayeredDevice
  - DXGID3D10GetLayeredDeviceSize
  - DXGID3D10RegisterLayers
  - DXGIDeclareAdapterRemovalSupport
  - DXGIDisableVBlankVirtualization
  - DXGIDumpJournal
  - DXGIGetDebugInterface1
  - DXGIReportAdapterConfiguration
  - EnableFeatureLevelUpgrade
  - OpenAdapter10
  - OpenAdapter10_2
  - PIXBeginCapture
  - PIXEndCapture
  - PIXGetCaptureState
  - SetAppCompatStringPointer
  - UpdateHMDEmulationStatus
---

As the [addon contract](/reference/extension-api/addon-contract/) page
notes, arcdps doesn't ship as a standalone executable or a normally-named
plugin DLL — it ships as `d3d11.dll` and is loaded by Guild Wars 2's own
DirectX proxy DLL loading mechanism. The game looks for a `d3d11.dll`
next to its executable and, if present, loads it instead of (or in
addition to) the system one. This is the mechanism that gets arcdps
injected into the game process at all, before any of its own combat
tracking or extension-loading logic runs.

For that trick to work without breaking the game's actual rendering,
arcdps' `d3d11.dll` has to behave like a real `d3d11.dll` from the
outside: every function the game (and the graphics driver stack beneath
it) expects to find in the system DLL has to exist in arcdps' DLL too,
with the same signature, and has to eventually reach the real
implementation. arcdps does this by **proxying** — its build process
exports the same symbol table as the real `d3d11.dll`, and each of those
exports just forwards the call through to the actual system DirectX DLL
(loaded internally under a different name) after arcdps has had a chance
to hook whatever it needs for overlay rendering and combat capture.

The 71 exports listed in this page's `exportSymbols` are exactly that
proxy surface, read off the DLL export table snapshot
(`data/arcdps-exports.json`). **None of them are part of the arcdps
addon API** — they carry no arcdps-specific behavior, take no
arcdps-specific parameters, and are not something an extension author
should ever call directly. They exist purely so Windows' loader and the
DirectX runtime accept arcdps' `d3d11.dll` as a drop-in replacement. If
you're writing an extension, everything you actually want is documented
under [Extension API](/reference/extension-api/addon-contract/); this
page exists so the export table snapshot has a documented home for every
symbol arcdps ships, not because these functions do anything
addon-specific.

Because they are standard OS/DirectX entry points with well-established
public signatures (published by Microsoft), they are **not**
individually documented here with reconstructed signatures — that would
duplicate Microsoft's own reference for no benefit, and any signature
guessed without verification would risk being wrong. They're grouped
below by subsystem for readability; see the [raw export
table](/reference/exports/raw-table/) for the flat list, or the [export
reference overview](/reference/exports/) for how this page fits with the
rest of the export surface.

## DXGI factory creation

`CreateDXGIFactory`, `CreateDXGIFactory1`, `CreateDXGIFactory2` — the
standard entry points used to obtain an `IDXGIFactory`/`IDXGIFactory1`/
`IDXGIFactory2` interface, the starting point for enumerating adapters
and creating swap chains.

## D3D11 device creation

`D3D11CreateDevice`, `D3D11CreateDeviceAndSwapChain`,
`D3D11CreateDeviceForD3D12`, `D3D11On12CreateDevice` — the public device
and swap-chain creation entry points from `d3d11.dll`, plus the D3D11-on-
D3D12 interop entry point.

## D3D11 core / layered device internals

`D3D11CoreCreateDevice`, `D3D11CoreCreateLayeredDevice`,
`D3D11CoreGetLayeredDeviceSize`, `D3D11CoreRegisterLayers` — lower-level,
internal-use entry points that back the public D3D11 device creation path
and support layered driver scenarios (e.g. debug/validation layers
sitting between the app and the driver).

## Direct3D 11 interop (WinRT)

`CreateDirect3D11DeviceFromDXGIDevice`,
`CreateDirect3D11SurfaceFromDXGISurface` — bridge functions between
classic DXGI/D3D11 objects and the WinRT `IDirect3DDevice`/
`IDirect3DSurface` interfaces used by newer composition and capture APIs.

## DXGI/D3D10 legacy layered-device internals

`DXGID3D10CreateDevice`, `DXGID3D10CreateLayeredDevice`,
`DXGID3D10GetLayeredDeviceSize`, `DXGID3D10RegisterLayers`,
`OpenAdapter10`, `OpenAdapter10_2` — the DXGI-side counterparts of the
D3D11 core/layered functions above, retained for D3D10-era interop and
layered-driver support.

## DXGI diagnostics and adapter management

`DXGIDeclareAdapterRemovalSupport`, `DXGIDisableVBlankVirtualization`,
`DXGIDumpJournal`, `DXGIGetDebugInterface1`,
`DXGIReportAdapterConfiguration` — adapter-removal signaling, debug
journal dumping, the debug-interface accessor, and adapter configuration
reporting used by diagnostic and driver tooling.

## D3DKMT kernel-mode thunks

Every `D3DKMT*` export (`D3DKMTCloseAdapter`, `D3DKMTCreateAllocation`,
`D3DKMTCreateContext`, `D3DKMTCreateDevice`,
`D3DKMTCreateSynchronizationObject`, `D3DKMTDestroyAllocation`,
`D3DKMTDestroyContext`, `D3DKMTDestroyDevice`,
`D3DKMTDestroySynchronizationObject`, `D3DKMTEscape`,
`D3DKMTGetContextSchedulingPriority`, `D3DKMTGetDeviceState`,
`D3DKMTGetDisplayModeList`, `D3DKMTGetMultisampleMethodList`,
`D3DKMTGetRuntimeData`, `D3DKMTGetSharedPrimaryHandle`, `D3DKMTLock`,
`D3DKMTOpenAdapterFromHdc`, `D3DKMTOpenResource`, `D3DKMTPresent`,
`D3DKMTQueryAdapterInfo`, `D3DKMTQueryAllocationResidency`,
`D3DKMTQueryResourceInfo`, `D3DKMTRender`, `D3DKMTSetAllocationPriority`,
`D3DKMTSetContextSchedulingPriority`, `D3DKMTSetDisplayMode`,
`D3DKMTSetDisplayPrivateDriverFormat`, `D3DKMTSetGammaRamp`,
`D3DKMTSetVidPnSourceOwner`, `D3DKMTSignalSynchronizationObject`,
`D3DKMTUnlock`, `D3DKMTWaitForSynchronizationObject`,
`D3DKMTWaitForVerticalBlankEvent`) is a thin thunk down to the Windows
Display Driver Model (WDDM) kernel-mode graphics driver — allocation,
context, device, and synchronization-object lifecycle, adapter queries,
presentation, and display-mode management. These are the lowest-level
entry points a `d3d11.dll` implementation exposes; user-mode D3D11 calls
ultimately funnel through this layer.

## D3D performance markers

`D3DPerformance_BeginEvent`, `D3DPerformance_EndEvent`,
`D3DPerformance_GetStatus`, `D3DPerformance_SetMarker` — the legacy
`D3DPERF_*`-style event/marker API used by graphics debugging and
profiling tools to annotate a captured frame.

## PIX capture

`PIXBeginCapture`, `PIXEndCapture`, `PIXGetCaptureState` — entry points
used by Microsoft's PIX graphics debugger to start and stop a GPU
capture and query capture state.

## Compatibility shims

`ApplyCompatResolutionQuirking`, `CompatString`, `CompatValue`,
`SetAppCompatStringPointer`, `EnableFeatureLevelUpgrade`,
`UpdateHMDEmulationStatus` — application-compatibility shims the real
`d3d11.dll` exposes for the Windows compatibility database (per-title
resolution quirks, compat string/value plumbing, feature-level upgrade
overrides) and HMD (head-mounted display) emulation status reporting.

## See also

- [Export reference overview](/reference/exports/) — the grouped index
  linking every export, including arcdps' own, to its documenting page.
- [Raw export table](/reference/exports/raw-table/) — the flat,
  alphabetically sorted list of all 91 exports.
- [Addon contract](/reference/extension-api/addon-contract/) — how
  arcdps' `d3d11.dll` loading mechanism relates to its own extension
  exports.
