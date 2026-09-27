/**
 * 游丝 Navline — 桌面导航的共享发丝线。
 *
 * 悬停或键盘焦点落在导航链接上时,一条发丝线滑到该链接正下方;
 * 在链接之间移动时它直接滑行,离开导航则向最后一端收缩消失。
 * 当前页的常驻下划线保持不动——游丝只表达"指针/焦点的意图",
 * 不抢 aria-current 的位置语义。仅精细指针、非减弱动效时启用。
 */

export {};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

const nav = document.querySelector<HTMLElement>('.desktop-nav');
if (nav && !reducedMotion.matches) {
	const links = [...nav.querySelectorAll<HTMLAnchorElement>('a')];
	if (links.length > 0) {
		let active: HTMLAnchorElement | undefined;
		let visible = false;

		const place = (link: HTMLAnchorElement) => {
			nav.style.setProperty('--navline-x', `${link.offsetLeft}px`);
			nav.style.setProperty('--navline-width', `${link.offsetWidth}px`);
		};

		const show = (link: HTMLAnchorElement) => {
			const reappearing = !visible || active !== link;
			active = link;
			if (!visible) {
				// 先静止落位,再淡入;链接之间移动则直接滑行。
				nav.classList.remove('is-navline-live');
				place(link);
				void getComputedStyle(nav, '::before').transform;
				visible = true;
				nav.classList.add('has-navline');
				if (reappearing) nav.classList.add('is-navline-live');
			} else {
				place(link);
			}
		};

		const hide = () => {
			visible = false;
			active = undefined;
			nav.classList.remove('has-navline');
		};

		for (const link of links) {
			link.addEventListener('pointerenter', (event) => {
				if (event.pointerType === 'touch' || !finePointer.matches) return;
				show(link);
			});
			link.addEventListener('focusin', () => {
				if (!link.matches(':focus-visible')) return;
				show(link);
			});
		}
		nav.addEventListener('pointerleave', hide);
		nav.addEventListener('focusout', (event) => {
			if (event.relatedTarget instanceof Node && nav.contains(event.relatedTarget)) return;
			hide();
		});
		finePointer.addEventListener('change', hide);
		window.addEventListener('resize', () => {
			if (visible && active) place(active);
		});
		window.addEventListener('pagehide', hide, { once: true });
	}
}
