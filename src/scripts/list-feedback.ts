export {};

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

document.querySelectorAll<HTMLElement>('.content-list').forEach((list) => {
	const cards = [...list.querySelectorAll<HTMLElement>(':scope > .content-card')];
	if (cards.length === 0) return;

	let hovered: HTMLElement | undefined;
	let focused: HTMLElement | undefined;
	list.classList.add('has-list-feedback');

	const update = () => {
		const card = focused ?? hovered;
		if (!card) {
			list.removeAttribute('data-feedback-visible');
			return;
		}
		list.style.setProperty('--feedback-y', `${card.offsetTop}px`);
		list.style.setProperty('--feedback-height', `${card.offsetHeight}px`);
		if (!list.hasAttribute('data-feedback-visible')) {
			// Place the first highlight before fading it in; only move between rows.
			void getComputedStyle(list, '::before').transform;
			list.setAttribute('data-feedback-visible', '');
		}
	};

	for (const card of cards) {
		card.addEventListener('pointerenter', (event) => {
			if (event.pointerType === 'touch' || !finePointer.matches) return;
			hovered = card;
			update();
		});
		card.addEventListener('focusin', (event) => {
			if (!(event.target instanceof Element) || !event.target.matches(':focus-visible')) return;
			focused = card;
			update();
		});
	}
	list.addEventListener('pointerleave', () => {
		hovered = undefined;
		update();
	});
	list.addEventListener('focusout', (event) => {
		if (event.relatedTarget instanceof Node && focused?.contains(event.relatedTarget)) return;
		focused = undefined;
		// The next focusin runs before this microtask, preserving a continuous slide.
		queueMicrotask(update);
	});
	finePointer.addEventListener('change', () => {
		hovered = undefined;
		update();
	});
	if (typeof ResizeObserver !== 'undefined') {
		const observer = new ResizeObserver(update);
		observer.observe(list);
		cards.forEach((card) => observer.observe(card));
	} else {
		window.addEventListener('resize', update);
	}
	window.addEventListener('pagehide', () => {
		hovered = undefined;
		focused = undefined;
		update();
	});
});
