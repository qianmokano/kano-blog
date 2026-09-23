/**
 * 磁吸按钮 — 指针在按钮范围内时,按钮向指针方向轻微牵引,
 * 离开后弹簧回位。最大位移 3px:足够被手感察觉,不足以
 * 打破单色界面的克制。仅精细指针、非减弱动效时启用。
 */

export {};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

const MAX_OFFSET = 3;
const LERP = 0.22;
const EPSILON = 0.05;

class MagneticButton {
	private currentX = 0;
	private currentY = 0;
	private targetX = 0;
	private targetY = 0;
	private frame = 0;
	private running = false;

	constructor(private element: HTMLElement) {
		element.addEventListener('pointermove', this.onPointerMove);
		element.addEventListener('pointerleave', this.release);
		element.addEventListener('pointerdown', this.release);
	}

	private onPointerMove = (event: PointerEvent) => {
		if (event.pointerType === 'touch') return;
		const rect = this.element.getBoundingClientRect();
		const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
		const relativeY = (event.clientY - rect.top) / rect.height - 0.5;
		this.targetX = relativeX * 2 * MAX_OFFSET;
		this.targetY = relativeY * 2 * MAX_OFFSET;
		this.wake();
	};

	private release = () => {
		this.targetX = 0;
		this.targetY = 0;
		this.wake();
	};

	private wake = () => {
		if (this.running) return;
		this.running = true;
		this.frame = window.requestAnimationFrame(this.step);
	};

	private step = () => {
		this.currentX += (this.targetX - this.currentX) * LERP;
		this.currentY += (this.targetY - this.currentY) * LERP;

		const settled =
			Math.abs(this.currentX - this.targetX) < EPSILON &&
			Math.abs(this.currentY - this.targetY) < EPSILON;
		if (settled) {
			this.currentX = this.targetX;
			this.currentY = this.targetY;
			this.running = false;
		}

		if (this.currentX === 0 && this.currentY === 0) {
			this.element.style.transform = '';
		} else {
			this.element.style.transform = `translate(${this.currentX.toFixed(2)}px, ${this.currentY.toFixed(2)}px)`;
		}
		if (!settled) this.frame = window.requestAnimationFrame(this.step);
	};

	destroy() {
		window.cancelAnimationFrame(this.frame);
		this.element.style.transform = '';
	}
}

const instances: MagneticButton[] = [];

const setup = () => {
	if (reducedMotion.matches || !finePointer.matches) return;
	document
		.querySelectorAll<HTMLElement>('[data-magnetic]')
		.forEach((element) => instances.push(new MagneticButton(element)));
};

setup();
window.addEventListener(
	'pagehide',
	() => {
		instances.forEach((instance) => instance.destroy());
		instances.length = 0;
	},
	{ once: true },
);
