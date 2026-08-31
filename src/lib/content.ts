import { getCollection } from 'astro:content';
import { filterDrafts, sortByPublishedDate } from '@/lib/content-utils';

export * from '@/lib/content-utils';

export async function getBlogPosts() {
	return sortByPublishedDate(filterDrafts(await getCollection('blog')));
}

export async function getNotes() {
	return sortByPublishedDate(filterDrafts(await getCollection('notes')));
}

export async function getProjects() {
	return filterDrafts(await getCollection('projects')).sort(
		(a, b) => Number(b.data.featured) - Number(a.data.featured) || a.data.order - b.data.order,
	);
}
