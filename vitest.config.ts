import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		exclude: ['**/node_modules/**', '**/dist/**'],
		environment: 'node',
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			// text for the CI log, lcov for Codecov, html for browsing locally
			reporter: ['text', 'lcov', 'html'],
			reportsDirectory: './coverage',
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/*.test.ts',
				// Type-only modules, no runtime code to exercise
				'src/types.ts',
				'src/net-snmp.d.ts',
			],
		},
	},
})
