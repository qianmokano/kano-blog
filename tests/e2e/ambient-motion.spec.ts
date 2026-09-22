import { expect, test } from '@playwright/test';

test('ambient artwork respects motion preferences and viewport bounds', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.hero-orbit')).toHaveAttribute('aria-hidden', 'true');
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(page.locator('.orbit-ring').first()).toHaveCSS('animation-name', 'none');
	await expect(page.getByRole('link', { name: '开始阅读' })).toBeVisible();
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await expect(page.locator('.orbit-ring').first()).toHaveCSS('animation-name', 'orbit-turn');
	await page.locator('footer').scrollIntoViewIfNeeded();
	await expect(page.locator('.hero-orbit')).toHaveAttribute('data-paused', '');
});

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
