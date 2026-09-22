import { expect, test, type Page } from '@playwright/test';

const fixtureImage =
	'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"%3E%3Crect width="800" height="600" fill="%235276a7"/%3E%3C/svg%3E';

async function injectViewerFixture(page: Page, zoomSource = '') {
	await page.route('**/blog/hello-kano/', async (route) => {
		const response = await route.fetch();
		const body = await response.text();
		await route.fulfill({
			response,
			body: body.replace(
				'<div class="prose">',
				`<div class="prose"><div style="height: 900px"></div><figure><img id="viewer-fixture" src='${fixtureImage}' data-zoom-src="${zoomSource}" alt="蓝色示例图"><figcaption>来自图注的说明</figcaption></figure>`,
			),
		});
	});
	await page.goto('/blog/hello-kano/');
}

test('article images open accessibly and restore focus and scroll when dismissed', async ({
	page,
}) => {
	await injectViewerFixture(page);
	const trigger = page.getByRole('button', { name: '查看大图：蓝色示例图' });
	await trigger.scrollIntoViewIfNeeded();
	await trigger.focus();
	const scrollY = await page.evaluate(() => window.scrollY);

	await page.keyboard.press('Enter');
	const dialog = page.getByRole('dialog', { name: '图片预览' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByText('来自图注的说明')).toBeVisible();
	await expect(dialog.getByRole('button', { name: '关闭图片预览' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);

	await trigger.click();
	await expect(dialog).toBeVisible();
	await page.mouse.click(4, 4);
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
});

test('failed larger image keeps the original preview visible', async ({ page }) => {
	let release!: () => void;
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route('**/viewer-large.png', async (route) => {
		await pending;
		await route.abort('failed');
	});
	try {
		await injectViewerFixture(page, '/viewer-large.png');
		const requested = page.waitForRequest('**/viewer-large.png');
		await page.getByRole('button', { name: '查看大图：蓝色示例图' }).click();
		await requested;
		const preview = page.locator('.image-viewer__image');
		await expect(preview).toHaveAttribute('src', fixtureImage);
		await expect(preview).toBeVisible();
		const failed = page.waitForEvent('requestfailed', {
			predicate: (request) => request.url().endsWith('/viewer-large.png'),
		});
		release();
		await failed;
		await expect(preview).toHaveAttribute('src', fixtureImage);
		expect(await preview.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(800);
		await page.getByRole('button', { name: '关闭图片预览' }).click();
		await expect(page.getByRole('dialog', { name: '图片预览' })).toBeHidden();
	} finally {
		release();
	}
});

test('article image viewer honors reduced motion', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await injectViewerFixture(page);
	await page.getByRole('button', { name: '查看大图：蓝色示例图' }).click();
	const viewerImage = page.locator('.image-viewer__image');
	await expect(page.getByRole('dialog', { name: '图片预览' })).toBeVisible();
	expect(await viewerImage.evaluate((image) => image.getAnimations().length)).toBe(0);
});

test('closing during expansion starts at the current image position', async ({ page }) => {
	await injectViewerFixture(page);
	await page.getByRole('button', { name: '查看大图：蓝色示例图' }).click();
	const preview = page.locator('.image-viewer__image');
	const position = await preview.evaluate((image) => {
		const animation = image.getAnimations()[0];
		animation.pause();
		animation.currentTime = 70;
		return getComputedStyle(image).transform;
	});
	await page.keyboard.press('Escape');
	const firstFrame = await preview.evaluate((image) => {
		const animation = image.getAnimations()[0];
		return (animation.effect as KeyframeEffect).getKeyframes()[0].transform;
	});
	expect(firstFrame).toBe(position);
	await expect(page.getByRole('dialog', { name: '图片预览' })).toBeHidden();
});
