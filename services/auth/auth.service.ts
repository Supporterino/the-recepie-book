"use strict";

import {Context, Errors, Service, ServiceBroker} from "moleculer";
import { verify } from "jsonwebtoken";
import { hash } from "bcrypt";
import { Auth, LoginResponse, Role } from "../../types";
import { Authenticate, AuthError, BaseError, DatabaseError, LoginServiceResponse, RefreshToken, Register, RevokeToken, ServiceMeta, UserData } from "../../shared";
import { ErrorMixin } from "../../mixins/error_logging.mixin";

export default class AuthService extends Service {
	private JWT_SECRET: string = process.env.JWT_SECRET;
	private SALT_ROUNDS: number = 10;

	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "auth",
            version: 1,
			mixins: [ErrorMixin],
			actions: {
				login: {
					rest: {
						path: "/login",
						method: "POST",
					},
					params: {
						email: { type: "email", normalize: true },
						password: "string",
					},
					handler: async (ctx: Context<Authenticate>): Promise<LoginResponse> => await this.login(ctx),
				},
				register: {
					rest: {
						path: "/register",
						method: "POST",
					},
					params: {
						username: "string",
						password: "string",
						email: { type: "email", normalize: true },
					},
					handler: async (ctx: Context<Register>): Promise<string> => await this.register(ctx),
				},
				refreshToken: {
					rest: {
						path: "/refreshToken",
						method: "POST",
					},
					params: {
						token: "string",
					},
					handler: async (ctx: Context<RefreshToken>): Promise<LoginResponse> => await this.refreshToken(ctx),
				},

				revokeToken: {
					rest: {
						path: "/revokeToken",
						method: "POST",
					},
					params: {
						token: "string",
					},
					handler: async (ctx: Context<RevokeToken, ServiceMeta>): Promise<void> => await this.revokeToken(ctx),
				},
				resolveToken: {
					cache: {
						keys: ["token"],
						ttl: 60 * 60,
					},
					params: {
						token: "string",
					},
					handler: (ctx): PromiseLike<Auth> => this.resolveToken(ctx),
				},
			},
		});
	}

	public async register(ctx: Context<Register>): Promise<string> {
		const [username, email, password] = [ctx.params.username, ctx.params.email, ctx.params.password];
		this.logger.info("Checking if user is already registered.", email);
		const oldUser = await ctx.call("v1.user.getUserByEmail", {email}) as UserData;

		if (oldUser) {
			this.logger.warn(`${oldUser.email} has already a registered account.`);
			throw new Errors.MoleculerError("E-Mail already exists. Please login!", 409);
		}

		const user = {
			username,
			password: await hash(password, this.SALT_ROUNDS),
			email,
			joinedAt: new Date(),
			role: (await ctx.call("v1.user.count") === 0)? Role.SUPERADMIN : Role.USER, // First user is superadmin
		} as UserData;
		try {
			this.logger.info(`Creating new account(${user.username}) for email: ${user.email}`);
			const createdUser = await ctx.call("v1.user.create", user) as UserData;
			ctx.emit("verification.triggerStart", { userID: createdUser.id, email: createdUser.email });
			return `User[${user.username}] created.`;
		} catch (error) {
			throw new DatabaseError(error.message || "Creation of user failed.", error.code || 500, "user");
		}
	}

	public async resolveToken(ctx: Context<any>): Promise<Auth> {
		try {
			const authData = verify(ctx.params.token, this.JWT_SECRET) as Auth;
			if (!authData) {throw new Errors.MoleculerError("No Data encoded in this token", 500);}
			if (!authData.id) {throw new Errors.MoleculerError("No ID encoded in this token", 500);}
			if (!(await ctx.call("v1.user.isLegitUser", { userID: authData.id, email: authData.email }))) {throw new Errors.MoleculerError("The encoded user ID and email do not match a user in the DB.", 401);}
			return authData;
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {throw new AuthError(error.message || "Failed to resolve JWT", error.code || 500);}
		}
	}

	public async refreshToken(ctx: Context<RefreshToken>): Promise<LoginResponse> {
		const loginData = await ctx.call("v1.login.refreshToken", { token: ctx.params.token }) as LoginServiceResponse;
		return {
			jwtToken: loginData.jwtToken,
			userID: loginData.user.id,
			refreshToken: loginData.refreshToken,
			msg: "Login successful",
		} as LoginResponse;
	}

	public async revokeToken(ctx: Context<RevokeToken, ServiceMeta>): Promise<void> {
		await ctx.call("v1.login.revokeToken", { token: ctx.params.token });
	}

	public async login(ctx: Context<Authenticate>): Promise<LoginResponse> {
		const loginData = await ctx.call("v1.login.authenticate", { email: ctx.params.email, password: ctx.params.password }) as LoginServiceResponse;
		return {
			jwtToken: loginData.jwtToken,
			userID: loginData.user.id,
			refreshToken: loginData.refreshToken,
			msg: "Login successful",
		} as LoginResponse;
	}
}
