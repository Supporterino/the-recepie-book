"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { Units } from "../../types/units";

export default class DataStoreService extends Service {
    private DBConnection = new Connection("recipes").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "data-store",
            version: 1,
            mixins: [this.DBConnection],
			settings: {
				idField: "id",
				pageSize: 2147483647,
				maxPageSize: 2147483647,
				fields: [
					"id",
					"name",
					"description",
					"ingredients",
					"steps",
					"rating",
					"tags",
					"owner",
					"creationTimestamp",
					"updateTimestamp",
				],
				entityValidator: {
					name: "string",
					description: {type: "string", default: "", optional: true},
					ingredients: {type: "array", items: {type: "object", strict: true, props: {name: "string", amount: "number", unit: { type: "enum", values: Object.values(Units) }}}},
					steps: {type: "array", items: "string"},
					// Rating: {type: "number", positive: true, default: 0, optional: true},
					rating: { type: "string", default: "", optional: true },
					tags: {type: "array", items: "string"},
					owner: "string",
					creationTimestamp: { type: "date", convert: true },
					updateTimestamp: { type: "date", convert: true },
				},
			},
			events: {
				"recipe.first_rating": {
					params: {
						recipeID: "string",
						ratingID: "string",
					},
					handler: (ctx: Context<any>) => {
						ctx.call("v1.data-store.update", { id: ctx.params.recipeID, rating: ctx.params.ratingID });
					},
				},
				"recipe.deletion": {
					params: {
						recipeID: "string",
					},
					handler: (ctx: Context<any>) => {
						ctx.call("v1.data-store.remove", { id: ctx.params.recipeID });
					},
				},
			},
		}, schema));
	}
}
