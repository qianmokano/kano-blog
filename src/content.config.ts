import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string().min(1),
			description: z.string().min(1),
			publishedAt: z.coerce.date(),
			updatedAt: z.coerce.date().optional(),
			tags: z.array(z.string().min(1)).default([]),
			cover: image().optional(),
			coverAlt: z.string().trim().min(1).optional(),
			featured: z.boolean().default(false),
			draft: z.boolean().default(false),
			comments: z.boolean().default(true),
		}),
});

const notes = defineCollection({
	loader: glob({ base: './src/content/notes', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string().min(1),
		publishedAt: z.coerce.date(),
		tags: z.array(z.string().min(1)).default([]),
		draft: z.boolean().default(false),
	}),
});

const projects = defineCollection({
	loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string().min(1),
			description: z.string().min(1),
			status: z.enum(['进行中', '已完成', '已归档']),
			period: z.string().min(1),
			tech: z.array(z.string().min(1)).default([]),
			repositoryUrl: z.url().optional(),
			demoUrl: z.url().optional(),
			cover: image().optional(),
			coverAlt: z.string().trim().min(1).optional(),
			featured: z.boolean().default(false),
			order: z.number().int().default(0),
			draft: z.boolean().default(false),
		}),
});

const pages = defineCollection({
	loader: glob({ base: './src/content/pages', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string().min(1),
		description: z.string().min(1),
		updatedAt: z.coerce.date().optional(),
	}),
});

const friends = defineCollection({
	loader: file('./src/content/friends.json'),
	schema: z.object({
		name: z.string().min(1),
		description: z.string().min(1),
		url: z.url(),
		avatar: z.url().optional(),
		hidden: z.boolean().default(false),
	}),
});

export const collections = { blog, notes, projects, pages, friends };
