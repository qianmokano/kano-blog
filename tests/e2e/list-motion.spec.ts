import { expect, test } from '@playwright/test';

test('list feedback keeps text still and is available to the keyboard', async ({
	page,
	isMobile,
}) => {
	await page.goto('/blog/');
	const card = page.locator('.content-card').first();
	const title = card.locator('h2 a');
	// Measure after the existing scroll entrance, independently of hover feedback.
	await expect(card).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
	const position = await title.boundingBox();
	const list = page.locator('.content-list').first();
	const opacity = () => list.evaluate((node) => getComputedStyle(node, '::before').opacity);
	if (!isMobile) {
		await card.hover();
		await expect.poll(opacity).toBe('1');
		await expect.poll(() => title.boundingBox()).toEqual(position);
		await page.mouse.move(0, 0);
	}
	await title.focus();
	await expect(title).toBeFocused();
	await expect.poll(opacity).toBe('1');
	await expect.poll(() => title.boundingBox()).toEqual(position);
});

test('one highlight moves between rows and follows keyboard focus and resizing', async ({
	page,
	isMobile,
}) => {
	await page.goto('/blog/');
	const list = page.locator('.content-list').first();
	const cards = list.locator(':scope > .content-card');
	const first = cards.first().locator('h2 a');
	const last = cards.last().locator('h2 a');
	await cards.last().scrollIntoViewIfNeeded();
	await expect(cards.last()).toHaveClass(/is-revealed/);
	await first.focus();
	await expect(list).toHaveAttribute('data-feedback-visible', '');
	await last.focus();
	const aligned = () =>
		cards.last().evaluate((card) => {
			const style = getComputedStyle(card.parentElement!, '::before');
			return {
				y: Math.round(new DOMMatrixReadOnly(style.transform).m42),
				height: Math.round(parseFloat(style.height)),
				expectedY: (card as HTMLElement).offsetTop,
				expectedHeight: (card as HTMLElement).offsetHeight,
			};
		});
	await expect
		.poll(async () => {
			const values = await aligned();
			return values.y === values.expectedY && values.height === values.expectedHeight;
		})
		.toBe(true);
	if (!isMobile) {
		// Pointer exit must not erase feedback owned by keyboard focus.
		await cards.first().hover();
		await page.mouse.move(0, 0);
		await expect(list).toHaveAttribute('data-feedback-visible', '');
	}
	await page.setViewportSize({ width: 320, height: 740 });
	await expect
		.poll(async () => {
			const values = await aligned();
			return values.y === values.expectedY && values.height === values.expectedHeight;
		})
		.toBe(true);
	await page.locator('.wordmark').focus();
	await expect(list).not.toHaveAttribute('data-feedback-visible');
	await expect
		.poll(() => list.evaluate((node) => getComputedStyle(node, '::before').opacity))
		.toBe('0');
});

test('reduced motion preserves instant list feedback', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/blog/');
	await page.locator('.content-card h2 a').last().focus();
	const list = page.locator('.content-list').first();
	await expect(list).toHaveAttribute('data-feedback-visible', '');
	const durations = await list.evaluate(
		(node) => getComputedStyle(node, '::before').transitionDuration,
	);
	expect(durations.split(',').every((duration) => parseFloat(duration) < 0.001)).toBe(true);
});

test('touch scrolling does not leave a hover highlight', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'Touch layout only');
	await page.goto('/blog/');
	await page
		.locator('.content-card')
		.first()
		.dispatchEvent('pointerenter', { pointerType: 'touch' });
	await expect(page.locator('.content-list').first()).not.toHaveAttribute('data-feedback-visible');
});

test('lists retain their native hover feedback without JavaScript', async ({
	browser,
	isMobile,
}) => {
	test.skip(isMobile, 'Hover fallback only');
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	try {
		await page.goto('http://127.0.0.1:1414/blog/');
		const card = page.locator('.content-card').first();
		const original = await card.evaluate((node) => getComputedStyle(node).backgroundColor);
		await card.hover();
		await expect
			.poll(() => card.evaluate((node) => getComputedStyle(node).backgroundColor))
			.not.toBe(original);
	} finally {
		await context.close();
	}
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
