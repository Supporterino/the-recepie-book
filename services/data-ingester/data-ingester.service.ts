"use strict";

import {Service, ServiceBroker, Context} from "moleculer";
import Connection from "../../mixins/db.mixin";

export default class DataIngesterService extends Service {
    private DBConnection = new Connection('recepies').start();

    // TODO: Add collection fields and validators

	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "data-ingester",
            version: 1,
            mixins: [this.DBConnection],
			actions:{
				/**
				 * Add a new recepie to the storage
				 *
				 */
				new: {
                    params: {
                        name: "string",
                        description: "string",
                    },
					rest: {
						method: "POST",
						path: "/new",
					},
					async handler(ctx): Promise<string> {
						return this.SaveNewRecepie(ctx.params.name, ctx.params.description);
					},
				},
			},
		}, this.schema));
	}

	// Action
	public SaveNewRecepie(name: string, description: string): string {
		return `Trying to save new recepie with name: ${name} and description: ${description}`;
	}
}
