import { expect, test } from '@playwright/test';

const article = '/blog/vps-first-steps-security/';

test('mobile reading progress follows prose, chapter jumps and narrow layouts', async ({
	page,
	isMobile,
}) => {
	test.skip(!isMobile, 'Mobile reading progress only');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(article);
	const label = page.locator('[data-reading-progress]');
	await expect(label).toHaveText('0%');
	const toc = page.locator('.mobile-toc');
	await toc.locator('summary').click();
	await toc.locator('a').nth(5).click();
	await expect.poll(async () => parseInt((await label.textContent())!)).toBeGreaterThan(0);
	const value = parseInt((await label.textContent())!);
	expect(value).toBeLessThan(100);
	await expect(label).toHaveAttribute('aria-label', `阅读进度 ${value}%`);
	await expect
		.poll(() =>
			toc.evaluate((node) => {
				const desktop = document.querySelector('.article-toc') as HTMLElement;
				return (
					(node as HTMLElement).style.getPropertyValue('--toc-progress') ===
					desktop.style.getPropertyValue('--toc-progress')
				);
			}),
		)
		.toBe(true);
	await page.setViewportSize({ width: 320, height: 740 });
	const fits = await toc.locator('summary').evaluate((summary) => {
		const spans = [...summary.children].map((node) => node.getBoundingClientRect());
		return (
			spans.every((rect, index) => index === 0 || rect.left >= spans[index - 1].right) &&
			summary.scrollWidth <= summary.clientWidth
		);
	});
	expect(fits).toBe(true);
	await page
		.locator('.prose')
		.evaluate((node) =>
			window.scrollTo(0, node.getBoundingClientRect().bottom + scrollY - innerHeight * 0.5),
		);
	await expect(label).toHaveText('100%');
	await expect
		.poll(() =>
			toc
				.locator('summary')
				.evaluate(
					(node) => new DOMMatrixReadOnly(getComputedStyle(node, '::before').transform).m11,
				),
		)
		.toBe(1);
	await page.evaluate(() => window.scrollTo(0, 0));
	await expect(label).toHaveText('0%');
});

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
