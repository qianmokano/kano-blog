import { getImage } from 'astro:assets';
import type { CollectionEntry } from 'astro:content';

export interface SocialImage {
	src: string;
	width: number;
	height: number;
	alt: string;
	type: string;
}

export async function getSocialImage(
	entry: CollectionEntry<'blog'> | CollectionEntry<'projects'>,
): Promise<SocialImage> {
	const { cover, coverAlt, title } = entry.data;
	const image = cover
		? await getImage({ src: cover, width: 1200, height: 630, fit: 'cover', format: 'png' })
		: undefined;
	return {
		src: image?.src ?? `/og/${entry.collection}/${entry.id}.png`,
		width: 1200,
		height: 630,
		alt: cover ? (coverAlt ?? `${title}的封面`) : `${title} · Kano Blog`,
		type: 'image/png',
	};
}
