import type { Accountability, Item, PrimaryKey, Query, SchemaOverview } from '@directus/types';
import type { Knex } from 'knex';
import type { EventEmitter } from 'node:events';
import type { Logger } from 'pino';

export interface AbstractService {
	knex: Knex;
	accountability: Accountability | null | undefined;

	createOne: (data: Partial<Item>) => Promise<PrimaryKey>;
	createMany: (data: Partial<Item>[]) => Promise<PrimaryKey[]>;

	readOne: (key: PrimaryKey, query?: Query) => Promise<Item>;
	readMany: (keys: PrimaryKey[], query?: Query) => Promise<Item[]>;
	readByQuery: (query: Query) => Promise<Item[]>;

	updateOne: (key: PrimaryKey, data: Partial<Item>) => Promise<PrimaryKey>;
	updateMany: (keys: PrimaryKey[], data: Partial<Item>) => Promise<PrimaryKey[]>;

	deleteOne: (key: PrimaryKey) => Promise<PrimaryKey>;
	deleteMany: (keys: PrimaryKey[]) => Promise<PrimaryKey[]>;
}

export interface DirectusServices {
	[key: string]: AbstractService;
}

export interface DirectusContext {
	services: DirectusServices;
	database: Knex;
	getSchema: () => Promise<SchemaOverview>;
	env: Record<string, any>;
	logger: Logger;
	emitter: EventEmitter;
}
