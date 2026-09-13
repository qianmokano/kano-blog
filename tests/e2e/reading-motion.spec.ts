import { expect, test } from '@playwright/test';

const article = '/blog/vps-first-steps-security/';

test('chapter links highlight only the final destination and ordinary scrolling stays quiet', async ({
	page,
	isMobile,
}) => {
	await page.goto(article);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const toc = page.locator(isMobile ? '.mobile-toc' : '.article-toc');
	if (isMobile) await toc.locator('summary').click();
	const target = await toc.locator('a').nth(2).getAttribute('href');
	await toc.locator('a').nth(2).click();
	await expect(page.locator('.heading-arrival')).toHaveCount(1);
	await expect(page.locator('.heading-arrival')).toHaveAttribute(
		'id',
		decodeURIComponent(target!.slice(1)),
	);
	await expect(page.locator('.heading-arrival')).toHaveCount(0, { timeout: 2500 });
	await page.mouse.wheel(0, 300);
	await expect(page.locator('.heading-arrival')).toHaveCount(0);
	const hashes = await toc
		.locator('a')
		.evaluateAll((links) => links.slice(0, 2).map((link) => (link as HTMLAnchorElement).hash));
	await page.evaluate((values) => {
		location.hash = values[0];
		location.hash = values[1];
	}, hashes);
	await expect(page.locator('.heading-arrival')).toHaveCount(1);
	await expect(page.locator('.heading-arrival')).toHaveAttribute(
		'id',
		decodeURIComponent(hashes[1].slice(1)),
	);
});

test('direct chapter URL receives arrival feedback', async ({ page }) => {
	await page.goto(article);
	const hash = await page.locator('.article-toc a').nth(1).getAttribute('href');
	await page.goto(article + hash);
	await expect(page.locator('.heading-arrival')).toHaveAttribute(
		'id',
		decodeURIComponent(hash!.slice(1)),
	);
});

test('mobile TOC opens without shifting the article or scrolling the page', async ({
	page,
	isMobile,
}) => {
	test.skip(!isMobile, 'Mobile layout only');
	await page.goto(article);
	const summary = page.locator('.mobile-toc summary');
	await summary.scrollIntoViewIfNeeded();
	const before = await page.locator('.prose').boundingBox();
	const scroll = await page.evaluate(() => scrollY);
	await summary.click();
	await expect(page.locator('.mobile-toc .toc-links')).toBeVisible();
	await expect.poll(() => page.locator('.prose').boundingBox()).toEqual(before);
	await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
	await page.keyboard.press('Escape');
	await expect(summary).toBeFocused();
});
