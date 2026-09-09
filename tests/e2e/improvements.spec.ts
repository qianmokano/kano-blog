import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const searchRoot = (page: Page) => page.locator('[data-search-root]');

async function mockSearch(page: Page, total = 25, failMoreOnce = false) {
	await page.route('**/pagefind/pagefind.js*', (route) =>
		route.fulfill({
			contentType: 'text/javascript',
			body: `
				let failMore = ${failMoreOnce};
				export async function options() {}
				export async function search(query) {
					if (query === 'slow') await new Promise(resolve => setTimeout(resolve, 500));
					return { results: Array.from({ length: query === 'empty' ? 0 : ${total} }, (_, i) => ({
						data: async () => {
							if (i === 12 && failMore) { failMore = false; throw new Error('fragment offline'); }
							return { url: '/blog/hello-kano/?result=' + i,
								meta: { title: query + ' 结果 ' + (i + 1), type: '文章' },
								excerpt: '包含 <mark>' + query + '</mark> 的内容摘要' };
						}
					})) };
				}`,
		}),
	);
}

test('home keeps its CTA readable during entry and finishes the greeting', async ({ page }) => {
	await page.goto('/');
	const actions = page.locator('.hero-actions');
	await expect(actions).toHaveCSS('opacity', '1');
	await expect(page.locator('.hero-copy > p:not(.eyebrow)')).toHaveCSS('opacity', '1');
	await expect(page.locator('.hero-copy')).not.toHaveClass(/is-entering/);
	await expect(page.locator('[data-typewriter]')).toHaveText('Hi!👋\n这里是kano！');
	await page.reload();
	await expect(page.locator('.hero-copy')).not.toHaveClass(/is-entering/);

	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/about/');
	await page.evaluate(() => sessionStorage.removeItem('kano-home-visited'));
	await page.goto('/');
	await expect(page.locator('[data-typewriter]')).toHaveText('Hi!👋\n这里是kano！');
	await expect(page.locator('.hero-copy')).not.toHaveClass(/is-entering/);
	const scan = await new AxeBuilder({ page }).analyze();
	expect(scan.violations).toEqual([]);
});

test('failed Pagefind import can recover without refreshing', async ({ page }) => {
	let imports = 0;
	await page.route('**/pagefind/pagefind.js*', async (route) => {
		imports += 1;
		if (imports === 1) await route.abort('failed');
		else await route.continue();
	});
	await page.goto('/search/');
	await searchRoot(page).getByRole('searchbox').fill('Astro');
	await expect(searchRoot(page).getByRole('button', { name: '重试搜索' })).toBeVisible();
	await expect(searchRoot(page).getByRole('link', { name: '刷新搜索页' })).toHaveAttribute(
		'href',
		'/search/?q=Astro',
	);
	await searchRoot(page).getByRole('button', { name: '重试搜索' }).click();
	await expect(searchRoot(page).getByRole('link', { name: /你好，这里是 Kano/ })).toBeVisible();
	expect(imports).toBe(2);
	await expect(searchRoot(page).getByRole('button', { name: '重试搜索' })).toBeHidden();
});

test('all search results remain reachable and back restores the loaded list', async ({ page }) => {
	await mockSearch(page);
	await page.goto('/search/?q=Astro');
	const root = searchRoot(page);
	await expect(root.locator('.search-result')).toHaveCount(12);
	await expect(root.getByRole('status')).toHaveText('已显示 12 / 共 25 条结果');
	await root.getByRole('button', { name: '加载更多' }).click();
	await expect(root.locator('.search-result')).toHaveCount(24);
	await root.locator('.search-result').nth(13).focus();
	const before = await page.evaluate(() => window.scrollY);
	await root.locator('.search-result').nth(13).click();
	await expect(page).toHaveURL(/hello-kano/);
	await page.goBack();
	await expect(root.getByRole('searchbox')).toHaveValue('Astro');
	await expect(root.locator('.search-result')).toHaveCount(24);
	await expect
		.poll(async () => Math.abs((await page.evaluate(() => scrollY)) - before))
		.toBeLessThan(80);
	await root.getByRole('button', { name: '加载更多' }).click();
	await expect(root.locator('.search-result')).toHaveCount(25);
	await expect(root.getByRole('button', { name: '加载更多' })).toBeHidden();
	await page.reload();
	await expect(root.locator('.search-result')).toHaveCount(25);
});

test('a failed next batch preserves existing results and can be retried', async ({ page }) => {
	await mockSearch(page, 13, true);
	await page.goto('/search/?q=Astro');
	const root = searchRoot(page);
	await expect(root.locator('.search-result')).toHaveCount(12);
	await root.getByRole('button', { name: '加载更多' }).click();
	await expect(root.getByRole('button', { name: '重试搜索' })).toBeVisible();
	await expect(root.locator('.search-result')).toHaveCount(12);
	await root.getByRole('button', { name: '重试搜索' }).click();
	await expect(root.locator('.search-result')).toHaveCount(13);
	await expect(root.getByRole('status')).toHaveText('已显示 13 / 共 13 条结果');
});

test('new queries replace stale results, support empty states and keep the URL', async ({
	page,
}) => {
	await mockSearch(page, 1);
	await page.goto('/search/?q=slow');
	const root = searchRoot(page);
	await root.getByRole('searchbox').fill('中文');
	await expect(root.getByRole('link', { name: /中文 结果 1/ })).toBeVisible();
	await expect(root.getByRole('status')).toHaveText('已显示 1 / 共 1 条结果');
	await expect(page).toHaveURL(/q=%E4%B8%AD%E6%96%87/);
	await root.getByRole('searchbox').fill('empty');
	await expect(root.getByRole('status')).toHaveText('没有找到相关内容');
	await expect(root.locator('.search-result')).toHaveCount(0);
	await root.getByRole('searchbox').fill('');
	await expect(root.locator('[data-pagefind-status]')).toBeEmpty();
	await expect(page).toHaveURL('/search/');
});

test('search dialog preserves its query when opening full search', async ({ page }) => {
	await mockSearch(page, 1);
	await page.goto('/');
	const trigger = page.getByRole('button', { name: '打开搜索' });
	await trigger.click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('searchbox').fill('中文');
	await expect(dialog.getByRole('link', { name: /中文 结果 1/ })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(trigger).toBeFocused();
	await trigger.click();
	await dialog.getByRole('link', { name: /前往完整搜索页/ }).click();
	await expect(searchRoot(page).getByRole('searchbox')).toHaveValue('中文');
	await expect(searchRoot(page).getByRole('link', { name: /中文 结果 1/ })).toBeVisible();
});

test('mobile TOC is collapsed and stays available while reading', async ({ page }, testInfo) => {
	test.skip(!testInfo.project.name.includes('mobile'), 'Mobile disclosure behavior.');
	await page.goto('/blog/vps-first-steps-security/');
	const toc = page.locator('.mobile-toc');
	await expect(toc).not.toHaveAttribute('open');
	expect(
		await page
			.locator('.article-grid > .prose')
			.evaluate((node) => node.getBoundingClientRect().top),
	).toBeLessThan(page.viewportSize()!.height);
	await toc.locator('summary').click();
	await toc.getByRole('link', { name: '11. 收尾检查', exact: true }).click();
	await expect(toc).not.toHaveAttribute('open');
	await expect(page.getByRole('heading', { name: '11. 收尾检查', exact: true })).toBeInViewport();
	await expect(toc.locator('summary')).toBeInViewport();
	await toc.locator('summary').click();
	await expect(toc.getByRole('navigation')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(toc).not.toHaveAttribute('open');
	await expect(toc.locator('summary')).toBeFocused();
});

test('desktop TOC never scrolls horizontally with active or long headings', async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name !== 'chromium', 'Desktop sidebar layout.');
	await page.goto('/blog/vps-first-steps-security/');
	const toc = page.locator('.article-toc');
	for (const width of [800, 1024, 1280, 1600]) {
		await page.setViewportSize({ width, height: 720 });
		await expect(toc.locator('[aria-current="location"]')).toHaveCount(1);
		await expect(toc.locator('[aria-current="location"]')).toHaveCSS(
			'transform',
			'matrix(1, 0, 0, 1, 2, 0)',
		);
		await expect.poll(() => toc.evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			),
		).toBe(0);
	}
	await page.setViewportSize({ width: 800, height: 720 });
	await toc.getByRole('link', { name: '7. 设置时区和自动安全更新', exact: true }).click();
	await expect.poll(() => toc.evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
	await toc
		.locator('a')
		.first()
		.evaluate((node) => {
			node.textContent = 'LongUnbrokenHeading'.repeat(10);
		});
	await expect.poll(() => toc.evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
});

test('articles and projects expose distinct PNG sharing images', async ({ page, request }) => {
	const urls: string[] = [];
	for (const path of [
		'/blog/hello-kano/',
		'/blog/vps-first-steps-security/',
		'/projects/kano-blog/',
	]) {
		await page.goto(path);
		const url = await page.locator('meta[property="og:image"]').getAttribute('content');
		expect(url).toBeTruthy();
		urls.push(url!);
		await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
			'content',
			'1200',
		);
		await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute(
			'content',
			'630',
		);
		await expect(page.locator('meta[property="og:image:alt"]')).not.toHaveAttribute('content', '');
		const response = await request.get(new URL(url!).pathname);
		expect(response.ok()).toBeTruthy();
		const png = await response.body();
		expect(png.subarray(1, 4).toString()).toBe('PNG');
		expect(png.readUInt32BE(16)).toBe(1200);
		expect(png.readUInt32BE(20)).toBe(630);
	}
	expect(new Set(urls).size).toBe(3);
});

for (const extension of ['pf_fragment', 'pf_index']) {
	test(`real Pagefind ${extension} failure recovers without refreshing`, async ({ page }) => {
		let failedUrl = '';
		let attempts = 0;
		await page.route(`**/*.${extension}`, async (route) => {
			const url = route.request().url();
			if (!failedUrl) failedUrl = url;
			if (url === failedUrl) {
				attempts += 1;
				if (attempts === 1) {
					await route.abort('failed');
					return;
				}
			}
			await route.continue();
		});
		await page.goto('/search/?q=Astro');
		const root = searchRoot(page);
		await expect(root.getByRole('button', { name: '重试搜索' })).toBeVisible();
		await root.getByRole('button', { name: '重试搜索' }).click();
		await expect(root.getByRole('link', { name: /你好，这里是 Kano/ })).toBeVisible();
		expect(attempts).toBeGreaterThan(1);
		await expect(root.getByRole('button', { name: '重试搜索' })).toBeHidden();
	});
}
