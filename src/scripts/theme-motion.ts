export {};

const root = document.documentElement;
const themes = ['system', 'dark', 'light'] as const;
type Theme = (typeof themes)[number];
const dark = matchMedia('(prefers-color-scheme: dark)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const labels = {
	system: '当前跟随系统，点击切换为深色',
	dark: '当前为深色，点击切换为浅色',
	light: '当前为浅色，点击切换为跟随系统',
};
let selected: Theme = themes.includes(root.dataset.theme as Theme)
	? (root.dataset.theme as Theme)
	: 'system';
let revision = 0;
let transition: ViewTransition | undefined;
let animation: Animation | undefined;
const isDark = (theme: Theme) => theme === 'dark' || (theme === 'system' && dark.matches);
const apply = () => {
	root.dataset.theme = selected;
	root.style.colorScheme = selected === 'system' ? 'light dark' : selected;
	try {
		if (selected === 'system') localStorage.removeItem('theme');
		else localStorage.setItem('theme', selected);
	} catch {
		/* Theme selection also works without storage. */
	}
	document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
		button.setAttribute('aria-label', labels[selected]);
	});
};
const applyImmediately = () => {
	root.classList.add('theme-instant');
	apply();
	// Commit the new palette before restoring ordinary interaction transitions.
	void root.offsetWidth;
	root.classList.remove('theme-instant');
};
const cancel = () => {
	revision += 1;
	animation?.cancel();
	transition?.skipTransition();
	animation = undefined;
	transition = undefined;
	root.classList.remove('theme-transition');
	root.style.removeProperty('--theme-reveal-x');
	root.style.removeProperty('--theme-reveal-y');
};

document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((button) => {
	button.addEventListener('click', () => {
		const previous = selected;
		const interrupted = Boolean(transition);
		cancel();
		selected = themes[(themes.indexOf(selected) + 1) % themes.length];
		if (
			interrupted ||
			isDark(previous) === isDark(selected) ||
			reduced.matches ||
			document.visibilityState !== 'visible' ||
			!document.startViewTransition
		) {
			applyImmediately();
			return;
		}
		const id = revision;
		const rect = button.getBoundingClientRect();
		const x = rect.left + rect.width / 2;
		const y = rect.top + rect.height / 2;
		const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
		// Percentage geometry avoids a Chromium compositor pixel-scale mismatch on
		// Retina displays. circle() radius percentages use the normalized diagonal.
		const center = `${(x / innerWidth) * 100}% ${(y / innerHeight) * 100}%`;
		const radiusPercent = (radius / (Math.hypot(innerWidth, innerHeight) / Math.SQRT2)) * 100;
		root.style.setProperty('--theme-reveal-x', `${(x / innerWidth) * 100}%`);
		root.style.setProperty('--theme-reveal-y', `${(y / innerHeight) * 100}%`);
		root.classList.add('theme-transition');
		try {
			const current = document.startViewTransition(() => {
				if (id === revision) apply();
			});
			transition = current;
			void current.ready
				.then(() => {
					if (id !== revision) return;
					animation = root.animate(
						{ clipPath: [`circle(0% at ${center})`, `circle(${radiusPercent}% at ${center})`] },
						{
							duration: 380,
							easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
							fill: 'both',
							pseudoElement: '::view-transition-new(root)',
						},
					);
				})
				.catch(() => {
					if (id === revision) {
						cancel();
						applyImmediately();
					}
				});
			void current.finished
				.finally(() => {
					if (id === revision) cancel();
				})
				.catch(() => {});
		} catch {
			cancel();
			applyImmediately();
		}
	});
});
// A root snapshot temporarily removes its descendants from hit testing, even
// with pointer-events disabled on the transition overlay. Keep the toggle usable.
root.addEventListener('click', (event) => {
	if (!transition || event.target !== root || event.detail === 0) return;
	const button = [...document.querySelectorAll<HTMLElement>('[data-theme-toggle]')].find(
		(element) => {
			const rect = element.getBoundingClientRect();
			return (
				rect.width > 0 &&
				event.clientX >= rect.left &&
				event.clientX <= rect.right &&
				event.clientY >= rect.top &&
				event.clientY <= rect.bottom
			);
		},
	);
	if (button) {
		button.click();
		button.focus({ preventScroll: true });
	}
});
const finish = () => {
	cancel();
	applyImmediately();
};
reduced.addEventListener('change', finish);
dark.addEventListener('change', finish);
document.addEventListener('visibilitychange', () => {
	if (document.hidden) finish();
});
window.addEventListener('pagehide', finish);
applyImmediately();
