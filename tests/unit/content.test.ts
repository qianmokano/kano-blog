import { describe, expect, it } from 'vitest';
import {
	filterDrafts,
	getCalendarYear,
	formatDate,
	getReadingTime,
	groupPostsByTag,
	normalizeTagSlug,
	paginate,
	sortByPublishedDate,
} from '../../src/lib/content-utils';

describe('content utilities', () => {
	it('uses the Shanghai calendar at year boundaries', () => {
		expect(getCalendarYear(new Date('2025-12-31T15:59:59Z'))).toBe(2025);
		expect(getCalendarYear(new Date('2025-12-31T16:00:00Z'))).toBe(2026);
	});
	it('counts each post once when tags repeat', () => {
		const post = { data: { tags: ['Astro', 'Astro'] } };
		expect(groupPostsByTag([post]).get('astro')?.posts).toEqual([post]);
	});
	it('filters drafts unless explicitly included', () => {
		const entries = [{ data: { draft: false } }, { data: { draft: true } }];
		expect(filterDrafts(entries, false)).toHaveLength(1);
		expect(filterDrafts(entries, true)).toHaveLength(2);
	});

	it('sorts newest entries first without mutating input', () => {
		const older = { data: { publishedAt: new Date('2025-01-01') } };
		const newer = { data: { publishedAt: new Date('2026-01-01') } };
		const input = [older, newer];
		expect(sortByPublishedDate(input)).toEqual([newer, older]);
		expect(input).toEqual([older, newer]);
	});

	it('paginates and clamps invalid page numbers', () => {
		expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual({
			items: [3, 4],
			currentPage: 2,
			totalPages: 3,
		});
		expect(paginate([], 99, 10)).toEqual({ items: [], currentPage: 1, totalPages: 1 });
		expect(paginate([1, 2], -1, 1).currentPage).toBe(1);
	});

	it('normalizes Latin and Chinese tag slugs', () => {
		expect(normalizeTagSlug('  Type Script_API  ')).toBe('type-script-api');
		expect(normalizeTagSlug('个人博客')).toBe('个人博客');
		expect(normalizeTagSlug('---')).toBe('');
	});

	it('groups posts by tag and rejects slug collisions', () => {
		const post = { id: 'one', data: { tags: ['Astro', '个人博客'] } };
		const groups = groupPostsByTag([post]);
		expect(groups.get('astro')?.posts).toEqual([post]);
		expect(groups.get('个人博客')?.name).toBe('个人博客');

		const collision = { id: 'two', data: { tags: ['astro'] } };
		expect(() => groupPostsByTag([post, collision])).toThrow('生成了相同链接');
	});

	it('rejects tags without a valid slug', () => {
		const post = { id: 'one', data: { tags: ['---'] } };
		expect(() => groupPostsByTag([post])).toThrow('无法生成有效链接');
	});

	it('returns readable time and Shanghai-formatted dates', () => {
		expect(getReadingTime('简短内容')).toBe(1);
		expect(getReadingTime('word '.repeat(500))).toBeGreaterThan(1);
		expect(formatDate(new Date('2026-08-30T16:30:00Z'))).toBe('2026/08/31');
	});
});
