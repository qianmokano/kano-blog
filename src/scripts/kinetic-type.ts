/**
 * 墨场 Ink Field — 可变字重磁场。
 *
 * Hero 大标题的每个字形是一枚独立的弹簧:指针接近时字重沿
 * Inter Variable 的 wght 轴上升并轻微上浮,离开后弹回基准。
 * 不引入任何颜色——动效只由字重与位移构成,与站点的单色
 * 排版语言一致。CJK 回退字体没有可变字重,统一获得位移。
 *
 * 同时负责把 wordmark 拆成字形,扫掠本身由 CSS 过渡完成。
 */

export {};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

/** 把元素的文本拆成逐字形的 span,保留换行与空白为文本节点。 */
const splitIntoChars = (element: HTMLElement): HTMLSpanElement[] => {
	const text = element.textContent ?? '';
	const fragment = document.createDocumentFragment();
	const chars: HTMLSpanElement[] = [];
	let index = 0;

	for (const char of Array.from(text)) {
		if (char === '\n' || char === ' ' || char === '\t') {
			fragment.appendChild(document.createTextNode(char));
			continue;
		}
		const span = document.createElement('span');
		span.className = 'field-char';
		span.style.setProperty('--char-index', String(index));
		span.textContent = char;
		fragment.appendChild(span);
		chars.push(span);
		index += 1;
	}

	element.textContent = '';
	element.appendChild(fragment);
	return chars;
};

/* ============== Wordmark 字重扫掠(纯 CSS 驱动) ============== */
const setupWordmark = () => {
	const wordmarkText = document.querySelector<HTMLElement>('.wordmark-text');
	if (!wordmarkText || reducedMotion.matches) return;
	// 链接本身已有 aria-label,拆出的字形对辅助技术隐藏。
	wordmarkText.setAttribute('aria-hidden', 'true');
	splitIntoChars(wordmarkText);
};

/* ============== Hero 可变字重磁场 ============== */
const BASE_LIFT_EM = 0.05;
const WEIGHT_RANGE = 200;
const POINTER_LERP = 0.16;
const FIELD_LERP = 0.2;
const EPSILON = 0.001;

const setupHeroField = () => {
	const typewriter = document.querySelector<HTMLElement>('[data-typewriter]');
	const hero = document.querySelector<HTMLElement>('.home-hero');
	if (!typewriter || !hero || reducedMotion.matches || !finePointer.matches) return;

	const start = () => {
		const chars = splitIntoChars(typewriter);
		if (chars.length === 0) return;

		const baseWeight = Number.parseFloat(getComputedStyle(chars[0]).fontWeight) || 570;
		let fontSize = Number.parseFloat(getComputedStyle(typewriter).fontSize) || 64;
		let centers: Array<{ x: number; y: number }> = [];
		// 每个字形当前的影响强度,逐帧向目标值收敛。
		const influences = new Float32Array(chars.length);
		let running = false;
		let frame = 0;
		let pointerActive = false;
		let heroVisible = true;
		const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

		const measure = () => {
			fontSize = Number.parseFloat(getComputedStyle(typewriter).fontSize) || fontSize;
			// 文档坐标:滚动不改变字形与指针的相对位置,无需滚动时重测。
			centers = chars.map((char) => {
				const rect = char.getBoundingClientRect();
				return {
					x: rect.left + window.scrollX + rect.width / 2,
					y: rect.top + window.scrollY + rect.height / 2,
				};
			});
		};

		const writeFrame = () => {
			pointer.x += (pointer.targetX - pointer.x) * POINTER_LERP;
			pointer.y += (pointer.targetY - pointer.y) * POINTER_LERP;

			const sigma = fontSize * 1.15;
			const falloff = 2 * sigma * sigma;
			let peak = 0;

			for (let index = 0; index < chars.length; index += 1) {
				let target = 0;
				if (pointerActive && heroVisible) {
					const dx = pointer.x - centers[index].x;
					const dy = pointer.y - centers[index].y;
					target = Math.exp(-(dx * dx + dy * dy) / falloff);
				}
				const next = influences[index] + (target - influences[index]) * FIELD_LERP;
				influences[index] = next < EPSILON ? 0 : next;
				if (influences[index] > peak) peak = influences[index];

				const influence = influences[index];
				const char = chars[index];
				if (influence === 0 && char.style.transform === '' && !char.style.fontVariationSettings)
					continue;
				if (influence === 0) {
					char.style.transform = '';
					char.style.fontVariationSettings = '';
					continue;
				}
				const weight = Math.min(900, baseWeight + influence * WEIGHT_RANGE);
				char.style.fontVariationSettings = `'wght' ${weight.toFixed(1)}`;
				char.style.transform = `translateY(${(-influence * BASE_LIFT_EM).toFixed(4)}em)`;
			}

			// 场完全静息时挂起循环,等待下一次指针移动唤醒。
			if (!pointerActive && peak < EPSILON) {
				running = false;
				return;
			}
			frame = window.requestAnimationFrame(writeFrame);
		};

		const wake = () => {
			if (running) return;
			running = true;
			frame = window.requestAnimationFrame(writeFrame);
		};

		const updatePointer = (event: PointerEvent) => {
			if (event.pointerType === 'touch') return;
			const rect = hero.getBoundingClientRect();
			const margin = fontSize * 2;
			pointerActive =
				event.clientX >= rect.left - margin &&
				event.clientX <= rect.right + margin &&
				event.clientY >= rect.top - margin &&
				event.clientY <= rect.bottom + margin;
			pointer.targetX = event.clientX + window.scrollX;
			pointer.targetY = event.clientY + window.scrollY;
			wake();
		};

		measure();
		void document.fonts?.ready.then(measure);

		let resizeTimer = 0;
		window.addEventListener('resize', () => {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(measure, 150);
		});
		window.addEventListener('pointermove', updatePointer, { passive: true });
		document.addEventListener('pointerleave', () => {
			pointerActive = false;
		});
		new IntersectionObserver((entries) => {
			heroVisible = entries[0]?.isIntersecting ?? true;
		}).observe(hero);
		window.addEventListener('pagehide', () => window.cancelAnimationFrame(frame), {
			once: true,
		});
	};

	// 打字机完成后才拆分标题;已完成或跳过时由页面脚本置位。
	if (document.documentElement.dataset.heroTyped === 'true') {
		start();
	} else {
		document.addEventListener('kano:hero-ready', start, { once: true });
	}
};

/* ============== 内页标题字距沉淀 ============== */
/* 内页大标题的字形从宽字距、轻字重沉淀回站点标志性的紧排与
   终态字重:字距轴对 CJK 与 Latin 同样有效,字重轴在可变字体
   覆盖的字符上自然增强。完成后还原原始文本节点,选中与朗读
   都不受拆分影响。 */
const SETTLE_TRACKING = '0.14em';
const SETTLE_FINAL_TRACKING = '-0.035em';
const SETTLE_LIGHT = 300;

const setupTitleSettle = () => {
	const title = document.querySelector<HTMLElement>('.page-header h1, .prose-header h1');
	if (!title || title.childElementCount > 0 || reducedMotion.matches) return;

	const navigation = performance.getEntriesByType('navigation')[0] as
		PerformanceNavigationTiming | undefined;
	// 历史往返时保持安静,与 reveal 系统一致。
	if (navigation?.type === 'back_forward') return;

	const text = title.textContent ?? '';
	if (!text.trim()) return;

	const baseWeight = Number.parseFloat(getComputedStyle(title).fontWeight) || 590;
	title.setAttribute('aria-label', text.trim());
	const chars = splitIntoChars(title);
	if (chars.length === 0) return;
	chars.forEach((char) => char.setAttribute('aria-hidden', 'true'));
	title.classList.add('settle-title');

	for (const char of chars) {
		char.style.fontVariationSettings = `'wght' ${SETTLE_LIGHT}`;
		char.style.letterSpacing = SETTLE_TRACKING;
	}

	const settle = () => {
		window.requestAnimationFrame(() => {
			for (const char of chars) {
				char.style.fontVariationSettings = `'wght' ${baseWeight}`;
				char.style.letterSpacing = SETTLE_FINAL_TRACKING;
			}
		});
	};
	if (document.fonts?.ready) void document.fonts.ready.then(settle);
	else settle();

	// 沉淀完成后还原原始文本节点,消除拆分带来的字偶距损失。
	const duration = chars.length * 28 + 760;
	window.setTimeout(() => {
		title.classList.remove('settle-title');
		title.textContent = text;
		title.removeAttribute('aria-label');
	}, duration);
};

setupWordmark();
setupHeroField();
setupTitleSettle();
