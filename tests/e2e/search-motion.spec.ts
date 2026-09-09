import { expect, test, type Page } from '@playwright/test';

const searchRoot = (page: Page) => page.locator('[data-search-root]');

async function mockSearch(page: Page) {
	await page.route('**/pagefind/pagefind.js*', (route) =>
		route.fulfill({
			contentType: 'text/javascript',
			body: `
				const failedMore = new Set();
				export async function search(query) {
					if (query === 'slow') await new Promise(resolve => setTimeout(resolve, 500));
					else await new Promise(resolve => setTimeout(resolve, 20));
					return { results: Array.from({ length: 13 }, (_, i) => ({
						data: async () => {
							if (i === 12 && query === 'more')
								await new Promise(resolve => setTimeout(resolve, 250));
							if (i === 12 && query === 'retry' && !failedMore.has(query)) {
								failedMore.add(query);
								throw new Error('fragment offline');
							}
							if (i === 12 && query === 'retry')
								await new Promise(resolve => setTimeout(resolve, 250));
							return {
								url: '/blog/hello-kano/?result=' + i,
								meta: { title: query + ' result ' + (i + 1), type: '文章' },
								excerpt: 'excerpt'
							};
						}
					})) };
				}
			`,
		}),
	);
}

test('loading status waits for slow work and is cleared by a newer query', async ({ page }) => {
	await mockSearch(page);
	await page.goto('/search/');
	const root = searchRoot(page);
	const status = root.locator('[data-pagefind-status]');
	await status.evaluate((node) => {
		const recorded: string[] = [];
		(window as typeof window & { searchStatuses: string[] }).searchStatuses = recorded;
		new MutationObserver(() => recorded.push(node.textContent || '')).observe(node, {
			childList: true,
		});
	});
	await root.getByRole('searchbox').fill('fast');
	await expect(
		root.locator('.search-result strong').filter({ hasText: /^fast result 1$/ }),
	).toBeVisible();
	await expect(status).toHaveText('已显示 12 / 共 13 条结果');
	expect(
		await page.evaluate(() =>
			(window as typeof window & { searchStatuses: string[] }).searchStatuses.filter((text) =>
				text.startsWith('正在'),
			),
		),
	).toEqual([]);

	await root.getByRole('searchbox').fill('slow');
	await expect(status).toHaveText('正在搜索…', { timeout: 800 });
	await root.getByRole('searchbox').fill('fast');
	await expect(status).toBeEmpty();
	await expect(
		root.locator('.search-result strong').filter({ hasText: /^fast result 1$/ }),
	).toBeVisible();
	await expect(
		root.locator('.search-result strong').filter({ hasText: /^slow result 1$/ }),
	).toHaveCount(0);
});

test('load-more and retry expose progress and fade only appended results', async ({ page }) => {
	await mockSearch(page);
	await page.goto('/search/?q=more');
	const root = searchRoot(page);
	await expect(root.locator('.search-result')).toHaveCount(12);
	await page.evaluate(() => {
		const original = Element.prototype.animate;
		(window as typeof window & { searchAnimations: number[] }).searchAnimations = [];
		Element.prototype.animate = function (frames, options) {
			if (this.classList.contains('search-result')) {
				const duration = typeof options === 'number' ? options : options?.duration;
				(window as typeof window & { searchAnimations: number[] }).searchAnimations.push(
					Number(duration),
				);
			}
			return original.call(this, frames, options);
		};
	});

	await root.getByRole('button', { name: '加载更多' }).click();
	await expect(root.getByRole('button', { name: '正在加载…' })).toBeDisabled();
	await expect(root.locator('.search-result')).toHaveCount(12);
	await expect(root.locator('.search-result')).toHaveCount(13);
	expect(
		await page.evaluate(
			() => (window as typeof window & { searchAnimations: number[] }).searchAnimations,
		),
	).toEqual([160]);

	await page.goto('/search/?q=retry');
	await expect(root.locator('.search-result')).toHaveCount(12);
	await root.getByRole('button', { name: '加载更多' }).click();
	const retry = root.getByRole('button', { name: '重试搜索' });
	await expect(retry).toBeVisible();
	await retry.click();
	await expect(root.getByRole('button', { name: '正在重试…' })).toBeVisible();
	await expect(root.getByRole('button', { name: '正在重试…' })).toBeDisabled();
	await expect(root.locator('.search-result')).toHaveCount(12);
	await expect(root.locator('.search-result')).toHaveCount(13);
});

test('reduced motion skips the appended-result fade', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await mockSearch(page);
	await page.goto('/search/?q=more');
	const root = searchRoot(page);
	await expect(root.locator('.search-result')).toHaveCount(12);
	await page.evaluate(() => {
		(window as typeof window & { searchAnimations: number }).searchAnimations = 0;
		Element.prototype.animate = function () {
			(window as typeof window & { searchAnimations: number }).searchAnimations += 1;
			return {} as Animation;
		};
	});
	await root.getByRole('button', { name: '加载更多' }).click();
	await expect(root.locator('.search-result')).toHaveCount(13);
	expect(
		await page.evaluate(
			() => (window as typeof window & { searchAnimations: number }).searchAnimations,
		),
	).toBe(0);
});
