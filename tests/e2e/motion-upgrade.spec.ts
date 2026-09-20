import { expect, test, type Page } from '@playwright/test';

test.use({ video: 'on' });

for (const scale of [1, 2]) {
	test.describe(`theme pixel scale ${scale}`, () => {
		test.use({ deviceScaleFactor: scale });
		test('theme opening frame grows visibly from the button before filling the viewport', async ({
			page,
		}, testInfo) => {
			await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
			await page.goto('/blog/vps-first-steps-security/');
			await page.locator('[data-theme-toggle]').focus();
			const rect = (await page.locator('[data-theme-toggle]').boundingBox())!;
			await page.keyboard.press('Enter');
			await page.waitForFunction(() =>
				document
					.getAnimations()
					.some(
						(animation) =>
							animation.effect instanceof KeyframeEffect &&
							animation.effect.pseudoElement === '::view-transition-new(root)',
					),
			);
			const opening = await page.evaluate(() => {
				const animation = document
					.getAnimations()
					.find(
						(animation) =>
							animation.effect instanceof KeyframeEffect &&
							animation.effect.pseudoElement === '::view-transition-new(root)',
					)!;
				animation.pause();
				const centers = [40, 120, 250].map((time) => {
					animation.currentTime = time;
					return getComputedStyle(
						document.documentElement,
						'::view-transition-new(root)',
					).clipPath.split(' at ')[1];
				});
				animation.currentTime = 40;
				return {
					clip: getComputedStyle(document.documentElement, '::view-transition-new(root)').clipPath,
					centers,
				};
			});
			expect(new Set(opening.centers).size).toBe(1);
			expect(opening.clip).toMatch(/^circle\([\d.]+% at [\d.]+% [\d.]+%\)$/);
			const values = opening.clip.match(/[\d.]+/g)!.map(Number);
			const viewport = page.viewportSize()!;
			expect(values[0]).toBeGreaterThan(0);
			expect(
				((values[0] / 100) * Math.hypot(viewport.width, viewport.height)) / Math.SQRT2,
			).toBeLessThan(rect.width * 2);
			expect((values[1] / 100) * viewport.width).toBeCloseTo(rect.x + rect.width / 2, 1);
			expect((values[2] / 100) * viewport.height).toBeCloseTo(rect.y + rect.height / 2, 1);
			await page.screenshot({ path: testInfo.outputPath('button-origin-40ms.png') });
			await page.evaluate(() =>
				document.getAnimations().forEach((animation) => {
					if (
						animation.effect instanceof KeyframeEffect &&
						animation.effect.pseudoElement === '::view-transition-new(root)'
					)
						animation.play();
				}),
			);
			await expect(page.locator('html')).not.toHaveClass(/theme-transition/);
			await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(10, 10, 10)');
			expect(
				await page
					.locator('html')
					.evaluate((node) => (node as HTMLElement).style.getPropertyValue('--theme-reveal-x')),
			).toBe('');
		});
	});
}

async function recordTitleOnLeave(page: Page) {
	await page.evaluate(() => {
		window.addEventListener(
			'pageswap',
			() => {
				sessionStorage.setItem(
					'title-count',
					String(
						[...document.querySelectorAll('[data-transition-title-source]')].filter(
							(node) => getComputedStyle(node).viewTransitionName === 'content-title',
						).length,
					),
				);
			},
			{ once: true },
		);
	});
}

test('theme reveal is isolated and rapid selection settles on the final theme', async ({
	page,
}, testInfo) => {
	await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
	await page.goto('/blog/');
	const button = page.locator('[data-theme-toggle]');
	await button.focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect
		.poll(() =>
			page.evaluate(() =>
				document
					.getAnimations()
					.some(
						(a) =>
							a.effect instanceof KeyframeEffect &&
							a.effect.pseudoElement === '::view-transition-new(root)',
					),
			),
		)
		.toBe(true);
	await page.screenshot({ path: testInfo.outputPath('theme-reveal.png') });
	await expect(page.locator('html')).not.toHaveClass(/theme-transition/);
	const rect = (await button.boundingBox())!;
	await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
	await expect
		.poll(() =>
			page.evaluate(() =>
				document
					.getAnimations()
					.some(
						(animation) =>
							animation.effect instanceof KeyframeEffect &&
							animation.effect.pseudoElement === '::view-transition-new(root)',
					),
			),
		)
		.toBe(true);
	await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
	await expect(page.locator('html')).not.toHaveClass(/theme-transition/);
	await expect(button).toBeFocused();
	expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
	expect(
		await page.locator('html').evaluate((node) => getComputedStyle(node).viewTransitionName),
	).toBe('page-content');
	await expect(page.locator('main')).toHaveCSS('view-transition-name', 'none');
	await expect(page.locator('.site-header')).toHaveCSS('view-transition-name', 'site-header');
});

test('theme completes all three choices and system changes without a reveal', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
	await page.goto('/blog/hello-kano/');
	const button = page.locator('[data-theme-toggle]');
	for (const theme of ['dark', 'light', 'system']) {
		await button.click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
		await expect(page.locator('html')).not.toHaveClass(/theme-transition/);
		expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(
			theme === 'system' ? null : theme,
		);
		await expect(page.locator('[data-transition-title-target]')).toHaveCSS(
			'view-transition-name',
			'content-title',
		);
	}
	await page.emulateMedia({ colorScheme: 'dark' });
	await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(10, 10, 10)');
	await expect(page.locator('html')).not.toHaveClass(/theme-transition/);
});

for (const mode of [
	'reduced',
	'unsupported',
	'storage',
	'same-color',
	'hidden',
	'api-error',
] as const) {
	test(`theme remains usable with ${mode}`, async ({ page }) => {
		await page.emulateMedia({
			colorScheme: mode === 'same-color' ? 'dark' : 'light',
			reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
		});
		await page.addInitScript((mode) => {
			if (mode === 'hidden')
				Object.defineProperty(document, 'visibilityState', { value: 'hidden' });
			if (mode === 'api-error')
				document.startViewTransition = () => {
					throw new Error('capture unavailable');
				};
			if (mode === 'unsupported')
				Object.defineProperty(document, 'startViewTransition', { value: undefined });
			if (mode === 'storage')
				Object.defineProperty(window, 'localStorage', {
					get() {
						throw new Error('unavailable');
					},
				});
		}, mode);
		await page.goto('/blog/');
		await page.locator('[data-theme-toggle]').click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await expect(page.locator('html')).not.toHaveClass(/theme-transition/);
		await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('aria-label', /当前为深色/);
	});
}

for (const dialog of [false, true]) {
	test(`search arrow keys preserve native links and input composition (${dialog ? 'dialog' : 'page'})`, async ({
		page,
	}) => {
		await page.goto(dialog ? '/' : '/search/');
		if (dialog) await page.locator('[data-search-open]').click();
		const root = page.locator(dialog ? '[data-search-dialog]' : '[data-search-root]');
		const input = root.getByRole('searchbox');
		await input.fill('Astro');
		const links = root.locator('.search-result');
		await expect(links).toHaveCount(2);
		// Ranking can change with indexed content; Enter should follow the focused link.
		const destination = new URL((await links.last().getAttribute('href'))!, page.url()).href;
		await input.press('ArrowDown');
		await expect(links.first()).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(links.last()).toBeFocused();
		await page.keyboard.press('Shift+Tab');
		await expect(links.first()).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(links.last()).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(links.last()).toBeFocused();
		await page.keyboard.press('ArrowUp');
		await page.keyboard.press('ArrowUp');
		await expect(input).toBeFocused();
		await expect(links.first()).toHaveCSS('box-shadow', 'none');
		await input.dispatchEvent('keydown', { key: 'ArrowDown', isComposing: true });
		await expect(input).toBeFocused();
		await input.press('ArrowUp');
		await expect(links.last()).toBeFocused();
		if (dialog) {
			await page.keyboard.press('Escape');
			await expect(root).not.toBeVisible();
			await expect(page.locator('[data-search-open]')).toBeFocused();
			await page.locator('[data-search-open]').click();
			await input.press('ArrowUp');
			await recordTitleOnLeave(page);
			await page.keyboard.press('Enter');
			await expect(page).toHaveURL(destination);
			expect(await page.evaluate(() => sessionStorage.getItem('title-count'))).toBe('1');
		} else {
			await page.keyboard.press('Enter');
			await expect(page).toHaveURL(destination);
		}
	});
}
