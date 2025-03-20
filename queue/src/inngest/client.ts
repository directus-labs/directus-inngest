import type { DirectusContext } from '../types/services';
import { Inngest, InngestMiddleware } from 'inngest';

interface InngestContext {
	directus: DirectusContext;
}

let directusContext: DirectusContext | null = null;
let inngestClient: Inngest<InngestContext & { id: string }> | null = null;

// Dependency Injection - this allows us to inject the Directus context to the Inngest context (so we can use the Directus services like ItemsService, NotificationsService, etc.)
function createInngestClient(): Inngest<InngestContext & { id: string }> {
	const contextMiddleware = new InngestMiddleware({
		name: 'Directus Context Middleware',
		init: () => ({
			onFunctionRun: () => ({
				transformInput: ({ ctx }) => ({
					ctx: {
						...ctx,
						directus: directusContext,
					},
				}),
			}),
		}),
	});

	return new Inngest<InngestContext & { id: string }>({
		id: 'directus-inngest',
		isDev: true,
		middleware: [contextMiddleware],
	});
}

// Helper function to help with dependency injection
export function setDirectusContext(context: DirectusContext): void {
	directusContext = context;
}


// Singleton Pattern - this ensures that we only create the Inngest client once
function getInngestClient(): Inngest<InngestContext & { id: string }> {
	if (!inngestClient) {
		inngestClient = createInngestClient();
	}

	return inngestClient;
}

export const inngest = getInngestClient();
