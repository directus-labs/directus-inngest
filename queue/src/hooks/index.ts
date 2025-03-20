import type { EventContext } from '@directus/types';
import { defineHook } from '@directus/extensions-sdk';
import { inngest } from '../inngest/client';

export default defineHook(({ action }) => {
	action('posts.items.update', (event, context: EventContext) => {
		inngest.send({
			// It's recommend to mirror the Directus event name in the Inngest event name so if you want to trigger multiple fucntions for the same event. It's makes it easier to understand and debug.
			name: 'directus/posts.items.update',
			data: {
				event,
				accountability: context.accountability,
			},
		});
	});

	action('posts.items.create', (event, context: EventContext) => {
		inngest.send({
			name: 'directus/posts.items.create',
			data: {
				event,
				accountability: context.accountability,
			},
		});
	});

	action('files.upload', (event, context: EventContext) => {
		if (event.collection === 'directus_files' && event.payload.type.startsWith('image/')) {
			inngest.send({
				name: 'directus/files.upload',
				data: {
					event,
					accountability: context.accountability,
				},
			});
		}
	});
});
