import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

export interface OgCard {
	title: string;
	label: string;
	detail: string;
}

function escapeXml(value: string) {
	return value.replace(/[&<>"']/g, (character) => {
		return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]!;
	});
}

// CJK glyphs use roughly one em. Use a conservative Latin estimate for wrapping.
export function wrapTitle(text: string, maxWidth = 17, maxLines = 3) {
	const characters = Array.from(text.replace(/\s+/g, ' ').trim());
	const measure = (character: string) =>
		/[MWmw]/.test(character) ? 1 : /[\u0020-\u007e]/.test(character) ? 0.65 : 1;
	const totalWidth = characters.reduce((sum, character) => sum + measure(character), 0);
	const lineCount = Math.min(maxLines, Math.max(1, Math.ceil(totalWidth / maxWidth)));
	const balancedWidth = Math.min(maxWidth, Math.ceil(totalWidth / lineCount));
	const lines: string[] = [];
	let line = '';
	let width = 0;
	for (const character of characters) {
		const nextWidth = measure(character);
		// Keep closing punctuation with its preceding text rather than on an orphan line.
		if (width + nextWidth > balancedWidth && !/[，。！？、：；）》”’!?.,:;]/.test(character)) {
			lines.push(line.trim());
			line = '';
			width = 0;
			if (lines.length === maxLines) {
				lines[maxLines - 1] =
					Array.from(lines[maxLines - 1])
						.slice(0, -1)
						.join('') + '…';
				return lines;
			}
		}
		line += character;
		width += nextWidth;
	}
	if (line) lines.push(line.trim());
	return lines;
}

export function renderOgCard({ title, label, detail }: OgCard) {
	const lines = wrapTitle(title);
	const firstBaseline = lines.length === 1 ? 310 : lines.length === 2 ? 265 : 225;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
		<rect width="1200" height="630" fill="#fafafa"/>
		<rect x="0" width="14" height="630" fill="#111111"/>
		<g font-family="Noto Sans SC" fill="#111111">
			<text x="72" y="88" font-size="28">Kano Blog</text>
			<text x="1128" y="88" font-size="22" text-anchor="end" fill="#696969">${escapeXml(label)}</text>
			<path d="M72 125H1128" stroke="#d7d7d7"/>
			${lines.map((line, index) => `<text x="72" y="${firstBaseline + index * 82}" font-size="60">${escapeXml(line)}</text>`).join('')}
			<text x="72" y="491" font-size="23" fill="#696969">${escapeXml(wrapTitle(detail, 42, 1)[0] ?? '')}</text>
			<path d="M72 535H1128" stroke="#d7d7d7"/>
			<text x="72" y="583" font-size="22">qianmokano</text>
			<text x="1128" y="583" font-size="22" text-anchor="end" fill="#696969">blog.kanojyo.de</text>
		</g>
	</svg>`;
	// Bundled font keeps local and CI builds identical without network or system fonts.
	return new Resvg(svg, {
		font: {
			loadSystemFonts: false,
			fontFiles: [resolve('src/assets/fonts/NotoSansSC-Regular.otf')],
			defaultFontFamily: 'Noto Sans SC',
		},
	})
		.render()
		.asPng();
}
