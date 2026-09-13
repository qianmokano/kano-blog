import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
	test.skip(!testInfo.project.name.includes('mobile'), 'Mobile navigation behavior.');
	await page.goto('/');
});

test('mobile menu updates its accessible name when opened and closed', async ({ page }) => {
	const menu = page.locator('[data-mobile-menu]');
	const trigger = page.getByLabel('打开导航');

	await expect(menu).not.toHaveAttribute('open');
	await trigger.click();
	await expect(menu).toHaveAttribute('open', '');
	await expect(page.getByLabel('关闭导航')).toBeVisible();

	await page.getByLabel('关闭导航').click();
	await expect(menu).not.toHaveAttribute('open');
	await expect(page.getByLabel('打开导航')).toBeVisible();
});

test('Escape closes the mobile menu and returns focus to its trigger', async ({ page }) => {
	const menu = page.locator('[data-mobile-menu]');
	const trigger = page.getByLabel('打开导航');

	await trigger.click();
	await menu.getByRole('link').first().focus();
	await page.keyboard.press('Escape');

	await expect(menu).not.toHaveAttribute('open');
	await expect(trigger).toBeFocused();
	await expect(trigger).toHaveAccessibleName('打开导航');
});

test('reduced motion shows the open icon without an animation', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.reload();

	const menu = page.locator('[data-mobile-menu]');
	const topLine = menu.locator('.menu-icon-line-top');
	const middleLine = menu.locator('.menu-icon-line-middle');
	const bottomLine = menu.locator('.menu-icon-line-bottom');
	await page.getByLabel('打开导航').click();

	await expect(topLine).toHaveCSS('transition-duration', '0s');
	await expect(middleLine).toHaveCSS('opacity', '0');
	await expect(bottomLine).toHaveCSS('transition-duration', '0s');
	// Measure the icon and its lines in the same frame, including touch hover movement.
	const offsets = await menu.locator('.menu-icon').evaluate((element) => {
		const icon = element.getBoundingClientRect();
		return [...element.querySelectorAll('.menu-icon-line-top, .menu-icon-line-bottom')].map(
			(line) => {
				const box = line.getBoundingClientRect();
				return {
					x: box.x + box.width / 2 - (icon.x + icon.width / 2),
					y: box.y + box.height / 2 - (icon.y + icon.height / 2),
				};
			},
		);
	});
	for (const offset of offsets) {
		expect(Math.abs(offset.x)).toBeLessThan(0.5);
		expect(Math.abs(offset.y)).toBeLessThan(0.5);
	}
});
