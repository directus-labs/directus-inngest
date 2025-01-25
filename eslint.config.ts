import directusConfig from '@directus/eslint-config';

export default directusConfig({
	vue: true,
	typescript: true,
	eslintConfig: [{
		ignores: ['**/*.md'],
	}, {
		files: ['**/*.ts', '**/*.vue'],
		rules: {
			'import/first': 'off',
		},
	}],
});
