"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { DatabaseError, GetSanitizedUserParams, IsLegitUserParams, MAX_PAGE_SIZE, OwnsRecipeParams, PAGE_SIZE, RecipeData, ServiceMeta } from "../../shared";
import { UserData } from "../../shared/interfaces/userData";
import { User } from "../../types";

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
					"joinedAt",
				],
				entityValidator: {
					username: "string",
					password: "string",
					email: { type: "email" },
					joinedAt: { type: "date", convert: true },
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
				getSanitizedUser: {
					rest: {
						method: "POST",
						path: "/getSanitizedUser",
					},
					params: {
						userID: "string",
					},
					async handler(ctx: Context<GetSanitizedUserParams, ServiceMeta>): Promise<User> {
						return await this.getSanitizedUser(ctx.params.userID);
					},
				},
			},
		}, schema));
	}

	public async getSanitizedUser(userID: string): Promise<User> {
		const user = await this.broker.call("v1.user.get", { id: userID }) as UserData;
		return { id: user.id, username: user.username, joinedAt: user.joinedAt } as User;
	}

	public async checkAuthentic(id: string, email: string): Promise<boolean> {
		try {
			const user = await this.broker.call("v1.user.get", { id }) as UserData;
			if (user && user.email === email) {return true;}
			else {return false;}
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to get user by ID.", error.code || 500, this.name);
		}
	}

	public async checkAuthor(userID: string, recipeID: string): Promise<boolean> {
		if (userID === (await this.broker.call("v1.data-store.get", { id: recipeID }) as RecipeData).owner) {return true;}
		else {return false;}
	}
}
