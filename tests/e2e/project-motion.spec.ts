import { expect, test } from '@playwright/test';

test('project motion keeps copy and crop stable and honors reduced motion', async ({
	page,
	isMobile,
}) => {
	await page.goto('/projects/');
	const card = page.locator('.project-card').first();
	await card.scrollIntoViewIfNeeded();
	await expect(card).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
	const image = card.locator('.project-preview img');
	const copy = card.locator('.project-card-copy');
	const crop = card.locator('.project-preview');
	const copyRect = await copy.boundingBox();
	const cropRect = await crop.boundingBox();
	if (!isMobile) await card.hover();
	else await card.locator('h2 a').focus();
	await expect(image).toHaveCSS('transform', 'matrix(1.025, 0, 0, 1.025, 0, 0)');
	await expect(card.locator('.project-action-arrow').first()).toHaveCSS(
		'transform',
		'matrix(1, 0, 0, 1, 2, -2)',
	);
	expect(await copy.boundingBox()).toEqual(copyRect);
	expect(await crop.boundingBox()).toEqual(cropRect);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(image).toHaveCSS('transform', 'none');
	await expect(card.locator('.project-action-arrow').first()).toHaveCSS('transform', 'none');
});
