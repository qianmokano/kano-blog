import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getBlogPosts } from '@/lib/content';
import { siteConfig } from '@/lib/site';

export async function GET(context: APIContext) {
	const posts = await getBlogPosts();
	return rss({
		title: `${siteConfig.name} — ${siteConfig.tagline}`,
		description: siteConfig.description,
		site: context.site ?? siteConfig.url,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.publishedAt,
			link: `/blog/${post.id}/`,
			categories: post.data.tags,
		})),
		customData: `<language>${siteConfig.locale}</language>`,
	});
}
