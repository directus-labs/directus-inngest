import type { DirectusContext } from './types';
import { Inngest, InngestMiddleware } from 'inngest';

interface InngestContext {
	directus: DirectusContext;
}

let directusContext: DirectusContext | null = null;
let inngestClient: Inngest<InngestContext & { id: string }> | null = null;

export function setDirectusContext(context: DirectusContext): void {
	directusContext = context;
}

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

function getInngestClient(): Inngest<InngestContext & { id: string }> {
	if (!inngestClient) {
		inngestClient = createInngestClient();
	}

	return inngestClient;
}

export const inngest = getInngestClient();
