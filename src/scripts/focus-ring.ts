/**
 * 焦点描边 — 键盘焦点的全局描边环。
 *
 * 焦点的可见性第一次获得与指针同级的工艺:焦点环沿元素周长
 * 顺时针勾勒出现(上→右→下→左),在焦点目标之间滑行而不是
 * 消失重现。原生 outline 作为无 JS、减弱动效与顶层 dialog
 * 内的回退完整保留。
 *
 * 环使用文档坐标 absolute 定位,随页面滚动自然跟随,无需滚动
 * 追踪;仅指针按下后隐藏,按下 Tab 立即恢复。
 */

export {};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const OFFSET = 4;

if (!reducedMotion.matches) {
	const ring = document.createElement('div');
	ring.className = 'focus-trace is-collapsed';
	ring.setAttribute('aria-hidden', 'true');
	ring.append(
		document.createElement('i'),
		document.createElement('i'),
		document.createElement('i'),
		document.createElement('i'),
	);
	document.body.appendChild(ring);

	let visible = false;
	let suppressedByPointer = false;
	let current: Element | null = null;

	const place = (element: Element) => {
		const rect = element.getBoundingClientRect();
		ring.style.width = `${rect.width + OFFSET * 2}px`;
		ring.style.height = `${rect.height + OFFSET * 2}px`;
		ring.style.transform = `translate(${rect.left + window.scrollX - OFFSET}px, ${rect.top + window.scrollY - OFFSET}px)`;
	};

	const show = (element: Element) => {
		const reappearing = !visible;
		visible = true;
		current = element;
		document.documentElement.classList.add('has-focus-trace');
		if (reappearing) {
			// 先静止落位,再从零描边;目标之间移动则直接滑行。
			ring.classList.remove('is-live');
			ring.classList.add('is-collapsed');
			place(element);
			void ring.offsetWidth;
			ring.classList.add('is-visible', 'is-live');
			ring.classList.remove('is-collapsed');
		} else {
			place(element);
		}
	};

	const hide = () => {
		visible = false;
		current = null;
		ring.classList.remove('is-visible');
		ring.classList.add('is-collapsed');
		document.documentElement.classList.remove('has-focus-trace');
	};

	document.addEventListener('focusin', (event) => {
		if (suppressedByPointer) return;
		const element = event.target;
		if (!(element instanceof HTMLElement) || !element.matches(':focus-visible')) return;
		show(element);
	});

	document.addEventListener('focusout', (event) => {
		if (!event.relatedTarget) hide();
	});

	window.addEventListener(
		'pointerdown',
		() => {
			suppressedByPointer = true;
			if (visible) hide();
		},
		{ capture: true, passive: true },
	);

	window.addEventListener(
		'keydown',
		(event) => {
			if (event.key === 'Tab') suppressedByPointer = false;
		},
		{ capture: true },
	);

	window.addEventListener('resize', () => {
		if (visible && current) place(current);
	});
}
