const RESET_DELAY = 1600;

export {};

type CopyState = 'idle' | 'pending' | 'success' | 'failure';

function setCopyState(button: HTMLButtonElement, status: HTMLElement, state: CopyState) {
	button.dataset.copyState = state;
	button.disabled = state === 'pending';

	const labels: Record<CopyState, string> = {
		idle: '复制代码',
		pending: '正在复制代码',
		success: '代码已复制',
		failure: '复制失败，重试',
	};
	button.setAttribute('aria-label', labels[state]);
	const visibleLabel = button.querySelector<HTMLElement>('.copy-code__label');
	if (visibleLabel) {
		visibleLabel.textContent =
			state === 'pending'
				? '复制中'
				: state === 'success'
					? '已复制'
					: state === 'failure'
						? '复制失败'
						: '复制';
	}
	status.textContent =
		state === 'success' ? '已复制' : state === 'failure' ? '复制失败，请重试' : '';
}

function enhanceCodeBlock(pre: HTMLElement) {
	if (pre.parentElement?.classList.contains('code-block')) return;

	const code = pre.querySelector('code');
	if (!code) return;

	const shell = document.createElement('div');
	shell.className = 'code-block';
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'copy-code';
	button.dataset.copyState = 'idle';
	const label = document.createElement('span');
	label.className = 'copy-code__label';
	label.textContent = '已复制';
	button.append(label);
	const status = document.createElement('span');
	status.className = 'sr-only';
	status.setAttribute('role', 'status');
	status.setAttribute('aria-live', 'polite');
	status.setAttribute('aria-atomic', 'true');
	setCopyState(button, status, 'idle');

	const leftEdge = document.createElement('span');
	leftEdge.className = 'code-block__edge code-block__edge--left';
	leftEdge.setAttribute('aria-hidden', 'true');
	const rightEdge = document.createElement('span');
	rightEdge.className = 'code-block__edge code-block__edge--right';
	rightEdge.setAttribute('aria-hidden', 'true');

	pre.before(shell);
	shell.append(pre, leftEdge, rightEdge, status, button);

	let operation = 0;
	let resetTimer: number | undefined;
	button.addEventListener('click', async () => {
		const currentOperation = ++operation;
		window.clearTimeout(resetTimer);
		setCopyState(button, status, 'pending');
		try {
			await navigator.clipboard.writeText(code.textContent ?? '');
			if (currentOperation !== operation) return;
			setCopyState(button, status, 'success');
		} catch {
			if (currentOperation !== operation) return;
			setCopyState(button, status, 'failure');
		}
		resetTimer = window.setTimeout(() => {
			if (currentOperation !== operation) return;
			setCopyState(button, status, 'idle');
		}, RESET_DELAY);
	});

	let frame = 0;
	const updateOverflow = () => {
		frame = 0;
		const maxScroll = Math.max(pre.scrollWidth - pre.clientWidth, 0);
		const overflowing = maxScroll > 1;
		shell.toggleAttribute('data-overflow-left', overflowing && pre.scrollLeft > 1);
		shell.toggleAttribute('data-overflow-right', overflowing && pre.scrollLeft < maxScroll - 1);
	};
	const scheduleOverflowUpdate = () => {
		if (frame) return;
		frame = window.requestAnimationFrame(updateOverflow);
	};
	pre.addEventListener('scroll', scheduleOverflowUpdate, { passive: true });
	const resizeObserver = new ResizeObserver(scheduleOverflowUpdate);
	resizeObserver.observe(pre);
	resizeObserver.observe(code);
	document.fonts?.ready.then(scheduleOverflowUpdate);
	scheduleOverflowUpdate();
}

document.querySelectorAll<HTMLElement>('.prose pre').forEach(enhanceCodeBlock);
