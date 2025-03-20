import directusConfig from '@directus/eslint-config';

export default [
	...directusConfig,
	{
		ignores: ['**/*.md'],
	},
	{
		files: ['**/*.ts', '**/*.vue'],
		rules: {
			'import/first': 'off',
		},
	}
];
