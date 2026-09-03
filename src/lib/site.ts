export const siteConfig = {
	name: 'Kano',
	brandName: 'Kano Blog',
	title: 'Kano Blog - Kano的博客',
	author: 'qianmokano',
	tagline: '记录技术、项目与持续探索。',
	description: 'Kano 的个人博客，记录软件开发、项目实践与日常思考。',
	url: 'https://blog.kanojyo.de',
	locale: 'zh-CN',
	timeZone: 'Asia/Shanghai',
	socials: {
		github: 'https://github.com/qianmokano',
	},
	navigation: [
		{ href: '/blog/', label: '文章' },
		{ href: '/notes/', label: '笔记' },
		{ href: '/projects/', label: '项目' },
		{ href: '/archive/', label: '归档' },
		{ href: '/about/', label: '关于' },
	],
	giscus: {
		repo: 'qianmokano/kano-blog',
		category: 'Announcements',
	},
} as const;

export const POSTS_PER_PAGE = 10;
