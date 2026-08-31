import type { APIRoute } from 'astro';
import { siteConfig } from '@/lib/site';

export const GET: APIRoute = () =>
	new Response(`User-agent: *\nAllow: /\n\nSitemap: ${siteConfig.url}/sitemap-index.xml\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
