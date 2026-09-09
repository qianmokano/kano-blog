import type { APIRoute } from 'astro';
import { getBlogPosts, getProjects, formatDate } from '@/lib/content';
import { renderOgCard, type OgCard } from '@/lib/og-card';
import { siteConfig } from '@/lib/site';

export async function getStaticPaths() {
	const [posts, projects] = await Promise.all([getBlogPosts(), getProjects()]);
	return [
		{
			params: { slug: 'default' },
			props: {
				title: siteConfig.brandName,
				label: '文章 · 项目 · 笔记',
				detail: siteConfig.tagline,
			},
		},
		...posts
			.filter((post) => !post.data.cover)
			.map((post) => ({
				params: { slug: `blog/${post.id}` },
				props: {
					title: post.data.title,
					label: `文章 / ${formatDate(post.data.publishedAt)}`,
					detail: post.data.tags.join(' · '),
				},
			})),
		...projects
			.filter((project) => !project.data.cover)
			.map((project) => ({
				params: { slug: `projects/${project.id}` },
				props: {
					title: project.data.title,
					label: `项目 / ${project.data.status}`,
					detail: project.data.tech.join(' · '),
				},
			})),
	];
}

export const GET: APIRoute = ({ props }) => {
	return new Response(new Uint8Array(renderOgCard(props as OgCard)), {
		headers: { 'Content-Type': 'image/png' },
	});
};
