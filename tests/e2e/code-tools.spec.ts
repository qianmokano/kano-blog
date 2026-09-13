import { expect, test } from '@playwright/test';

const articlePath = '/blog/vps-first-steps-security/';

test('copy control preserves code, keeps its original text-button layout, and reports pending and success', async ({
	page,
}) => {
	await page.addInitScript(() => {
		let resolveCopy: (() => void) | undefined;
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: (value: string) => {
					(window as typeof window & { copiedCode?: string }).copiedCode = value;
					return new Promise<void>((resolve) => {
						resolveCopy = resolve;
						(window as typeof window & { resolveCopy?: () => void }).resolveCopy = resolveCopy;
					});
				},
			},
		});
	});
	await page.goto(articlePath);

	const block = page.locator('.code-block').first();
	const pre = block.locator('pre');
	const button = block.locator('.copy-code');
	await expect(button).toHaveAccessibleName('复制代码');
	const before = await pre.locator('code').textContent();
	await expect(button).toHaveText('复制');
	await expect(block.locator('.code-block__toolbar, svg')).toHaveCount(0);
	await pre.scrollIntoViewIfNeeded();
	const idleBox = await pre.boundingBox();
	await button.click();
	await expect(button).toBeDisabled();
	await expect(button).toHaveAttribute('aria-label', '正在复制代码');
	await page.evaluate(() =>
		(window as typeof window & { resolveCopy?: () => void }).resolveCopy?.(),
	);
	await expect(button).toHaveAttribute('aria-label', '代码已复制');
	await expect(block.getByRole('status')).toHaveText('已复制');
	const successBox = await pre.boundingBox();
	expect(successBox).toMatchObject({ width: idleBox!.width, height: idleBox!.height });
	expect(await pre.locator('code').textContent()).toBe(before);
	expect(
		await page.evaluate(() => (window as typeof window & { copiedCode?: string }).copiedCode),
	).toBe(before);
});

test('failed copying is retryable and repeated copies replace the reset timer', async ({
	page,
}) => {
	await page.addInitScript(() => {
		let attempts = 0;
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: () => {
					attempts += 1;
					return attempts === 1 ? Promise.reject(new Error('denied')) : Promise.resolve();
				},
			},
		});
	});
	await page.goto(articlePath);
	const block = page.locator('.code-block').first();
	const button = block.locator('.copy-code');
	await expect(button).toHaveAccessibleName('复制代码');

	await button.click();
	await expect(button).toHaveAttribute('aria-label', '复制失败，重试');
	await expect(button).toBeEnabled();
	await button.click();
	await expect(button).toHaveAttribute('aria-label', '代码已复制');
	await page.waitForTimeout(900);
	await button.click();
	await expect(button).toHaveAttribute('aria-label', '代码已复制');
	await page.waitForTimeout(900);
	await expect(button).toHaveAttribute('aria-label', '代码已复制');
});

test('overflow edges follow horizontal scrolling and resizing', async ({ page }) => {
	await page.goto(articlePath);
	const block = page.locator('.code-block').first();
	const pre = block.locator('pre');

	await pre.locator('code').evaluate((code) => {
		code.style.display = 'inline-block';
		code.style.minWidth = '1800px';
	});
	await expect(block).toHaveAttribute('data-overflow-right', '');
	await expect(block).not.toHaveAttribute('data-overflow-left', '');
	await pre.evaluate((node) => node.scrollTo({ left: node.scrollWidth, behavior: 'instant' }));
	await expect(block).toHaveAttribute('data-overflow-left', '');
	await expect(block).not.toHaveAttribute('data-overflow-right', '');
	await pre.locator('code').evaluate((code) => {
		code.style.minWidth = '0';
		code.style.width = '1px';
	});
	await expect(block).not.toHaveAttribute('data-overflow-left', '');
	await expect(block).not.toHaveAttribute('data-overflow-right', '');
	await expect(block.locator('.code-block__edge--right')).toHaveCSS('pointer-events', 'none');
});
