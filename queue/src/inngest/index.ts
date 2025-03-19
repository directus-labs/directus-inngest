import type { Router } from 'express';
import type { DirectusContext } from './types';

import { defineEndpoint } from '@directus/extensions-sdk';
import { serve } from 'inngest/express';

// Functions
import pregenerateImageTransforms from '../functions/pregenerate-image-transforms';
import translatePost from '../functions/translate-post';
import { inngest, setDirectusContext } from './client';

export default defineEndpoint({
	id: 'inngest',

	handler: (router: Router, context: DirectusContext) => {
		// Pass the Directus context to the Inngest client
		setDirectusContext(context);

		const handler = serve({
			client: inngest,
			functions: [translatePost, pregenerateImageTransforms],
		});

		router.use(
			'/',
			handler,
		);
	},
});
