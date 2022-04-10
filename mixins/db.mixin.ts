"use strict";

import { Context, Service, ServiceSchema } from "moleculer";
import DbService from "moleculer-db";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const   MongoAdapter = require("moleculer-db-adapter-mongo");
export default class Connection implements Partial<ServiceSchema>, ThisType<Service>{

	private cacheCleanEventName: string;
	private collection: string;
	private schema: Partial<ServiceSchema> & ThisType<Service>;

	public constructor(public collectionName: string) {
		this.collection = collectionName;
		this.cacheCleanEventName = `cache.clean.${this.collection}`;

		this.schema = {
			mixins: [DbService],
			adapter: new MongoAdapter(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }),
			collection: this.collection,
			events: {
				/**
				 * Subscribe to the cache clean event. If it's triggered
				 * clean the cache entries for this service.
				 *
				 */
				async [this.cacheCleanEventName]() {
					if (this.broker.cacher) {
						this.logger.info(`Cleaning caches for collection ${this.fullName},${this.collection}`);
						await this.broker.cacher.clean(`${this.fullName}.*`);
					}
				},
			},
			actions: {
				findOverID: {
					params: {
						query: "object",
					},
					async handler(ctx){
						const query = ctx.params.query;
						const ids = [];
						// eslint-disable-next-line no-underscore-dangle
						for (const id of query._id.$in) {
							ids.push(this.adapter.stringToObjectID(id));
						}
						// eslint-disable-next-line no-underscore-dangle
						query._id.$in = ids;
						return await ctx.call("v1.data-store.find", { query });
					},
				},
			},
			methods: {
				/**
				 * Send a cache clearing event when an entity changed.
				 *
				 * @param {String} type
				 * @param {any} json
				 * @param {Context} ctx
				 */
				entityChanged: async (type: string, json: any, ctx: Context) => {
					await  ctx.broadcast(this.cacheCleanEventName);
				},
			},
			async started() {
				// Check the count of items in the DB. If it's empty,
				// Call the `seedDB` method of the service.
				if (this.seedDB) {
					const count = await this.adapter.count();
					if (count === 0) {
						this.logger.info(`The '${this.collection}' collection is empty. Seeding the collection...`);
						await this.seedDB();
						this.logger.info("Seeding is done. Number of records:", await this.adapter.count());
					}
				}
			},
		};
	}

	public start(){
		return this.schema;
	}
}
