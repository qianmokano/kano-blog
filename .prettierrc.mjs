/** @type {import('prettier').Config} */
export default {
	plugins: ['prettier-plugin-astro'],
	printWidth: 100,
	singleQuote: true,
	useTabs: true,
	overrides: [{ files: '*.astro', options: { parser: 'astro' } }],
};
