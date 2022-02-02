"use strict";

import {Service, ServiceBroker, Context, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";

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
				fields: [
					"_id",
					"name",
					"description",
					"ingredients",
					"steps",
					"rating",
					"tags",
					"owner",
				],
				entityValidator: {
					name: "string",
					description: {type: "string", default: "", optional: true},
					ingredients: {type: "array", items: {type: "object", strict: true, props: {name: "string", amount: "string"}}},
					steps: {type: "array", items: "string"},
					rating: {type: "number", positive: true, default: 0, optional: true},
					tags: {type: "array", items: "string"},
					owner: "string",
				},
			},
			actions:{
				/**
				 * Add a new recipe to the storage
				 */
				new: {
					rest: {
						method: "POST",
						path: "/new",
					},
					async handler(ctx): Promise<string> {
						return await this.SaveNewRecipe(ctx.params);
					},
				},
			},
		}, schema));
	}

	// Action
	public async SaveNewRecipe(params: any): Promise<string> {
        // TODO: Trigger indexing
        await this.broker.call("v1.data-store.create", params);
		return `Saved '${params.name}' by ${params.owner}`;
	}
}
