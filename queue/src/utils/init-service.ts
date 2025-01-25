import type { Accountability } from '@directus/types';
import type { DirectusServices } from '../inngest/types';

function initItemsService(services: DirectusServices, collection: string, schema: any, accountability: Accountability) {
	const { ItemsService } = services;
	return new ItemsService(collection, {
		schema,
		accountability,
	});
}

export { initItemsService };
