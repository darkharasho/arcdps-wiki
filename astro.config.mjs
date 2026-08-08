import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://arcdps.axi.link', // final subdomain confirmed at Cloudflare setup
  integrations: [
    starlight({
      title: 'arcdps wiki',
      description: 'Community technical reference for the arcdps Guild Wars 2 addon.',
      customCss: ['./src/styles/fonts.css', './src/styles/theme.css'],
      social: {
        github: 'https://github.com/darkharasho/arcdps-wiki',
      },
      sidebar: [
        { label: 'Overview', link: '/' },
        { label: 'Getting Started', link: '/getting-started/' },
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
        { label: 'Enums', link: '/reference/enums/' },
        {
          label: 'Exports',
          items: [
            { label: 'Export reference', link: '/reference/exports/' },
            { label: 'DirectX proxy', link: '/reference/exports/directx-proxy/' },
            { label: 'Raw export table', link: '/reference/exports/raw-table/' },
          ],
        },
        { label: 'EVTC log format', link: '/reference/evtc-format/' },
        { label: 'Contributing', link: '/contributing/' },
      ],
    }),
  ],
});
