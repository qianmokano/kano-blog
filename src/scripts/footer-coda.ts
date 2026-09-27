/**
 * 页脚终章 Footer Coda — 页面结尾的收束仪式。
 *
 * 页脚进入视口时,分界线以原本的发丝色从左向右画出自己——
 * 与章节标题的自绘线同一套语法,终点与原设计完全一致,只是
 * 有了来处。武装(coda-armed)后静态边线退场;画完一次即安静,
 * 历史往返与减弱动效时保持静态分界线,不演。
 */

export {};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const footer = document.querySelector<HTMLElement>('.site-footer');
if (footer && !reducedMotion.matches && 'IntersectionObserver' in window) {
	const navigation = performance.getEntriesByType('navigation')[0] as
		PerformanceNavigationTiming | undefined;
	if (navigation?.type !== 'back_forward') {
		footer.classList.add('coda-armed');
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return;
				footer.classList.add('is-revealed');
				observer.disconnect();
			},
			{ rootMargin: '0px 0px -5% 0px', threshold: 0.2 },
		);
		observer.observe(footer);
		window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
	}
}
