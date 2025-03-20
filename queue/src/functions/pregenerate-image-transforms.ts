import type { DirectusContext } from '../types/services';
import { inngest } from '../inngest/client';

export default inngest.createFunction(
	{
		id: 'pregenerate-image-transforms',
		name: 'Pre-generate images in different sizes',
		description: 'This flow will generate image transforms in the preset sizes whenever an asset is uploaded.',
		concurrency: 1,

	},
	{ event: 'directus/files.upload' },
	async ({ event, step, directus }) => {
		const { services, getSchema } = directus as DirectusContext;
		const { AssetsService, SettingsService } = services;

		const schema = await getSchema();

		// We're using the assets service to get the assets and apply the image transforms
		const assetsService = new AssetsService({
			schema,
			accountability: event.data.accountability,
		});

		// We're using the settings service to get the preset image transforms
		const settingsService = new SettingsService({
			schema,
			accountability: event.data.accountability,
		});

		// Get the presets from the Directus project settings
		const presets = await step.run('get-settings', async () => {
			const settings = await settingsService.readSingleton({

			});

			return settings.storage_asset_presets;
		});

		for (const preset of presets) {
			await step.run(`get-assets-${preset.key}`, async () => {
				// Loop through each preset
				const asset = await assetsService.getAsset(event.data.event.key, {
					transformationParams: preset,
				});

				return asset;
			});
		}

		return { success: true };
	},
);
