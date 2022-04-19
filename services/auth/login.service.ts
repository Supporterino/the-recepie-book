"use strict";

import { randomBytes } from "crypto";
import { compareSync } from "bcrypt";
import { sign } from "jsonwebtoken";
import { Context, Errors, Service, ServiceBroker} from "moleculer";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { Authenticate, DatabaseError, LoginServiceResponse, RefreshToken, RefreshTokenData, RevokeToken, ServiceMeta, toMilliseconds, UnitType, UserData } from "../../shared";
import { Auth } from "../../types";

export default class LoginService extends Service {
	private JWT_SECRET: string = process.env.JWT_SECRET;

	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "login",
            version: 1,
			mixins: [ErrorMixin],
			actions:{
				authenticate: {
					params: {
						email: "string",
						password: "string",
					},
					handler: async (ctx: Context<Authenticate>): Promise<LoginServiceResponse> => await this.authenticate(ctx),
				},
				refreshToken: {
					params: {
						token: "string",
					},
					handler: async (ctx: Context<RefreshToken>): Promise<LoginServiceResponse> => await this.refreshToken(ctx),
				},
				revokeToken: {
					params: {
						token: "string",
					},
					handler: async (ctx: Context<RevokeToken, ServiceMeta>): Promise<void> => await this.revokeToken(ctx),
				},
			},
		});
	}

	public async authenticate(ctx: Context<Authenticate>): Promise<LoginServiceResponse> {
		const [email, password] = [ctx.params.email, ctx.params.password];
		const user = await this.getUser(email, ctx);

		if ( !user || !compareSync(password, user.password)) {throw new Errors.MoleculerError("Invalid Credentials", 400);}

		const jwtToken = this.generateToken(user);
		const refreshToken = await this.generateRefreshToken(user, ctx);

		return {
			user: await ctx.call("v1.user.getSanitizedUser", { userID: user.id }),
			jwtToken,
			refreshToken: refreshToken.token,
		} as LoginServiceResponse;
	}

	public async refreshToken(ctx: Context<RefreshToken>): Promise<LoginServiceResponse> {
		const refreshToken = await ctx.call("v1.refresh-token.getTokenAndValidate", { token: ctx.params.token }) as RefreshTokenData;
		const user = await this.getUserByID(refreshToken.user, ctx);

		const newRefreshToken = await this.generateRefreshToken(user, ctx);
		refreshToken.revoked = new Date();
		refreshToken.replacedByToken = newRefreshToken.token;
		await ctx.call("v1.refresh-token.update", refreshToken);

		const jwtToken = this.generateToken(user);

		return {
			user: await ctx.call("v1.user.getSanitizedUser", { userID: user.id }),
			jwtToken,
			refreshToken: newRefreshToken.token,
		} as LoginServiceResponse;
	}

	public async revokeToken(ctx: Context<RevokeToken, ServiceMeta>) {
		const refreshToken = await ctx.call("v1.refresh-token.getTokenAndValidate", { token: ctx.params.token }) as RefreshTokenData;
		if (refreshToken.user !== ctx.meta.user.id) {throw new Errors.MoleculerError("This refresh token doesn't belong to the user.", 401);}

		refreshToken.revoked = new Date();
		await ctx.call("v1.refresh-token.update", refreshToken);
	}

	private generateToken(user: UserData): string {
		this.logger.info(`Generating token for ${user.email}`);
		return sign({ id:user.id, email: user.email } as Auth, this.JWT_SECRET, { expiresIn: "15m" });
	}

	private async generateRefreshToken(user: UserData, ctx: Context<any>): Promise<RefreshTokenData> {
		return await ctx.call("v1.refresh-token.create", {
			user: user.id,
			token: this.randomTokenString(),
			expires: new Date(Date.now() + toMilliseconds(7, UnitType.Days)),
		}) as RefreshTokenData;
	}

	private randomTokenString(): string {
		return randomBytes(40).toString("hex");
	}

	private async getUser(email: string, ctx: Context<any>): Promise<UserData> {
		this.logger.info(`Loading user data for user: ${email}`);
		try {
			const user = (await ctx.call("v1.user.find", { query: { email } }) as UserData[])[0];
			return user;
		} catch (error) {
			throw new DatabaseError(error.message || "Couldn't load user via its email address.", error.code || 500, "user");
		}
	}

	private async getUserByID(id: string, ctx: Context<any>): Promise<UserData> {
		this.logger.info(`Loading user data for user: ${id}`);
		try {
			return await ctx.call("v1.user.get", { id }) as UserData;
		} catch (error) {
			throw new DatabaseError(error.message || "Couldn't load user via it id.", error.code || 500, "user");
		}
	}
}
