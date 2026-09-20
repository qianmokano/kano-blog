import { expect, test } from '@playwright/test';

test('home keeps its greeting while content uses the narrower shell', async ({
	page,
	isMobile,
}, testInfo) => {
	await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
	if (!isMobile) await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/');
	await expect(page.locator('[data-typewriter]')).toHaveText('Hi!👋\n这里是kano！');
	const widths = await page.evaluate(() => ({
		header: document.querySelector('.header-inner')!.getBoundingClientRect().width,
		content: document.querySelector('.home-sections')!.getBoundingClientRect().width,
		hero: document.querySelector('.home-hero')!.getBoundingClientRect().width,
	}));
	expect(widths.hero).toBe(widths.header);
	if (!isMobile) {
		expect(widths.header).toBe(1152);
		expect(widths.content).toBe(896);
	}
	await page.screenshot({ path: testInfo.outputPath('homepage.png') });
});

test('article title, prose and closing sections share one reading column at every breakpoint', async ({
	page,
}, testInfo) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	for (const path of ['/blog/vps-first-steps-security/', '/blog/hello-kano/']) {
		await page.goto(path);
		for (const width of [1440, 1100, 1024, 800, 390, 320]) {
			await page.setViewportSize({ width, height: 900 });
			const geometry = await page.evaluate(() => {
				const prose = document.querySelector('.article-grid > .prose')!.getBoundingClientRect();
				const sections = [...document.querySelectorAll('.article-page > .reading-shell')].map(
					(node) => {
						const rect = node.getBoundingClientRect();
						return { left: rect.left, width: rect.width };
					},
				);
				return {
					prose: { left: prose.left, width: prose.width, top: prose.top },
					sections,
					overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
				};
			});
			expect(geometry.overflow, `${path} at ${width}px`).toBe(0);
			expect(geometry.prose.width).toBeLessThanOrEqual(704);
			for (const section of geometry.sections) {
				expect(Math.abs(section.left - geometry.prose.left), `${path} at ${width}px`).toBeLessThan(
					1,
				);
				expect(Math.abs(section.width - geometry.prose.width)).toBeLessThan(1);
			}
			expect(geometry.prose.top).toBeLessThan(900);
			if (path.includes('vps-')) {
				await expect(page.locator(width <= 1024 ? '.mobile-toc' : '.article-toc')).toBeVisible();
				await expect(page.locator(width <= 1024 ? '.article-toc' : '.mobile-toc')).toBeHidden();
				if (width === 1440 || width === 390) {
					await page.screenshot({ path: testInfo.outputPath(`article-${width}.png`) });
				}
			}
		}
	}
});

test('listing pages share the content width and compact title scale', async ({
	page,
	isMobile,
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	for (const path of ['/blog/', '/notes/', '/projects/', '/archive/', '/tags/astro/']) {
		await page.goto(path);
		const layout = await page.locator('.page-section').evaluate((section) => {
			const heading = section.querySelector('h1')!;
			return {
				width: section.getBoundingClientRect().width,
				titleSize: parseFloat(getComputedStyle(heading).fontSize),
				overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
			};
		});
		expect(layout.width).toBeLessThanOrEqual(896);
		if (!isMobile) expect(layout.width).toBe(896);
		expect(layout.titleSize).toBeLessThanOrEqual(64);
		expect(layout.overflow).toBe(0);
	}
});

test('projects expose independent detail, demo and source links in a responsive showcase', async ({
	page,
	isMobile,
}, testInfo) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/projects/');
	const card = page.locator('.project-card').first();
	await expect(card.locator('.project-preview img')).toBeVisible();
	await expect
		.poll(() => card.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth))
		.toBeGreaterThan(0);
	await expect(card.getByRole('link', { name: 'Kano Blog', exact: true })).toHaveAttribute(
		'href',
		'/projects/kano-blog/',
	);
	await expect(card.getByRole('link', { name: '访问项目 ↗' })).toHaveAttribute(
		'href',
		'https://blog.thekanojyo.com/',
	);
	await expect(card.getByRole('link', { name: '查看源码 ↗' })).toHaveAttribute(
		'href',
		'https://github.com/qianmokano/kano-blog',
	);
	const preview = (await card.locator('.project-preview').boundingBox())!;
	const copy = (await card.locator('.project-card-copy').boundingBox())!;
	if (isMobile) expect(copy.y).toBeGreaterThanOrEqual(preview.y + preview.height);
	else expect(copy.x).toBeGreaterThanOrEqual(preview.x + preview.width);
	await page.screenshot({ path: testInfo.outputPath('projects.png'), fullPage: true });
	await card.getByRole('link', { name: 'Kano Blog', exact: true }).click();
	await expect(page).toHaveURL('/projects/kano-blog/');
	await expect(page.locator('h1')).toHaveText('Kano Blog');
});

test('notes use a separate date column and retain full-row keyboard navigation', async ({
	page,
	isMobile,
}, testInfo) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/notes/');
	const card = page.locator('.note-card').first();
	const date = (await card.locator('time').boundingBox())!;
	const title = card.locator('h2 a');
	const heading = (await title.boundingBox())!;
	if (isMobile) expect(heading.y).toBeGreaterThanOrEqual(date.y + date.height);
	else expect(heading.x).toBeGreaterThan(date.x + date.width);
	await title.focus();
	await expect(page.locator('.content-list')).toHaveAttribute('data-feedback-visible', '');
	await page.screenshot({ path: testInfo.outputPath('notes.png'), fullPage: true });
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL('/notes/site-online/');
});
