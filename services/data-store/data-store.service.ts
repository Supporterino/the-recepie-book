"use strict";

import {Service, ServiceBroker, ServiceSchema} from "moleculer";
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
		}, schema));
	}
}
