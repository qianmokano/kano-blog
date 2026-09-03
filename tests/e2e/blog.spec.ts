import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function readStructuredData(page: Page) {
	const content = await page.locator('script[type="application/ld+json"]').textContent();
	const data: Record<string, unknown> | Record<string, unknown>[] = JSON.parse(content ?? '{}');
	return Array.isArray(data) ? data : [data];
}

test('home exposes the main content paths', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/Kano/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
		/Hi!👋\s+这里是kano！/,
	);
	await expect(page.getByRole('link', { name: '开始阅读' })).toHaveAttribute('href', '/blog/');
	await expect(page.getByRole('heading', { name: '精选文章' })).toBeVisible();
});

test('article metadata and navigation render', async ({ page }) => {
	await page.goto('/blog/hello-kano/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('你好，这里是 Kano');
	await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		'https://blog.kanojyo.de/blog/hello-kano/',
	);
	await expect(page.getByText('分钟阅读')).toBeVisible();
});

test('structured data connects profiles and page breadcrumbs', async ({ page }) => {
	await page.goto('/blog/hello-kano/');
	const articleData = await readStructuredData(page);
	expect(articleData.map((item) => item['@type'])).toEqual(['BlogPosting', 'BreadcrumbList']);
	expect(articleData[0]).toMatchObject({
		author: {
			'@type': 'Person',
			url: 'https://blog.kanojyo.de/about/',
			sameAs: ['https://github.com/qianmokano'],
		},
	});

	await page.goto('/projects/kano-blog/');
	const projectData = await readStructuredData(page);
	expect(projectData.map((item) => item['@type'])).toEqual([
		'SoftwareSourceCode',
		'BreadcrumbList',
	]);

	await page.goto('/tags/astro/');
	const tagData = await readStructuredData(page);
	expect(tagData.map((item) => item['@type'])).toEqual(['BreadcrumbList']);

	await page.goto('/about/');
	const profileData = await readStructuredData(page);
	expect(profileData[0]).toMatchObject({
		'@type': 'ProfilePage',
		mainEntity: {
			'@type': 'Person',
			name: 'Kano',
			alternateName: 'qianmokano',
		},
	});
});

test('theme choice persists across navigation', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: /当前跟随系统/ }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.goto('/about/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('production search returns indexed content', async ({ page }) => {
	await page.goto('/search/');
	await page.getByRole('searchbox').fill('Astro');
	await expect(page.getByRole('link', { name: /你好，这里是 Kano/ })).toBeVisible();
});

test('feed, sitemap, robots and custom not-found page are available', async ({ request, page }) => {
	for (const path of ['/rss.xml', '/sitemap-index.xml', '/robots.txt']) {
		const response = await request.get(path);
		expect(response.ok()).toBeTruthy();
	}
	const sitemap = await request.get('/sitemap-0.xml');
	const sitemapBody = await sitemap.text();
	expect(sitemapBody).toContain('https://blog.kanojyo.de/blog/hello-kano/');
	expect(sitemapBody).not.toContain('https://blog.kanojyo.de/search/');
	// Pagefind's local static server does not apply Cloudflare's 404 fallback,
	// so verify the generated custom document directly.
	await page.goto('/404.html');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('这里没有内容。');
});

test('key pages have no automatically detectable accessibility violations', async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name.includes('mobile'), 'Covered by the desktop semantic scan.');
	for (const path of ['/', '/blog/', '/blog/hello-kano/', '/projects/']) {
		await page.goto(path);
		const results = await new AxeBuilder({ page }).exclude('.giscus-frame').analyze();
		expect(results.violations, `${path}: ${JSON.stringify(results.violations)}`).toEqual([]);
	}
});
