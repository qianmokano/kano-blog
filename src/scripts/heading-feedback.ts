export {};

const prose = document.querySelector('.article-grid > .prose');
let pending: HTMLElement | undefined;
let highlighted: HTMLElement | undefined;
let settleTimer = 0;
let clearTimer = 0;

const cancel = () => {
	window.clearTimeout(settleTimer);
	window.clearTimeout(clearTimer);
	highlighted?.classList.remove('heading-arrival');
	highlighted = undefined;
	pending = undefined;
};

const arrive = () => {
	if (!pending) return;
	highlighted = pending;
	pending = undefined;
	highlighted.classList.add('heading-arrival');
	clearTimer = window.setTimeout(cancel, 1100);
};

const schedule = (hash: string) => {
	cancel();
	let id;
	try {
		id = decodeURIComponent(hash.slice(1));
	} catch {
		return;
	}
	const heading = document.getElementById(id);
	if (!heading || !prose?.contains(heading) || !heading.matches('h2, h3, h4')) return;
	pending = heading;
	settleTimer = window.setTimeout(arrive, 180);
};

window.addEventListener(
	'scroll',
	() => {
		if (!pending) return;
		window.clearTimeout(settleTimer);
		settleTimer = window.setTimeout(arrive, 120);
	},
	{ passive: true },
);
document.addEventListener('click', (event) => {
	if (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey
	)
		return;
	const link = (event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
	if (!link) return;
	const url = new URL(link.href);
	if (
		url.origin === location.origin &&
		url.pathname === location.pathname &&
		url.search === location.search &&
		url.hash
	)
		schedule(url.hash);
});
window.addEventListener('hashchange', () => schedule(location.hash));
window.addEventListener('pageshow', () => {
	if (location.hash) schedule(location.hash);
});
window.addEventListener('pagehide', cancel);
window.addEventListener('wheel', cancel, { passive: true });
window.addEventListener('touchstart', cancel, { passive: true });
window.addEventListener('keydown', (event) => {
	if (
		['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', 'Escape', ' '].includes(event.key)
	)
		cancel();
});
if (location.hash) schedule(location.hash);
