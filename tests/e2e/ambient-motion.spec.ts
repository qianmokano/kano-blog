import { expect, test } from '@playwright/test';

test('pointer lighting stays inside the preview and resets when reduced motion is enabled', async ({
	page,
	isMobile,
}) => {
	test.skip(isMobile, 'Fine pointer interaction');
	await page.goto('/projects/');
	const preview = page.locator('.project-preview').first();
	await preview.hover();
	await expect(preview).toHaveAttribute('data-light', 'active');
	await expect(preview).toHaveCSS('position', 'relative');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(preview).not.toHaveAttribute('data-light');
});
