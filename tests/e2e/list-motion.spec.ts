import { expect, test } from '@playwright/test';

test('list feedback keeps text still and is available to the keyboard', async ({
	page,
	isMobile,
}) => {
	await page.goto('/blog/');
	const card = page.locator('.content-card').first();
	const title = card.locator('h2 a');
	const position = await title.boundingBox();
	const original = await card.evaluate((node) => getComputedStyle(node).backgroundColor);
	if (!isMobile) {
		await card.hover();
		await expect
			.poll(() => card.evaluate((node) => getComputedStyle(node).backgroundColor))
			.not.toBe(original);
		await expect.poll(() => title.boundingBox()).toEqual(position);
		await page.mouse.move(0, 0);
	}
	await title.focus();
	await expect(title).toBeFocused();
	await expect
		.poll(() => card.evaluate((node) => getComputedStyle(node).backgroundColor))
		.not.toBe(original);
	await expect.poll(() => title.boundingBox()).toEqual(position);
});

test('returning to an article list preserves position without a transition', async ({ page }) => {
	await page.goto('/blog/');
	const title = page.locator('.content-card h2 a').last();
	await title.scrollIntoViewIfNeeded();
	const before = await page.evaluate(() => scrollY);
	await title.click();
	await expect(page.locator('.article-header')).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL(/\/blog\/$/);
	await expect.poll(() => page.evaluate((y) => Math.abs(scrollY - y), before)).toBeLessThan(3);
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					document
						.getAnimations()
						.filter(
							(animation) =>
								animation.effect instanceof KeyframeEffect &&
								animation.effect.pseudoElement?.startsWith('::view-transition'),
						).length,
			),
		)
		.toBe(0);
});
