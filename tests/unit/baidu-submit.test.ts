import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	articleUrlFromPath,
	findChangedPublishedArticleUrls,
	isPublishedArticle,
	submitUrls,
	waitForSuccessfulCheck,
	waitForUrl,
} from '../../scripts/submit-baidu-urls.mjs';

const temporaryDirectories: string[] = [];

afterEach(() => {
	vi.restoreAllMocks();
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function createRepository() {
	const cwd = mkdtempSync(join(tmpdir(), 'kano-baidu-submit-'));
	temporaryDirectories.push(cwd);
	execFileSync('git', ['init', '--quiet'], { cwd });
	execFileSync('git', ['config', 'user.name', 'Test'], { cwd });
	execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd });
	mkdirSync(join(cwd, 'src/content/blog'), { recursive: true });
	writeFileSync(join(cwd, 'README.md'), 'initial\n');
	execFileSync('git', ['add', '.'], { cwd });
	execFileSync('git', ['commit', '--quiet', '-m', 'initial'], { cwd });
	return cwd;
}

function commit(cwd: string, message: string) {
	execFileSync('git', ['add', '.'], { cwd });
	execFileSync('git', ['commit', '--quiet', '-m', message], { cwd });
	return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
}

describe('Baidu article submission', () => {
	test('recognizes published and draft frontmatter', () => {
		expect(isPublishedArticle('---\ntitle: Public\ndraft: false\n---\n')).toBe(true);
		expect(isPublishedArticle('---\ntitle: Draft\ndraft: true # hidden\n---\n')).toBe(false);
		expect(isPublishedArticle('no frontmatter')).toBe(false);
	});

	test('turns nested content paths into canonical article URLs', () => {
		expect(
			articleUrlFromPath('src/content/blog/astro/search tips.mdx', 'https://blog.example.com'),
		).toBe('https://blog.example.com/blog/astro/search%20tips/');
	});

	test('finds only changed articles that remain published', () => {
		const cwd = createRepository();
		const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd,
			encoding: 'utf8',
		}).trim();
		writeFileSync(
			join(cwd, 'src/content/blog/public.mdx'),
			'---\ntitle: Public\ndraft: false\n---\n',
		);
		writeFileSync(join(cwd, 'src/content/blog/draft.mdx'), '---\ntitle: Draft\ndraft: true\n---\n');
		const headSha = commit(cwd, 'add articles');

		expect(
			findChangedPublishedArticleUrls({
				baseSha,
				headSha,
				siteUrl: 'https://blog.example.com',
				cwd,
			}),
		).toEqual(['https://blog.example.com/blog/public/']);
	});

	test('waits until the deployed URL is available', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, url: 'https://blog.example.com/404/' })
			.mockResolvedValueOnce({
				ok: true,
				url: 'https://blog.example.com/blog/post/',
			});

		await waitForUrl('https://blog.example.com/blog/post/', {
			fetchImpl,
			attempts: 2,
			delayMs: 0,
		});
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	test('waits for the Cloudflare deployment check to succeed', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ check_runs: [{ name: 'Cloudflare Pages', status: 'in_progress' }] }),
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						check_runs: [{ name: 'Cloudflare Pages', status: 'completed', conclusion: 'success' }],
					}),
				),
			);

		await waitForSuccessfulCheck({
			repository: 'owner/repository',
			sha: 'abc123',
			token: 'github-token',
			fetchImpl,
			attempts: 2,
			delayMs: 0,
		});
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	test('submits URL lines and verifies the Baidu response', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ remain: 9, success: 1 }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
		);
		const urls = ['https://blog.example.com/blog/post/'];

		await expect(
			submitUrls(
				'http://data.zz.baidu.com/urls?site=https://blog.example.com&token=secret',
				'https://blog.example.com',
				urls,
				fetchImpl,
			),
		).resolves.toMatchObject({ success: 1 });
		expect(fetchImpl).toHaveBeenCalledWith(
			expect.any(URL),
			expect.objectContaining({ method: 'POST', body: urls[0] }),
		);
	});
});
