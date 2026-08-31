import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default [
	{
		ignores: ['.astro/**', 'coverage/**', 'dist/**', 'node_modules/**', 'playwright-report/**'],
	},
	...tseslint.configs.recommended.map((config) => ({
		...config,
		files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
	})),
	...astro.configs.recommended,
	{
		files: ['**/*.astro'],
		rules: {
			'astro/no-set-html-directive': 'off',
		},
	},
];
