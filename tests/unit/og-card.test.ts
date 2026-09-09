import { describe, expect, it } from 'vitest';
import { renderOgCard, wrapTitle } from '../../src/lib/og-card';

describe('sharing cards', () => {
	it('wraps Chinese and long unbroken titles without exceeding the card', () => {
		expect(wrapTitle('拿到新的 VPS 后，你应该先做什么？').length).toBeGreaterThan(1);
		const long = wrapTitle('中'.repeat(100));
		expect(long).toHaveLength(3);
		expect(long[2]).toMatch(/…$/);
		expect(wrapTitle('A'.repeat(200))).toHaveLength(3);
	});

	it('renders a deterministic PNG without system fonts, including XML-sensitive text', () => {
		const data = { title: '中文 <script> & "标题"', label: '文章', detail: 'Astro · 测试' };
		const png = renderOgCard(data);
		expect(png.subarray(1, 4).toString()).toBe('PNG');
		expect(png.readUInt32BE(16)).toBe(1200);
		expect(png.readUInt32BE(20)).toBe(630);
		expect(renderOgCard(data)).toEqual(png);
	});
});
