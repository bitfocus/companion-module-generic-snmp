import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const baseConfig = await generateEslintConfig({
	enableTypescript: true,
})

export default [
	...baseConfig,
	{
		files: ['vitest.config.ts', '**/*.test.ts', '**/*.spec.ts'],
		languageOptions: {
			parserOptions: {
				project: ['./tsconfig.json', './tsconfig.node.json'],
			},
		},
		rules: {
			'n/no-unpublished-import': 'off',
			'@typescript-eslint/unbound-method': 'off',
		},
	},
]
