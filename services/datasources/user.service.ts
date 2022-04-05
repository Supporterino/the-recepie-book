"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { DatabaseError, IsLegitUserParams, MAX_PAGE_SIZE, OwnsRecipeParams, PAGE_SIZE, ServiceMeta } from "../../shared";
import { Recipe, User } from "../../types";

export default class UserService extends Service {
    private DBConnection = new Connection("users").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "user",
            version: 1,
            mixins: [this.DBConnection, ErrorMixin],
			settings: {
				idField: "id",
				pageSize: PAGE_SIZE,
				maxPageSize: MAX_PAGE_SIZE,
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
				/**
				 * Check if a given pair of userid and email match the entry in the database
				 *
				 * @method
				 * @param {String} id - The user id
				 * @param {String} email
				 * @returns {Boolean}
				 */
				isLegitUser: {
					params: {
						userID: "string",
						email: { type: "email" },
					},
					async handler(ctx: Context<IsLegitUserParams>): Promise<boolean> {
						return await this.checkAuthentic(ctx.params.userID, ctx.params.email);
					},
				},
				/**
				 * Checks if the userID matches the owner of the recipe
				 *
				 * @method
				 * @param {String} userID
				 * @param {String} recipeID
				 * @returns {boolean}
				 */
				ownsRecipe: {
					rest: {
						method: "POST",
						path: "/ownsRecipe",
					},
					params: {
						recipeID: "string",
					},
					async handler(ctx: Context<OwnsRecipeParams, ServiceMeta>): Promise<boolean> {
						return await this.checkAuthor(ctx.meta.user.id, ctx.params.recipeID);
					},
				},
			},
		}, schema));
	}

	public async checkAuthentic(id: string, email: string): Promise<boolean> {
		try {
			const user = await this.broker.call("v1.user.get", { id }) as User;
			if (user && user.email === email) {return true;}
			else {return false;}
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to get user by ID.", error.code || 500, this.name);
		}
	}

	public async checkAuthor(userID: string, recipeID: string): Promise<boolean> {
		if (userID === (await this.broker.call("v1.data-store.get", { id: recipeID }) as Recipe).owner) {return true;}
		else {return false;}
	}
}
