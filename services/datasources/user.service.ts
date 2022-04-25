"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { DatabaseError, GetSanitizedUserParams, IsLegitUserParams, MAX_PAGE_SIZE, OwnsRecipeParams, PAGE_SIZE, RecipeData, ServiceMeta, UserAvatarUpdateParams, UserData, ChangeUsernameParams } from "../../shared";
import { Role, User } from "../../types";

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
					"role",
				],
				entityValidator: {
					username: "string",
					password: "string",
					email: { type: "email" },
					joinedAt: { type: "date", convert: true },
					avatar: { type: "string", default: "NO_PIC", optional: true },
					role: { type: "enum", values: Object.values(Role) },
				},
			},
			actions: {
				isLegitUser: {
					params: {
						userID: "string",
						email: { type: "email" },
					},
					handler: async (ctx: Context<IsLegitUserParams>): Promise<boolean> => await this.isLegitUser(ctx),
				},
				ownsRecipe: {
					rest: {
						method: "POST",
						path: "/ownsRecipe",
					},
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<OwnsRecipeParams, ServiceMeta>): Promise<boolean> => await this.ownsRecipe(ctx),
				},
				getSanitizedUser: {
					rest: {
						method: "POST",
						path: "/getSanitizedUser",
					},
					params: {
						userID: "string",
					},
					handler: async (ctx: Context<GetSanitizedUserParams, ServiceMeta>): Promise<User> => await this.getSanitizedUser(ctx),
				},
				changeUsername: {
					rest: {
						method: "POST",
						path: "/changeUsername",
					},
					params: {
						username: "string",
					},
					handler: async (ctx: Context<ChangeUsernameParams, ServiceMeta>): Promise<boolean> => await this.changeUsername(ctx),
				},
			},
			events: {
				"user.newAvatar": {
					params: {
						userID: "string",
						imageName: "string",
					},
					handler: async (ctx: Context<UserAvatarUpdateParams>) => this["user.newAvatar"](ctx),
				},
			},
		}, schema));
	}

	public async "user.newAvatar"(ctx: Context<UserAvatarUpdateParams>): Promise<void> {
		const oldFile = (await ctx.call("v1.user.get", {id: ctx.params.userID}) as UserData).avatar;
		await ctx.call("v1.user.update", { id: ctx.params.userID, avatar: ctx.params.imageName });
		if (oldFile !== "NO_PIC") {ctx.emit("photo.delete", { fileName: oldFile });}
	}

	public async changeUsername(ctx: Context<ChangeUsernameParams, ServiceMeta>): Promise<boolean> {
		const [ userID, username ] = [ ctx.meta.user.id, ctx.params.username ];
		this.logger.info(`User[${userID}] Changing username to ${username}`);
		try {
			const updatedUser = await ctx.call("v1.user.update", { id: userID, username}) as UserData;
			if (updatedUser.username !== username) {return false;}
			return true;
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to update username.", error.code || 500, this.name);
		}
	}

	public async getSanitizedUser(ctx: Context<GetSanitizedUserParams, ServiceMeta>): Promise<User> {
		const userID = ctx.params.userID;
		const user = await ctx.call("v1.user.get", { id: userID }) as UserData;
		return {
			id: user.id,
			username: user.username,
			joinedAt: user.joinedAt,
			avatar: (user.avatar !== "NO_PIC") ? await ctx.call("v1.photo.getImageUrl", { filename: user.avatar }) : "",
			role: user.role,
		} as User;
	}

	public async isLegitUser(ctx: Context<IsLegitUserParams>): Promise<boolean> {
		const [ userID, email ] = [ ctx.params.userID, ctx.params.email ];
		try {
			const user = await ctx.call("v1.user.get", { id: userID }) as UserData;
			if (user && user.email === email) {return true;}
			else {return false;}
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to get user by ID.", error.code || 500, this.name);
		}
	}

	public async ownsRecipe(ctx: Context<OwnsRecipeParams, ServiceMeta>): Promise<boolean> {
		const [ userID, recipeID ] = [ ctx.meta.user.id, ctx.params.recipeID ];
		if (userID === (await ctx.call("v1.data-store.get", { id: recipeID }) as RecipeData).owner) {return true;}
		else {return false;}
	}
}
