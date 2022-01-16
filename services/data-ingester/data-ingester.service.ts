"use strict";

import {Service, ServiceBroker, Context} from "moleculer";

export default class DataIngesterService extends Service {

	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "data-ingester",
            version: 1,
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
		});
	}

	// Action
	public SaveNewRecepie(name: string, description: string): string {
		return `Trying to save new recepie with name: ${name} and description: ${description}`;
	}
}
