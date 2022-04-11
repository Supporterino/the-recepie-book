"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { ChangeUsernameParams, DatabaseError, GetSanitizedUserParams, IsLegitUserParams, MAX_PAGE_SIZE, OwnsRecipeParams, PAGE_SIZE, RecipeData, ServiceMeta, UserAvatarUpdateParams, UserData } from "../../shared";
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
					"avatar",
				],
				entityValidator: {
					username: "string",
					password: "string",
					email: { type: "email" },
					joinedAt: { type: "date", convert: true },
					avatar: { type: "string", default: "NO_PIC", optional: true },
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
				changeUsername: {
					rest: {
						method: "POST",
						path: "/changeUsername",
					},
					params: {
						username: "string",
					},
					handler: async (ctx: Context<ChangeUsernameParams, ServiceMeta>): Promise<boolean> => await this.changeUsername(ctx.params.username, ctx.meta.user.id),
				},
			},
			events: {
				"user.newAvatar": {
					params: {
						userID: "string",
						imageName: "string",
					},
					handler: async (ctx: Context<UserAvatarUpdateParams>) => {
						const oldFile = (await ctx.call("v1.user.get", {id: ctx.params.userID}) as UserData).avatar;
						await ctx.call("v1.user.update", { id: ctx.params.userID, avatar: ctx.params.imageName });
						if (oldFile !== "NO_PIC") {ctx.emit("photo.delete", { fileName: oldFile });}
					},
				},
			},
		}, schema));
	}

	public async changeUsername(username: string, userID: string): Promise<boolean> {
		this.logger.info(`User[${userID}] Changing username to ${username}`);
		try {
			const updatedUser = await this.broker.call("v1.user.update", { id: userID, username}) as UserData;
			if (updatedUser.username !== username) {return false;}
			return true;
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to update username.", error.code || 500, this.name);
		}
	}

	public async getSanitizedUser(userID: string): Promise<User> {
		const user = await this.broker.call("v1.user.get", { id: userID }) as UserData;
		return {
			id: user.id,
			username: user.username,
			joinedAt: user.joinedAt,
			avatar: (user.avatar !== "NO_PIC") ? await this.broker.call("v1.photo.getImageUrl", { filename: user.avatar }) : "",
		} as User;
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
