// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
	site: 'https://blog.kanojyo.de',
	trailingSlash: 'always',
	integrations: [mdx(), sitemap({ filter: (page) => !page.endsWith('/search/') })],
	markdown: {
		shikiConfig: {
			themes: {
				light: 'github-light',
				dark: 'github-dark',
			},
			wrap: true,
		},
	},
});
