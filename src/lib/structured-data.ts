import { siteConfig } from './site';

interface BreadcrumbItem {
	name: string;
	path: string;
}

interface ProfilePageOptions {
	description?: string;
	dateModified?: Date;
}

export function absoluteSiteUrl(path: string) {
	return new URL(path, siteConfig.url).toString();
}

export const authorSchema = {
	'@type': 'Person',
	'@id': absoluteSiteUrl('/about/#person'),
	name: siteConfig.name,
	alternateName: siteConfig.author,
	url: absoluteSiteUrl('/about/'),
	sameAs: [siteConfig.socials.github],
};

export function createBreadcrumbSchema(items: BreadcrumbItem[]) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			item: absoluteSiteUrl(item.path),
		})),
	};
}

export function createProfilePageSchema({ description, dateModified }: ProfilePageOptions = {}) {
	return {
		'@context': 'https://schema.org',
		'@type': 'ProfilePage',
		url: absoluteSiteUrl('/about/'),
		...(description && { description }),
		...(dateModified && { dateModified: dateModified.toISOString() }),
		mainEntity: authorSchema,
	};
}
