import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/unit/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/lib/content-utils.ts'],
			reporter: ['text', 'html'],
			thresholds: {
				branches: 80,
				functions: 80,
				lines: 80,
				statements: 80,
			},
		},
	},
});
