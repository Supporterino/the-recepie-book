"use strict";

import {Context, Errors, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { DatabaseError, GetSanitizedUser, GetUserByEmail, IsLegitUser, MAX_PAGE_SIZE, OwnsRecipe, PAGE_SIZE, RecipeData, Rename, ServiceMeta, SetUserRole, SetVerificationData, UserAvatarUpdate, UserData } from "../../shared";
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
					"verificationID",
				],
				entityValidator: {
					username: "string",
					password: "string",
					email: { type: "email" },
					joinedAt: { type: "date", convert: true },
					avatar: { type: "string", default: "NO_PIC", optional: true },
					role: { type: "enum", values: Object.values(Role) },
					verificationID: { type: "string", optional: true },
				},
			},
			actions: {
				isLegitUser: {
					params: {
						userID: "string",
						email: { type: "email" },
					},
					handler: async (ctx: Context<IsLegitUser>): Promise<boolean> => await this.isLegitUser(ctx),
				},
				ownsRecipe: {
					rest: {
						method: "POST",
						path: "/ownsRecipe",
					},
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<OwnsRecipe, ServiceMeta>): Promise<boolean> => await this.ownsRecipe(ctx),
				},
				getSanitizedUser: {
					rest: {
						method: "POST",
						path: "/getSanitizedUser",
					},
					params: {
						userID: "string",
					},
					handler: async (ctx: Context<GetSanitizedUser, ServiceMeta>): Promise<User> => await this.getSanitizedUser(ctx),
				},
				rename: {
					rest: {
						method: "POST",
						path: "/rename",
					},
					params: {
						username: "string",
					},
					handler: async (ctx: Context<Rename, ServiceMeta>): Promise<boolean> => await this.rename(ctx),
				},
				setUserRole: {
					rest: {
						method: "POST",
						path: "/setUserRole",
					},
					params: {
						userID: "string",
						role: { type: "enum", values: Object.values(Role) },
					},
					handler: async (ctx: Context<SetUserRole, ServiceMeta>): Promise<void> => await this.setUserRole(ctx),
				},
				getUserByEmail: {
					params: {
						email: "string",
					},
					handler: (ctx: Context<GetUserByEmail>): Promise<UserData> => this.getUserByEmail(ctx),
				},
			},
			events: {
				"user.newAvatar": {
					params: {
						userID: "string",
						imageName: "string",
					},
					handler: async (ctx: Context<UserAvatarUpdate>) => this["user.newAvatar"](ctx),
				},
				"user.setVerificationData": {
					params: {
						userID: "string",
						verificationID: "string",
					},
					handler: (ctx: Context<SetVerificationData>) => this["user.setVerificationData"](ctx),
				},
			},
		}, schema));
	}

	public async "user.setVerificationData"(ctx: Context<SetVerificationData>): Promise<void> {
		await ctx.call("v1.user.update", { id: ctx.params.userID, verificationID: ctx.params.verificationID });
	}

	public async "user.newAvatar"(ctx: Context<UserAvatarUpdate>): Promise<void> {
		const oldFile = (await ctx.call("v1.user.get", {id: ctx.params.userID}) as UserData).avatar;
		await ctx.call("v1.user.update", { id: ctx.params.userID, avatar: ctx.params.imageName });
		if (oldFile !== "NO_PIC") {ctx.emit("photo.delete", { fileName: oldFile });}
	}

	public async getUserByEmail(ctx: Context<GetUserByEmail>): Promise<UserData> {
		const email = ctx.params.email;
		this.logger.info(`Loading user data for user: ${email}`);
		try {
			const user = (await ctx.call("v1.user.find", { query: { email } }) as UserData[])[0];
			return user;
		} catch (error) {
			throw new DatabaseError(error.message || "Couldn't load user via its email address.", error.code || 500, "user");
		}
	}

	public async setUserRole(ctx: Context<SetUserRole, ServiceMeta>): Promise<void> {
		const [ userID, role, ownUserID, ownRole ] = [ ctx.params.userID, ctx.params.role, ctx.meta.user.id, ctx.meta.user.role ];
		if (ownRole === Role.USER || ownRole === Role.MODERATOR) {throw new Errors.MoleculerError("Insufficient permission", 401);}
		const userToModify = await ctx.call("v1.user.get", userID) as UserData;
		if (userToModify.role > ownRole) {throw new Errors.MoleculerError("Targets permissions are higher then own one", 401);}
		ctx.call("v1.user.update", { id: userID, role });
	}

	public async rename(ctx: Context<Rename, ServiceMeta>): Promise<boolean> {
		const [ userID, username ] = [ ctx.meta.user.id, ctx.params.username ];
		this.logger.info(`User[${userID}] Changing username to ${username}`);
		try {
			const updatedUser = await ctx.call("v1.user.update", { id: userID, username }) as UserData;
			if (updatedUser.username !== username) {return false;}
			return true;
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to update username.", error.code || 500, this.name);
		}
	}

	public async getSanitizedUser(ctx: Context<GetSanitizedUser, ServiceMeta>): Promise<User> {
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

	public async isLegitUser(ctx: Context<IsLegitUser>): Promise<boolean> {
		const [ userID, email ] = [ ctx.params.userID, ctx.params.email ];
		try {
			const user = await ctx.call("v1.user.get", { id: userID }) as UserData;
			if (user && user.email === email) {return true;}
			else {return false;}
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to get user by ID.", error.code || 500, this.name);
		}
	}

	public async ownsRecipe(ctx: Context<OwnsRecipe, ServiceMeta>): Promise<boolean> {
		const [ userID, recipeID ] = [ ctx.meta.user.id, ctx.params.recipeID ];
		if (userID === (await ctx.call("v1.data-store.get", { id: recipeID }) as RecipeData).owner) {return true;}
		else {return false;}
	}
}
