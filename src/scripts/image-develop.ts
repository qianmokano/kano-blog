/**
 * 暗房显影 Image Develop — 图片加载的显影过程。
 *
 * 尚未缓存的图片从模糊、去色、微亮的"底片"状态显影到清晰:
 * 像暗房里相纸渐渐浮出影像。已缓存(complete)的图片直接清晰,
 * 显影只发生在真实等待加载的时刻。参与视图过渡形变的文章封面
 * 跳过——它的"出现"已经由共享元素过渡表达。过渡结束后移除
 * 滤镜,把合成层还给页面。
 */

export {};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (!reducedMotion.matches) {
	const images = [
		...document.querySelectorAll<HTMLImageElement>(
			'.project-preview img, .friend-avatar img, .prose img, .content-cover img:not([data-transition-cover-target])',
		),
	];

	for (const image of images) {
		// 懒加载图片在视口外时 complete 为 true 但尚无像素,以 naturalWidth 为准。
		if (image.complete && image.naturalWidth > 0) continue;
		image.dataset.develop = 'pending';
		const develop = () => {
			image.dataset.develop = 'done';
			image.addEventListener(
				'transitionend',
				() => {
					delete image.dataset.develop;
				},
				{ once: true },
			);
		};
		if (!image.complete && typeof image.decode === 'function') {
			image.decode().then(develop, develop);
		} else {
			image.addEventListener('load', develop, { once: true });
			image.addEventListener('error', develop, { once: true });
		}
	}
}
