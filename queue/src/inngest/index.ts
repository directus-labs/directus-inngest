import type { Router } from 'express';
import type { DirectusContext } from '../types/services';

import { defineEndpoint } from '@directus/extensions-sdk';
import { serve } from 'inngest/express';

import pregenerateImageTransforms from '../functions/pregenerate-image-transforms';
import translatePost from '../functions/translate-post';

import { inngest, setDirectusContext } from './client';

export default defineEndpoint({
	id: 'inngest',

	handler: (router: Router, context: DirectusContext) => {
		// Inject the Directus context into the Inngest client
		setDirectusContext(context);

		// Serve the Inngest client
		const handler = serve({
			client: inngest,
			functions: [translatePost, pregenerateImageTransforms],
		});

		// Serve the Inngest client at `https://yourdirectusurl.com/:id` which is 'inngest' above
		router.use(
			'/',
			handler,
		);
	},
});
