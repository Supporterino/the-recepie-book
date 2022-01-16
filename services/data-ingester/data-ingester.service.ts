"use strict";

import {Service, ServiceBroker, Context, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";

export default class DataIngesterService extends Service {
    private DBConnection = new Connection('recepies').start();

    // TODO: Add collection fields and validators

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "data-ingester",
            version: 1,
            mixins: [this.DBConnection],
            fields: [
                "_id",
                "name",
                "description",
                "ingredients",
                "steps",
                "rating",
                "owner"
            ],
			actions:{
				/**
				 * Add a new recepie to the storage
				 *
				 */
				new: {
                    params: {
                        name: "string",
                        description: "string",
                        ingredients: "string",
                        steps: "string",
                        rating: {type: "number", positive: true},
                        owner: "string"
                    },
					rest: {
						method: "POST",
						path: "/new",
					},
					async handler(ctx): Promise<string> {
						return this.SaveNewRecepie(ctx.params);
					},
				},
			},
		}, schema));
	}

	// Action
	public SaveNewRecepie(params: any): string {
        // TODO: Trigger indexing
        this.broker.call('v1.data-ingester.create', params)
		return `Saved '${params.name}' by ${params.owner}`;
	}
}
