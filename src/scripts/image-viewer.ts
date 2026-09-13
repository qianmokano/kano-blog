const MIN_ZOOM_WIDTH = 240;
const ANIMATION_DURATION = 180;

type ViewerState = {
	source: HTMLImageElement | null;
	sourceRect: DOMRect | null;
	scrollX: number;
	scrollY: number;
	bodyOverflow: string;
	bodyPaddingRight: string;
	animation: Animation | null;
	revision: number;
};

const createViewer = () => {
	const dialog = document.createElement('dialog');
	dialog.className = 'image-viewer';
	dialog.setAttribute('aria-label', '图片预览');
	dialog.innerHTML = `
		<div class="image-viewer__content">
			<button class="image-viewer__close" type="button" aria-label="关闭图片预览">×</button>
			<img class="image-viewer__image" alt="" />
			<p class="image-viewer__caption"></p>
		</div>
	`;
	document.body.append(dialog);

	const viewerImage = dialog.querySelector<HTMLImageElement>('.image-viewer__image');
	const caption = dialog.querySelector<HTMLElement>('.image-viewer__caption');
	const closeButton = dialog.querySelector<HTMLButtonElement>('.image-viewer__close');
	const content = dialog.querySelector<HTMLElement>('.image-viewer__content');
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const state: ViewerState = {
		source: null,
		sourceRect: null,
		scrollX: 0,
		scrollY: 0,
		bodyOverflow: '',
		bodyPaddingRight: '',
		animation: null,
		revision: 0,
	};

	const sourceTransform = (sourceRect: DOMRect, targetRect: DOMRect) => ({
		transform: `translate(${sourceRect.left - targetRect.left}px, ${sourceRect.top - targetRect.top}px) scale(${sourceRect.width / targetRect.width}, ${sourceRect.height / targetRect.height})`,
		transformOrigin: 'top left',
	});

	const cancelAnimation = () => {
		state.animation?.cancel();
		state.animation = null;
	};

	const restorePagePosition = () => {
		const source = state.source;
		document.body.style.overflow = state.bodyOverflow;
		document.body.style.paddingRight = state.bodyPaddingRight;
		if (source?.isConnected) source.focus({ preventScroll: true });
		window.scrollTo({ left: state.scrollX, top: state.scrollY, behavior: 'instant' });
		requestAnimationFrame(() =>
			window.scrollTo({ left: state.scrollX, top: state.scrollY, behavior: 'instant' }),
		);
	};

	const finishClose = () => {
		cancelAnimation();
		if (dialog.open) dialog.close();
	};

	const closeViewer = async () => {
		if (!dialog.open) return;
		const revision = ++state.revision;
		cancelAnimation();
		const source = state.source;
		const sourceRect = source?.getBoundingClientRect();
		const isSourceVisible = Boolean(
			sourceRect &&
			sourceRect.width > 0 &&
			sourceRect.height > 0 &&
			sourceRect.bottom > 0 &&
			sourceRect.right > 0 &&
			sourceRect.top < window.innerHeight &&
			sourceRect.left < window.innerWidth,
		);

		if (!reducedMotion.matches && sourceRect && isSourceVisible && viewerImage) {
			const targetRect = viewerImage.getBoundingClientRect();
			state.animation = viewerImage.animate(
				[
					{ transform: 'none', transformOrigin: 'top left' },
					sourceTransform(sourceRect, targetRect),
				],
				{ duration: ANIMATION_DURATION, easing: 'ease-in', fill: 'forwards' },
			);
			try {
				await state.animation.finished;
			} catch {
				return;
			}
		}
		if (revision === state.revision) finishClose();
	};

	const useZoomSource = async (source: HTMLImageElement, revision: number) => {
		const zoomSource = source.dataset.zoomSrc;
		if (!zoomSource || !viewerImage) return;
		const preload = new Image();
		preload.src = zoomSource;
		try {
			await preload.decode();
		} catch {
			return;
		}
		if (revision === state.revision && dialog.open && state.source === source) {
			viewerImage.src = zoomSource;
		}
	};

	const openViewer = async (source: HTMLImageElement) => {
		if (!viewerImage || !caption || !closeButton) return;
		const revision = ++state.revision;
		cancelAnimation();
		state.source = source;
		state.sourceRect = source.getBoundingClientRect();
		state.scrollX = window.scrollX;
		state.scrollY = window.scrollY;
		state.bodyOverflow = document.body.style.overflow;
		state.bodyPaddingRight = document.body.style.paddingRight;

		const figureCaption = source
			.closest('figure')
			?.querySelector('figcaption')
			?.textContent?.trim();
		const captionText = figureCaption || source.alt.trim();
		viewerImage.src = source.currentSrc || source.src;
		viewerImage.alt = source.alt;
		caption.textContent = captionText;
		caption.hidden = !captionText;
		const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
		document.body.style.overflow = 'hidden';
		if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
		if (!dialog.open) dialog.showModal();

		if (!reducedMotion.matches) {
			const targetRect = viewerImage.getBoundingClientRect();
			if (state.sourceRect && targetRect.width > 0 && targetRect.height > 0) {
				state.animation = viewerImage.animate(
					[
						sourceTransform(state.sourceRect, targetRect),
						{ transform: 'none', transformOrigin: 'top left' },
					],
					{ duration: ANIMATION_DURATION, easing: 'ease-out' },
				);
			}
		}
		closeButton.focus({ preventScroll: true });

		void useZoomSource(source, revision);
	};

	closeButton?.addEventListener('click', () => void closeViewer());
	dialog.addEventListener('cancel', (event) => {
		event.preventDefault();
		void closeViewer();
	});
	dialog.addEventListener('click', (event) => {
		if (event.target === dialog || event.target === content) void closeViewer();
	});
	dialog.addEventListener('close', restorePagePosition);

	return openViewer;
};

const prose = document.querySelector<HTMLElement>('.article-grid > .prose');

if (prose) {
	let openViewer: ((source: HTMLImageElement) => Promise<void>) | undefined;

	const enhance = (image: HTMLImageElement) => {
		if (
			image.dataset.noZoom !== undefined ||
			image.closest('a') ||
			!image.alt.trim() ||
			image.naturalWidth < MIN_ZOOM_WIDTH ||
			image.getBoundingClientRect().width < MIN_ZOOM_WIDTH
		)
			return;

		openViewer ??= createViewer();
		image.classList.add('image-viewer-trigger');
		image.tabIndex = 0;
		image.setAttribute('role', 'button');
		image.setAttribute('aria-haspopup', 'dialog');
		image.setAttribute('aria-label', `查看大图：${image.alt.trim()}`);
		image.addEventListener('click', () => void openViewer?.(image));
		image.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				void openViewer?.(image);
			}
		});
	};

	prose.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
		if (image.complete) enhance(image);
		else image.addEventListener('load', () => enhance(image), { once: true });
	});
}

export {};
