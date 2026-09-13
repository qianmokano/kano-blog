import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BLOG_DIRECTORY = 'src/content/blog/';
const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function runGit(args, cwd) {
	return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function commitExists(sha, cwd) {
	if (!sha || /^0+$/.test(sha)) return false;

	try {
		execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd, stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

export function resolveBaseSha(baseSha, headSha, cwd = process.cwd()) {
	if (commitExists(baseSha, cwd)) return baseSha;

	try {
		return runGit(['rev-parse', `${headSha}^`], cwd);
	} catch {
		return EMPTY_TREE_SHA;
	}
}

export function isPublishedArticle(source) {
	const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
	if (frontmatter === undefined) return false;

	return !/^\s*draft\s*:\s*true\s*(?:#.*)?$/imu.test(frontmatter);
}

export function articleUrlFromPath(filePath, siteUrl) {
	if (!filePath.startsWith(BLOG_DIRECTORY) || !/\.(?:md|mdx)$/u.test(filePath)) {
		throw new Error(`Unsupported blog content path: ${filePath}`);
	}

	const slug = filePath
		.slice(BLOG_DIRECTORY.length)
		.replace(/\.(?:md|mdx)$/u, '')
		.split('/')
		.map(encodeURIComponent)
		.join('/');

	return new URL(`/blog/${slug}/`, siteUrl).href;
}

export function findChangedPublishedArticleUrls({
	baseSha,
	headSha,
	siteUrl,
	cwd = process.cwd(),
}) {
	const resolvedBase = resolveBaseSha(baseSha, headSha, cwd);
	const output = execFileSync(
		'git',
		[
			'diff',
			'--name-only',
			'-z',
			'--diff-filter=ACMR',
			resolvedBase,
			headSha,
			'--',
			BLOG_DIRECTORY,
		],
		{ cwd, encoding: 'utf8' },
	);

	const urls = output
		.split('\0')
		.filter((filePath) => /\.(?:md|mdx)$/u.test(filePath))
		.filter((filePath) => isPublishedArticle(readFileSync(`${cwd}/${filePath}`, 'utf8')))
		.map((filePath) => articleUrlFromPath(filePath, siteUrl));

	return [...new Set(urls)];
}

function wait(delayMs) {
	return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function waitForUrl(
	url,
	{ fetchImpl = fetch, attempts = 40, delayMs = 15_000, requestTimeoutMs = 15_000 } = {},
) {
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			const response = await fetchImpl(url, {
				method: 'GET',
				redirect: 'follow',
				headers: { 'User-Agent': 'Kano-Blog-Baidu-Submit/1.0' },
				signal: AbortSignal.timeout(requestTimeoutMs),
			});

			if (response.ok && response.url === url) return;
		} catch (error) {
			if (attempt === attempts) throw error;
		}

		if (attempt < attempts) await wait(delayMs);
	}

	throw new Error(`Published article did not become available: ${url}`);
}

export async function waitForSuccessfulCheck({
	repository,
	sha,
	token,
	checkName = 'Cloudflare Pages',
	fetchImpl = fetch,
	attempts = 40,
	delayMs = 15_000,
}) {
	if (!repository || !sha || !token) {
		throw new Error('GitHub check polling requires repository, commit, and token values.');
	}

	const checksUrl = `https://api.github.com/repos/${repository}/commits/${sha}/check-runs`;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		const response = await fetchImpl(checksUrl, {
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${token}`,
				'User-Agent': 'Kano-Blog-Baidu-Submit/1.0',
				'X-GitHub-Api-Version': '2022-11-28',
			},
		});
		if (!response.ok) {
			throw new Error(`GitHub check API returned HTTP ${response.status}.`);
		}

		const data = await response.json();
		const check = data.check_runs
			?.filter((item) => item.name === checkName)
			.sort((first, second) => second.id - first.id)[0];
		if (check?.conclusion === 'success') return;
		if (check?.status === 'completed') {
			throw new Error(`${checkName} deployment check finished with ${check.conclusion}.`);
		}

		if (attempt < attempts) await wait(delayMs);
	}

	throw new Error(`Timed out waiting for the ${checkName} deployment check.`);
}

export function validateEndpoint(endpoint, siteUrl) {
	let apiUrl;
	try {
		apiUrl = new URL(endpoint);
	} catch {
		throw new Error('BAIDU_SUBMIT_ENDPOINT is not a valid URL.');
	}

	if (apiUrl.hostname !== 'data.zz.baidu.com' || apiUrl.pathname !== '/urls') {
		throw new Error('BAIDU_SUBMIT_ENDPOINT must be the API URL supplied by Baidu.');
	}
	if (!['http:', 'https:'].includes(apiUrl.protocol)) {
		throw new Error('BAIDU_SUBMIT_ENDPOINT must use HTTP or HTTPS.');
	}

	const token = apiUrl.searchParams.get('token');
	const configuredSite = apiUrl.searchParams.get('site');
	if (!token || !configuredSite) {
		throw new Error('BAIDU_SUBMIT_ENDPOINT must contain both site and token parameters.');
	}

	const expectedOrigin = new URL(siteUrl).origin;
	const configuredOrigin = new URL(
		configuredSite.includes('://') ? configuredSite : `https://${configuredSite}`,
	).origin;
	if (configuredOrigin !== expectedOrigin) {
		throw new Error('The Baidu submission endpoint belongs to a different site.');
	}

	return apiUrl;
}

export async function submitUrls(endpoint, siteUrl, urls, fetchImpl = fetch) {
	const apiUrl = validateEndpoint(endpoint, siteUrl);
	const response = await fetchImpl(apiUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'text/plain' },
		body: urls.join('\n'),
	});
	const responseText = await response.text();

	let result;
	try {
		result = JSON.parse(responseText);
	} catch {
		throw new Error(`Baidu returned an invalid response (HTTP ${response.status}).`);
	}

	if (!response.ok || result.error) {
		throw new Error(
			`Baidu rejected the submission: ${result.message ?? `HTTP ${response.status}`}`,
		);
	}

	const rejected = [...(result.not_same_site ?? []), ...(result.not_valid ?? [])];
	if (rejected.length > 0 || result.success !== urls.length) {
		throw new Error(`Baidu accepted ${result.success ?? 0}/${urls.length} submitted URLs.`);
	}

	return result;
}

export async function main(env = process.env) {
	const siteUrl = env.SITE_URL ?? 'https://blog.thekanojyo.com';
	const headSha = env.HEAD_SHA;
	if (!headSha) throw new Error('HEAD_SHA is required.');

	const urls = findChangedPublishedArticleUrls({
		baseSha: env.BASE_SHA,
		headSha,
		siteUrl,
	});
	if (urls.length === 0) {
		console.log('No changed published blog articles to submit.');
		return;
	}
	if (!env.BAIDU_SUBMIT_ENDPOINT) {
		throw new Error('BAIDU_SUBMIT_ENDPOINT is not configured in GitHub Actions secrets.');
	}

	console.log('Waiting for the Cloudflare Pages deployment check...');
	await waitForSuccessfulCheck({
		repository: env.GITHUB_REPOSITORY,
		sha: headSha,
		token: env.GITHUB_TOKEN,
	});
	console.log(`Waiting for ${urls.length} changed article URL(s) to become available...`);
	await Promise.all(urls.map((url) => waitForUrl(url)));

	const result = await submitUrls(env.BAIDU_SUBMIT_ENDPOINT, siteUrl, urls);
	console.log(
		`Submitted ${result.success} URL(s) to Baidu; daily quota remaining: ${result.remain}.`,
	);
	for (const url of urls) console.log(`- ${url}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 1;
	});
}
