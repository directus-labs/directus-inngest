import type { EventContext } from '@directus/types';
import { defineHook } from '@directus/extensions-sdk';
import { inngest } from '../inngest/client';

export default defineHook(({ action }) => {
	action('posts.items.update', (event, context: EventContext) => {
		inngest.send({
			name: 'posts/generate-translations',
			data: {
				event,
				accountability: context.accountability,
			},
		});
	});

	action('posts.items.create', (event, context: EventContext) => {
		inngest.send({
			name: 'posts/generate-translations',
			data: {
				event,
				accountability: context.accountability,
			},
		});
	});

	action('files.upload', (event, context: EventContext) => {
		if (event.collection === 'directus_files' && event.payload.type.startsWith('image/')) {
			inngest.send({
				name: 'assets/pregenerate-transforms',
				data: {
					event,
					accountability: context.accountability,
				},
			});
		}
	});
});
