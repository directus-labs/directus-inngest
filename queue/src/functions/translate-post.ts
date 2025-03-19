import type { Accountability } from '@directus/types';
import type { Language, Post, PostTranslation } from '../../../types/directus-schema';

import type { DirectusContext, DirectusServices } from '../inngest/types';

import * as deepl from 'deepl-node';

import { inngest } from '../inngest/client';

/*
  Outline of Translate Post Workflow:
  1. Normalize the keys from the event to handle newly created or updated posts.
  2. Determine if relevant post fields (title, content, slug) actually changed; if not, exit early.
  3. Retrieve the existing posts (including current translations).
  4. Retrieve the available languages (excluding source language).
  5. Build a list of translation items to process, skipping fields that did not change.
  6. In parallel, translate each item; log errors individually if they happen.
  7. Upsert all successfully translated items into 'post_translations'.
  8. If user context is present, create a notification that includes success/failure summaries.
  9. Return an object summarizing the steps taken, listing post IDs, translations generated, and any failures.
*/

const TRANSLATABLE_FIELDS = ['title', 'content', 'slug'] as const;
type TranslatableField = typeof TRANSLATABLE_FIELDS[number];

const DEEPL_PARAMS: Record<TranslatableField, Record<string, string>> = {
	title: {},
	content: {
		tag_handling: 'html',
	},
	slug: {
		tag_handling: 'html',
	},
};

export default inngest.createFunction(
	{
		id: 'translate-post',
		name: 'Generate translations whenever a post is updated or created',
	},
	{ event: 'posts/generate-translations' },
	async ({ event, step, directus }) => {
		const { services, getSchema, env } = directus as DirectusContext;

		// 1. Normalize keys into an array -- code that doesn't mutate external state or depend on external state, doesn't need to be wrapped in a step
		let postKeys: string[] | undefined;
		const eventType = event.data?.event?.event as 'posts.items.create' | 'posts.items.update' | undefined;

		if (!eventType) {
			return [];
		}

		if (eventType === 'posts.items.create') {
			// Create events receive a single `key`
			const singleKey = [event.data.event.key].filter(Boolean);
			postKeys = singleKey;
		}

		if (eventType === 'posts.items.update') {
			// Update events receive an array of `keys`
			const keys = (event.data.event.keys || []).filter(Boolean);
			postKeys = keys;
		}

		if (!postKeys || postKeys.length === 0) {
			return {
				success: false,
				result: 'No valid post keys to process.',
			};
		}

		// 2. Decide if translations are necessary
		const payload = event.data?.event?.payload || {};

		// Check if any translatable field has content in the payload
		const relevantChange = TRANSLATABLE_FIELDS.some((field) =>
			payload[field] !== undefined && payload[field] !== null,
		);

		const shouldGenerateTranslations = relevantChange;

		if (!shouldGenerateTranslations) {
			// Note: You can force skipping this check during debugging if you suspect
			// the relevant fields aren't being detected.
			console.log('Translations not triggered: none of the relevant fields changed.');
			return {
				success: true,
				postIds: postKeys,
				result: 'No relevant changes (title, content, slug) to generate translations for.',
			};
		}

		// 3. Prepare translator, schema, and services
		const translator = new deepl.Translator(env.DEEPL_API_KEY);
		const schema = await getSchema();
		const postsService = initItemsService(services, 'posts', schema, event.data.accountability);
		const languagesService = initItemsService(services, 'languages', schema, event.data.accountability);
		const translationsService = initItemsService(services, 'post_translations', schema, event.data.accountability);

		// 4. Get posts and current translations
		const postsWithTranslations = await step.run('get-current-posts-with-translations', async () => {
			try {
				const posts = await postsService.readByQuery<Post>({
					filter: {
						id: {
							_in: postKeys,
						},
					},
					fields: ['*', 'translations.*'],
				});

				return Array.isArray(posts) ? posts : [];
			}
			catch (error) {
				throw new Error(`Failed fetching posts: ${(error as Error).message}`);
			}
		});

		console.log(`Found ${postsWithTranslations.length} post records with translations:`);

		if (!postsWithTranslations.length) {
			return {
				success: false,
				postIds: postKeys,
				result: 'No matching posts found for the provided keys.',
			};
		}

		// 5. Get available languages
		const availableLanguages = await step.run('get-languages', async () => {
			try {
				const langs = await languagesService.readByQuery<Language>({
					fields: ['*'],
				});

				return langs;
			}
			catch (error) {
				throw new Error(`Failed fetching languages: ${(error as Error).message}`);
			}
		});

		console.log('Languages found:', availableLanguages.map((l) => l.code));

		if (!availableLanguages.length) {
			return {
				success: false,
				postIds: postKeys,
				result: 'No languages found; cannot generate translations.',
			};
		}

		// 6. Build translation list
		const translationsToUpsert = await step.run('build-translation-list', async () => {
			const payload = event.data?.event?.payload || {};
			const itemsToTranslate: Array<PostTranslation & { deeplCode?: string }> = [];

			console.log('Building translations with payload:', payload);

			for (const post of postsWithTranslations) {
				// Skip if no translatable fields changed
				if (!shouldGenerateTranslations) {
					console.log('No translatable fields changed, skipping post:', post.id);
					continue;
				}

				const existingTranslations = Array.isArray(post.translations) ? post.translations : [];

				const defaultLangCode = typeof post.default_langugage === 'string'
					? post.default_langugage
					: post.default_langugage?.code;

				console.log('Processing post:', {
					postId: post.id,
					defaultLang: defaultLangCode,
					existingTranslations: existingTranslations.length,
				});

				for (const language of availableLanguages) {
					if (!language.code || language.code === defaultLangCode) {
						console.log(`Skipping language ${language.code} (matches default or invalid)`);
						continue;
					}

					const foundTranslation = existingTranslations.find(
						(tr: PostTranslation) => (typeof tr.language === 'string' ? tr.language : tr.language?.code) === language.code,
					);

					const translationItem: PostTranslation & { deeplCode?: string } = {
						id: foundTranslation?.id || undefined,
						post: post.id,
						language: language.code,
						deeplCode: language.deepl_code || undefined,
					};

					let hasFieldsToTranslate = false;

					// Only include fields that were changed in the payload
					for (const field of TRANSLATABLE_FIELDS) {
						if (payload[field] !== undefined && payload[field] !== null) {
							translationItem[field] = payload[field];
							hasFieldsToTranslate = true;
						}
					}

					if (hasFieldsToTranslate) {
						console.log(`Adding translation item for language ${language.code}:`, translationItem);
						itemsToTranslate.push(translationItem);
					}
					else {
						console.log(`No fields to translate for language ${language.code}, skipping`);
					}
				}
			}

			console.log(`Built ${itemsToTranslate.length} translation items`);
			return itemsToTranslate;
		});

		console.log(
			`translationsToUpsert length: ${translationsToUpsert.length}`,
			JSON.stringify(translationsToUpsert, null, 2),
		);

		if (translationsToUpsert.length === 0) {
			return {
				success: true,
				postIds: postKeys,
				result: 'No new translations are required based on changes or missing fields.',
			};
		}

		// Track translations and failures at function scope
		const translatedItems: PostTranslation[] = [];
		const failedTranslations: Array<{ post: string; language?: string; error: string }> = [];

		// 7. Translate each item
		for (const item of translationsToUpsert) {
			const stepId = `translate-${item.post}-${item.language}`;

			try {
				const translation = await step.run(stepId, async () => {
					console.log(`Starting translation for ${item.language}:`, item);

					if (!item.deeplCode) {
						throw new Error(`Missing DeepL code for language '${item.language ?? ''}'`);
					}

					const targetLang = item.deeplCode as deepl.TargetLanguageCode;
					const fieldsToTranslate = TRANSLATABLE_FIELDS.filter((field) => item[field] !== undefined);

					if (fieldsToTranslate.length === 0) {
						throw new Error('No fields to translate');
					}

					console.log(`Translating fields ${fieldsToTranslate.join(', ')} to ${targetLang}`);

					const results = await Promise.allSettled(
						fieldsToTranslate.map(async (field) => {
							const value = item[field];

							if (!value) {
								console.log(`Empty value for field ${field}, skipping`);
								return { field, translatedValue: '' };
							}

							console.log(`Translating ${field} with value:`, value);
							const result = await translator.translateText(value, null, targetLang, DEEPL_PARAMS[field]);
							console.log(`Translation result for ${field}:`, result.text);

							const finalText = field === 'slug'
								? result.text.toLowerCase().replace(/\s+/g, '-')
								: result.text;

							return { field, translatedValue: finalText };
						}),
					);

					const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{
						field: TranslatableField;
						translatedValue: string;
					}>[];

					if (!fulfilled.length) {
						throw new Error(`All text translations failed for item related to post: ${item.post}`);
					}

					const { deeplCode, ...translationRecord } = item;

					const updates = Object.fromEntries(
						fulfilled.map(({ value: { field, translatedValue } }) => [field, translatedValue]),
					);

					const finalResult = {
						...translationRecord,
						...updates,
					} as PostTranslation;

					console.log('Translation successful:', finalResult);
					return finalResult;
				});

				translatedItems.push(translation);
			}
			catch (error) {
				console.error(`Translation failed for ${item.language}:`, error);

				failedTranslations.push({
					post: String(item.post),
					language: String(item.language),
					error: error.message || String(error),
				});
			}
		}

		console.log(`Translations complete. Successful: ${translatedItems.length}, Failed: ${failedTranslations.length}`);

		// 8. Upsert translations
		for (const translation of translatedItems) {
			const stepId = `upsert-${translation.post}-${translation.language}`;

			try {
				await step.run(stepId, async () => {
					console.log(`Upserting translation for ${translation.language}:`, translation);

					const result = await translationsService.upsertOne<PostTranslation>({
						id: translation.id,
						post: translation.post,
						language: translation.language,
						title: translation.title,
						content: translation.content,
						slug: translation.slug,
					});

					console.log('Upsert successful:', result);
				});
			}
			catch (error) {
				console.error(`Upsert failed for ${translation.language}:`, error);

				failedTranslations.push({
					post: String(translation.post),
					language: typeof translation.language === 'string'
						? translation.language
						: translation.language?.code || '',
					error: `Upsert failed: ${(error as Error).message}`,
				});
			}
		}

		// 9. Create notification if user is defined
		if (event.data.accountability?.user) {
			await step.run('create-notification', async () => {
				const notificationsService = initItemsService(
					services,
					'directus_notifications',
					schema,
					event.data.accountability,
				);

				const successCount = translatedItems.length;
				const failureCount = failedTranslations.length;
				const postIds = postsWithTranslations.map((p) => p.id).join(', ');
				const successMessage = `Successfully generated ${successCount} translation(s) for post(s): ${postIds}.`;

				const failureMessage = failureCount
					? `\nFailed translations: ${failureCount}. Check logs for details.`
					: '';

				await notificationsService.createOne({
					status: 'inbox',
					recipient: event.data.accountability!.user!,
					subject: 'Translations Generated!',
					message: successMessage + failureMessage,
					collection: 'posts',
					item: postIds,
				});
			});
		}

		// 10. Return final summary
		return {
			success: true,
			postIds: postKeys,
			translationsGenerated: translatedItems.length,
			failedTranslations,
		};
	},
);

// Helper Functions

/**
 * Helper to initialize the ItemsService
 * @param services - The Directus services object
 * @param collection - The collection name
 * @param schema - The schema object
 * @param accountability - The accountability object
 * @returns An instance of ItemsService
 */
function initItemsService(
	services: DirectusServices,
	collection: string,
	schema: unknown,
	accountability: Accountability | undefined,
) {
	const { ItemsService } = services;
	return new ItemsService(collection, {
		schema,
		accountability,
	});
}
