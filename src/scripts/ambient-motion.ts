export {};

const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const previews = [...document.querySelectorAll<HTMLElement>('.project-preview')];

const reset = () => {
	previews.forEach((preview) => preview.removeAttribute('data-light'));
};

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

motion.addEventListener('change', reset);
pointer.addEventListener('change', reset);
window.addEventListener('pagehide', reset);
