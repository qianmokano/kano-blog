/**
 * 年份滚轮 Year Odometer — 归档年份的机械滚轮。
 *
 * 每个年份是一组四位滚轮:进入视口前所有轮盘停在 0,reveal 时
 * 各轮盘沿 0→9 的字条滚到自己的数字上,逐位错峰,像里程表走完
 * 一年的里程。等宽字体的表格数字保证轮盘严格对齐;滚完还原原始
 * 文本节点,选中与朗读都不受滚轮结构影响。与 reveal 系统一致,
 * 历史往返与减弱动效时保持安静。
 */

export {};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const headings = [...document.querySelectorAll<HTMLElement>('.archive-groups h2')].filter(
	(heading) => /^\d{4}$/.test(heading.textContent?.trim() ?? ''),
);

if (headings.length > 0 && !reducedMotion.matches && 'IntersectionObserver' in window) {
	const navigation = performance.getEntriesByType('navigation')[0] as
		PerformanceNavigationTiming | undefined;

	if (navigation?.type !== 'back_forward') {
		const buildWheel = (digit: number, index: number) => {
			const wheel = document.createElement('span');
			wheel.className = 'odometer-wheel';
			wheel.setAttribute('aria-hidden', 'true');
			const strip = document.createElement('span');
			strip.className = 'odometer-strip';
			// 字条由 0-9 十个字格纵排而成,每格独占一行高。
			for (let cell = 0; cell <= 9; cell += 1) {
				const glyph = document.createElement('span');
				glyph.className = 'odometer-cell';
				glyph.textContent = String(cell);
				strip.appendChild(glyph);
			}
			strip.style.setProperty('--odometer-target', String(digit));
			strip.style.transitionDelay = `${index * 70}ms`;
			wheel.appendChild(strip);
			return wheel;
		};

		const restore = (heading: HTMLElement, text: string) => {
			heading.textContent = text;
			heading.removeAttribute('aria-label');
			heading.classList.remove('odometer', 'is-odometer-rolling');
		};

		const observed = new Map<HTMLElement, string>();

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const heading = entry.target as HTMLElement;
					observer.unobserve(heading);
					heading.classList.add('is-odometer-rolling');
					const strips = heading.querySelectorAll<HTMLElement>('.odometer-strip');
					strips.forEach((strip) => {
						strip.style.transform = `translateY(calc(-1lh * ${strip.style.getPropertyValue('--odometer-target')}))`;
					});
					// 滚动完成后还原原始文本,消除滚轮结构带来的字偶距损失。
					const text = observed.get(heading) ?? '';
					window.setTimeout(() => restore(heading, text), strips.length * 70 + 1000);
				}
			},
			{ rootMargin: '0px 0px -7% 0px', threshold: 0.4 },
		);

		for (const heading of headings) {
			const text = heading.textContent?.trim() ?? '';
			observed.set(heading, text);
			heading.setAttribute('aria-label', text);
			heading.textContent = '';
			heading.classList.add('odometer');
			Array.from(text).forEach((char, index) => {
				heading.appendChild(buildWheel(Number.parseInt(char, 10), index));
			});
			observer.observe(heading);
		}

		window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
	}
}
