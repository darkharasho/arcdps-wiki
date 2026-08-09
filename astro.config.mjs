import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://arcdps.axi.link', // final subdomain confirmed at Cloudflare setup
  integrations: [
    starlight({
      title: 'arcdps wiki',
      description: 'Community technical reference for the arcdps Guild Wars 2 addon.',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/fonts.css', './src/styles/theme.css'],
      social: {
        github: 'https://github.com/darkharasho/arcdps-wiki',
      },
      sidebar: [
        { label: 'Overview', link: '/' },
        { label: 'Getting Started', link: '/getting-started/' },
        {
          label: 'Guides',
          items: [
            { label: 'Installation, files & settings', link: '/guides/installation-and-files/' },
            { label: 'Writing an extension', link: '/guides/writing-an-extension/' },
            { label: 'Parsing EVTC logs', link: '/guides/parsing-logs/' },
            { label: 'Reading damage', link: '/guides/reading-damage/' },
            { label: 'Boons, buffs & uptime', link: '/guides/boons-and-buffs/' },
            { label: 'Timestamps & duration', link: '/guides/log-timing/' },
            { label: 'Movement & effects', link: '/guides/movement-and-effects/' },
            { label: 'Recording WvW logs', link: '/guides/recording-wvw-logs/' },
            { label: 'WvW maps in logs', link: '/guides/wvw-maps/' },
            { label: 'WvW team colors', link: '/guides/wvw-team-colors/' },
            { label: 'WvW allies & enemies', link: '/guides/wvw-allies-and-enemies/' },
            { label: 'WvW downs & deaths', link: '/guides/wvw-downs-deaths/' },
            { label: 'Ecosystem', link: '/guides/ecosystem/' },
          ],
        },
        {
          label: 'axilog',
          items: [
            { label: 'Overview', link: '/axilog/' },
            { label: 'Calculation methodology', link: '/axilog/methodology/' },
            { label: 'Output schema', link: '/axilog/schema/' },
            { label: 'Quickstart', link: '/axilog/quickstart/' },
          ],
        },
        {
          label: 'Extension API',
          items: [
            { label: 'Addon contract', link: '/reference/extension-api/addon-contract/' },
            { label: 'Combat callback', link: '/reference/extension-api/combat-callback/' },
            { label: 'arcdps exports', link: '/reference/extension-api/arcdps-exports/' },
            { label: 'Extension registry', link: '/reference/extension-api/extension-registry/' },
          ],
        },
        {
          label: 'Data Structures',
          items: [
            { label: 'cbtevent', link: '/reference/data-structures/cbtevent/' },
            { label: 'agent (ag)', link: '/reference/data-structures/agent/' },
          ],
        },
        {
          label: 'Enums',
          items: [
            { label: 'Enum reference', link: '/reference/enums/' },
            { label: 'Statechange payloads', link: '/reference/enums/statechange-payloads/' },
          ],
        },
        {
          label: 'Exports',
          items: [
            { label: 'Export reference', link: '/reference/exports/' },
            { label: 'DirectX proxy', link: '/reference/exports/directx-proxy/' },
            { label: 'Raw export table', link: '/reference/exports/raw-table/' },
          ],
        },
        {
          label: 'EVTC logs',
          items: [
            { label: 'EVTC log format', link: '/reference/evtc-format/' },
            { label: 'Encounter IDs', link: '/reference/encounter-ids/' },
          ],
        },
        { label: 'Unofficial Extras', link: '/reference/unofficial-extras/' },
        { label: 'API revision history', link: '/reference/api-history/' },
        { label: 'Contributing', link: '/contributing/' },
      ],
    }),
  ],
});
