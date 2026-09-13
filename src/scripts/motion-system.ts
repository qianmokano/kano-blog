export {};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const setupReveals = () => {
	if (reducedMotion.matches || !('IntersectionObserver' in window)) return;

	const groups = [
		...document.querySelectorAll<HTMLElement>('.home-sections > section, .page-section'),
	];
	const targets = groups.flatMap((group) => {
		const groupTargets = [
			...group.querySelectorAll<HTMLElement>(
				':scope > .section-heading, :scope > .page-header, :scope > .content-list > .content-card, :scope > .friend-grid > li, :scope > .archive-groups > section',
			),
		];
		groupTargets.forEach((target, index) => {
			target.dataset.reveal = '';
			target.style.setProperty('--reveal-delay', `${Math.min(index, 3) * 45}ms`);
		});
		return groupTargets;
	});

	if (targets.length === 0) return;
	document.documentElement.classList.add('motion-ready');

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				(entry.target as HTMLElement).classList.add('is-revealed');
				observer.unobserve(entry.target);
			}
		},
		{ rootMargin: '0px 0px -7% 0px', threshold: 0.08 },
	);

	for (const target of targets) observer.observe(target);

	const stop = () => {
		observer.disconnect();
		for (const target of targets) target.classList.add('is-revealed');
	};
	reducedMotion.addEventListener('change', (event) => {
		if (event.matches) stop();
	});
	window.addEventListener('pagehide', stop, { once: true });
};

const clearSharedTitle = () => {
	document.querySelectorAll<HTMLElement>('[data-transition-title-source]').forEach((element) => {
		element.style.removeProperty('view-transition-name');
	});
	document
		.querySelector<HTMLElement>('[data-transition-title-target]')
		?.style.removeProperty('view-transition-name');
};

document.addEventListener('click', (event) => {
	if (
		reducedMotion.matches ||
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey
	)
		return;

	const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
	if (!anchor) return;

	const destination = new URL(anchor.href, location.href);
	if (destination.origin !== location.origin || destination.href === location.href) return;

	clearSharedTitle();
	document
		.querySelector<HTMLElement>('[data-transition-title-target]')
		?.style.setProperty('view-transition-name', 'none');

	if (!anchor.hasAttribute('data-transition-title-link')) return;
	const source = anchor.querySelector<HTMLElement>('[data-transition-title-source]');
	if (!source) return;
	source.style.setProperty('view-transition-name', 'content-title');
});

window.addEventListener('pageshow', clearSharedTitle);
setupReveals();
