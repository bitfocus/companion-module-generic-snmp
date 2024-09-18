import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const baseConfig = async () => {
	await generateEslintConfig({})
}

const customConfig = [
	...baseConfig,
	{
		languageOptions: {
			sourceType: 'module',
		},
	},
]

export default customConfig
