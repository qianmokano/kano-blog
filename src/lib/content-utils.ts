import readingTime from 'reading-time';

type DraftEntry = { data: { draft?: boolean } };
type DatedEntry = { data: { publishedAt: Date } };
type TagEntry = { data: { tags: string[] } };

export function filterDrafts<T extends DraftEntry>(
	entries: T[],
	includeDrafts = import.meta.env.DEV,
) {
	return entries.filter((entry) => includeDrafts || !entry.data.draft);
}

export function sortByPublishedDate<T extends DatedEntry>(entries: T[]) {
	return [...entries].sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}

export function paginate<T>(entries: T[], page: number, pageSize: number) {
	const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
	const currentPage = Math.min(Math.max(1, page), totalPages);
	const start = (currentPage - 1) * pageSize;

	return {
		items: entries.slice(start, start + pageSize),
		currentPage,
		totalPages,
	};
}

export function normalizeTagSlug(tag: string) {
	return tag
		.trim()
		.toLocaleLowerCase('zh-CN')
		.replace(/[\s_]+/g, '-')
		.replace(/[^\p{Letter}\p{Number}-]+/gu, '')
		.replace(/-{2,}/g, '-')
		.replace(/^-|-$/g, '');
}

export function groupPostsByTag<T extends TagEntry>(posts: T[]) {
	const groups = new Map<string, { name: string; posts: T[] }>();

	for (const post of posts) {
		for (const name of new Set(post.data.tags)) {
			const slug = normalizeTagSlug(name);
			if (!slug) throw new Error(`标签“${name}”无法生成有效链接。`);

			const existing = groups.get(slug);
			if (existing && existing.name !== name) {
				throw new Error(`标签“${existing.name}”与“${name}”生成了相同链接“${slug}”。`);
			}

			if (existing) existing.posts.push(post);
			else groups.set(slug, { name, posts: [post] });
		}
	}

	return groups;
}

export function getReadingTime(body: string) {
	return Math.max(1, Math.ceil(readingTime(body).minutes));
}

export function formatDate(date: Date) {
	return new Intl.DateTimeFormat('zh-CN', {
		timeZone: 'Asia/Shanghai',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(date);
}

export function getCalendarYear(date: Date) {
	return Number(
		new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(date),
	);
}
