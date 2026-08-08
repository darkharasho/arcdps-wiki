---
title: Export reference
description: Grouped overview of all 91 symbols in arcdps' DLL export table, and which page documents each group.
source: dll-exports
---

arcdps ships as a single DLL (`d3d11.dll`) with 91 exported symbols,
captured in the export table snapshot at `data/arcdps-exports.json`. Those
91 symbols fall into two very different categories:

- **arcdps' own API surface** — the extension load contract, the `eN`
  utility functions, the addon-contract exports, and the extension
  registry. These are documented individually under
  [Extension API](/reference/extension-api/addon-contract/).
- **DirectX/DXGI proxy forwards** — standard Windows/DirectX entry
  points that arcdps' `d3d11.dll` forwards to the real system DLL so the
  game loads it as a drop-in proxy. These carry no arcdps-specific
  behavior and are documented as a group on the [DirectX proxy
  exports](/reference/exports/directx-proxy/) page.

Every one of the 91 symbols in the snapshot is covered by exactly one of
the pages below — an automated test (`tests/export-drift.test.ts`) checks
this on every change, so this table can't silently drift out of sync with
the DLL's real export table.

## Groups

| Group | Symbols | Documented on |
| --- | --- | --- |
| Extension load contract / numbered utilities (`eN`) | `e0`, `e3`, `e4`, `e5`, `e6`, `e7`, `e8`, `e9`, `e10` | [arcdps exports (e0-e10)](/reference/extension-api/arcdps-exports/) |
| Addon contract (`gw2addon_*`, `arcdps_*_export`) | `GetAddonDef`, `gw2addon_get_description`, `gw2addon_load`, `gw2addon_unload`, `arcdps_identifier_export`, `arcdps_imguiversion_export` | [Addon contract](/reference/extension-api/addon-contract/) |
| Extension registry | `addextension2`, `removeextension2`, `listextension`, `c_closeandupdate`, `c_exceptionerrormsg` | [Extension registry](/reference/extension-api/extension-registry/) |
| DXGI factory creation | `CreateDXGIFactory`, `CreateDXGIFactory1`, `CreateDXGIFactory2` | [DirectX proxy exports](/reference/exports/directx-proxy/) |
| D3D11 device creation | `D3D11CreateDevice`, `D3D11CreateDeviceAndSwapChain`, `D3D11CreateDeviceForD3D12`, `D3D11On12CreateDevice` | [DirectX proxy exports](/reference/exports/directx-proxy/) |
| D3D11 core / layered device internals | `D3D11CoreCreateDevice`, `D3D11CoreCreateLayeredDevice`, `D3D11CoreGetLayeredDeviceSize`, `D3D11CoreRegisterLayers` | [DirectX proxy exports](/reference/exports/directx-proxy/) |
| Direct3D 11 interop (WinRT) | `CreateDirect3D11DeviceFromDXGIDevice`, `CreateDirect3D11SurfaceFromDXGISurface` | [DirectX proxy exports](/reference/exports/directx-proxy/) |
| DXGI/D3D10 legacy layered-device internals | `DXGID3D10CreateDevice`, `DXGID3D10CreateLayeredDevice`, `DXGID3D10GetLayeredDeviceSize`, `DXGID3D10RegisterLayers`, `OpenAdapter10`, `OpenAdapter10_2` | [DirectX proxy exports](/reference/exports/directx-proxy/) |
| DXGI diagnostics and adapter management | `DXGIDeclareAdapterRemovalSupport`, `DXGIDisableVBlankVirtualization`, `DXGIDumpJournal`, `DXGIGetDebugInterface1`, `DXGIReportAdapterConfiguration` | [DirectX proxy exports](/reference/exports/directx-proxy/) |
| D3DKMT kernel-mode thunks | All 32 `D3DKMT*` exports | [DirectX proxy exports](/reference/exports/directx-proxy/) |
| D3D performance markers | `D3DPerformance_BeginEvent`, `D3DPerformance_EndEvent`, `D3DPerformance_GetStatus`, `D3DPerformance_SetMarker` | [DirectX proxy exports](/reference/exports/directx-proxy/) |
| PIX capture | `PIXBeginCapture`, `PIXEndCapture`, `PIXGetCaptureState` | [DirectX proxy exports](/reference/exports/directx-proxy/) |
| Compatibility shims | `ApplyCompatResolutionQuirking`, `CompatString`, `CompatValue`, `SetAppCompatStringPointer`, `EnableFeatureLevelUpgrade`, `UpdateHMDEmulationStatus` | [DirectX proxy exports](/reference/exports/directx-proxy/) |

## See also

- [Raw export table](/reference/exports/raw-table/) — the flat,
  alphabetically sorted list of all 91 exports, with no grouping.
- [DirectX proxy exports](/reference/exports/directx-proxy/) — why
  arcdps ships as `d3d11.dll` and forwards the DirectX/DXGI/D3DKMT/PIX/
  compat group.
