/**
 * 逐字引力 Card Sweep — 列表卡片标题的字重扫掠。
 *
 * 与 wordmark 同一套语法:悬停或键盘焦点进入卡片行时,标题的
 * 字形沿阅读方向逐字加重再回落,像指针经过时字重被"吸"过去。
 *
 * 字重上升会加大字形的字宽,直接扫掠会让标题在悬停时"长胖"。
 * 这里用钉宽手法消除布局位移:字体就绪后量出每个字形在基准
 * 字重下的宽度并钉死,加粗只在固定的格子里发生——列表反馈的
 * "文字保持静止"约定因此成立。CJK 回退字体没有可变字重,自动
 * 退出这套语法。
 */

import { splitIntoChars } from '@/scripts/kinetic-type';

export {};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (!reducedMotion.matches) {
	const groups = [
		...document.querySelectorAll<HTMLElement>(
			'.content-card :is(h2, h3) a [data-transition-title-source]',
		),
	].map((title) => {
		// 链接可访问名由拆分后的字形文本自然拼合,无需额外标注。
		const chars = splitIntoChars(title);
		chars.forEach((char) => char.classList.add('sweep-char'));
		return chars;
	});

	if (groups.length > 0) {
		/* 先解除旧钉宽再重测,避免宽度逐轮叠加。 */
		const pinWidths = () => {
			for (const chars of groups) {
				for (const char of chars) char.style.width = '';
			}
			for (const chars of groups) {
				for (const char of chars) {
					char.style.width = `${char.getBoundingClientRect().width}px`;
				}
			}
		};

		if (document.fonts?.ready) void document.fonts.ready.then(pinWidths);
		else pinWidths();

		let resizeTimer = 0;
		window.addEventListener('resize', () => {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(pinWidths, 150);
		});
	}
}
