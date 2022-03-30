"use strict";

import {Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { User } from "../../types/user";

export default class UserService extends Service {
    private DBConnection = new Connection("users").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "user",
            version: 1,
            mixins: [this.DBConnection],
			settings: {
				idField: "id",
				pageSize: 2147483647,
				maxPageSize: 2147483647,
				fields: [
					"id",
					"username",
					"password",
					"email",
				],
				entityValidator: {
					username: "string",
					password: "string",
					email: { type: "email" },
				},
			},
			actions: {
				isLegitUser: {
					params: {
						id: "string",
						email: { type: "email" },
					},
					async handler(ctx): Promise<boolean> {
						return await this.checkAuthentic(ctx.params.id, ctx.params.email);
					},
				},
			},
		}, schema));
	}

	public async checkAuthentic(id: string, email: string): Promise<boolean> {
		const user = await this.broker.call("v1.user.get", { id }) as User;
		if (user && user.email === email) {return true;}
		else {return false;}
	}
}
