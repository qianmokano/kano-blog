import { describe, expect, it } from 'vitest';
import {
	absoluteSiteUrl,
	authorSchema,
	createBreadcrumbSchema,
	createProfilePageSchema,
} from '../../src/lib/structured-data';

describe('structured data utilities', () => {
	it('builds absolute site URLs', () => {
		expect(absoluteSiteUrl('/blog/example/')).toBe('https://blog.kanojyo.de/blog/example/');
	});

	it('identifies the author through the local profile and external identity', () => {
		expect(authorSchema).toEqual({
			'@type': 'Person',
			'@id': 'https://blog.kanojyo.de/about/#person',
			name: 'Kano',
			alternateName: 'qianmokano',
			url: 'https://blog.kanojyo.de/about/',
			sameAs: ['https://github.com/qianmokano'],
		});
	});

	it('creates ordered breadcrumb list items with canonical URLs', () => {
		expect(
			createBreadcrumbSchema([
				{ name: '首页', path: '/' },
				{ name: '文章', path: '/blog/' },
			]),
		).toMatchObject({
			'@type': 'BreadcrumbList',
			itemListElement: [
				{
					'@type': 'ListItem',
					position: 1,
					name: '首页',
					item: 'https://blog.kanojyo.de/',
				},
				{
					'@type': 'ListItem',
					position: 2,
					name: '文章',
					item: 'https://blog.kanojyo.de/blog/',
				},
			],
		});
	});

	it('creates a profile page around the shared person entity', () => {
		const dateModified = new Date('2026-09-01T12:00:00+08:00');
		expect(createProfilePageSchema({ description: '关于 Kano。', dateModified })).toEqual({
			'@context': 'https://schema.org',
			'@type': 'ProfilePage',
			url: 'https://blog.kanojyo.de/about/',
			description: '关于 Kano。',
			dateModified: dateModified.toISOString(),
			mainEntity: authorSchema,
		});
	});
});
