export {};

const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const hero = document.querySelector<HTMLElement>('.home-hero');
const orbit = document.querySelector<HTMLElement>('.hero-orbit');
const field = document.querySelector<HTMLElement>('.orbit-field');
const previews = [...document.querySelectorAll<HTMLElement>('.project-preview')];
let frame = 0;

const reset = () => {
	cancelAnimationFrame(frame);
	field?.style.removeProperty('--orbit-x');
	field?.style.removeProperty('--orbit-y');
	previews.forEach((preview) => preview.removeAttribute('data-light'));
};

hero?.addEventListener('pointermove', (event) => {
	if (motion.matches || !pointer.matches || event.pointerType === 'touch') return;
	cancelAnimationFrame(frame);
	frame = requestAnimationFrame(() => {
		const rect = hero.getBoundingClientRect();
		field?.style.setProperty(
			'--orbit-x',
			`${(event.clientX / rect.width - rect.left / rect.width - 0.5) * 22}deg`,
		);
		field?.style.setProperty(
			'--orbit-y',
			`${-((event.clientY - rect.top) / rect.height - 0.5) * 16}deg`,
		);
	});
});
hero?.addEventListener('pointerleave', reset);

previews.forEach((preview) => {
	preview.addEventListener('pointermove', (event) => {
		if (motion.matches || !pointer.matches || event.pointerType === 'touch') return;
		const rect = preview.getBoundingClientRect();
		preview.dataset.light = 'active';
		preview.style.setProperty('--light-x', `${event.clientX - rect.left}px`);
		preview.style.setProperty('--light-y', `${event.clientY - rect.top}px`);
	});
	preview.addEventListener('pointerleave', () => {
		preview.dataset.light = '';
	});
});

let inView = true;
const pause = () => orbit?.toggleAttribute('data-paused', !inView || document.hidden);
if (orbit && 'IntersectionObserver' in window) {
	new IntersectionObserver(([entry]) => {
		inView = entry.isIntersecting;
		pause();
	}).observe(orbit);
}
document.addEventListener('visibilitychange', pause);
motion.addEventListener('change', reset);
pointer.addEventListener('change', reset);
window.addEventListener('pagehide', reset);
