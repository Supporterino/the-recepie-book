"use strict";

import {Context, Errors, Service, ServiceBroker} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { DatabaseError, GetToken, GetTokenAndValidate, IsActive, IsExpired, MAX_PAGE_SIZE, PAGE_SIZE, RefreshTokenData } from "../../shared";

export default class RefreshTokenService extends Service {
	private DBConnection = new Connection("refresh-tokens").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "refresh-token",
            version: 1,
            mixins: [this.DBConnection, ErrorMixin],
			settings: {
				idField: "id",
				pageSize: PAGE_SIZE,
				maxPageSize: MAX_PAGE_SIZE,
				fields: [
					"id",
					"user",
					"token",
					"expires",
					"created",
					"revoked",
					"replacedByToken",
				],
				entityValidator: {
					user: "string",
					token: "string",
					expires: { type: "date", convert: true },
					created: { type: "date", convert: true, optional: true, default: new Date() },
					revoked: { type: "date", convert: true, optional: true },
					replacedByToken: { type: "string", optional: true },
				},
			},
			actions: {
				isExpired: {
					params: {
						token: "string",
					},
					handler: async (ctx: Context<IsExpired>): Promise<boolean> => await this.isExpired(ctx),
				},
				isActive: {
					params: {
						token: "string",
					},
					handler: async (ctx: Context<IsActive>): Promise<boolean> => await this.isActive(ctx),
				},
				getToken: {
					params: {
						token: "string",
					},
					handler: async (ctx: Context<GetToken>): Promise<RefreshTokenData> => await this.getToken(ctx),
				},
				getTokenAndValidate: {
					params: {
						token: "string",
					},
					handler: async (ctx: Context<GetTokenAndValidate>): Promise<RefreshTokenData> => await this.getTokenAndValidate(ctx),
				},
			},
		}, schema));
	}

	public async isExpired(ctx: Context<IsExpired>): Promise<boolean> {
		const token = ctx.params.token;
		this.logger.info(`RefreshToken[${token}] Checking if expired`);
		const refreshToken = await ctx.call("v1.refresh-token.getToken", { token }) as RefreshTokenData;
		return this.compareExpireDate(refreshToken);
	}

	public async isActive(ctx: Context<IsActive>): Promise<boolean> {
		const token = ctx.params.token;
		this.logger.info(`RefreshToken[${token}] Checking if is still active`);
		const refreshToken = await ctx.call("v1.refresh-token.getToken", { token }) as RefreshTokenData;
		this.logger.debug("Data", refreshToken);
		this.logger.debug("isExpired", this.compareExpireDate(refreshToken));
		this.logger.debug("RevokeDate not present", (refreshToken.revoked === null || refreshToken.revoked === undefined));
		this.logger.debug("IsActive", (refreshToken.revoked === null || refreshToken.revoked === undefined) && !this.compareExpireDate(refreshToken));
		return (refreshToken.revoked === null || refreshToken.revoked === undefined) && !this.compareExpireDate(refreshToken);
	}

	public async getTokenAndValidate(ctx: Context<GetTokenAndValidate>): Promise<RefreshTokenData> {
		const token = ctx.params.token;
		this.logger.info(`RefreshToken[${token}] Validating`);
		const refreshToken = await ctx.call("v1.refresh-token.getToken", { token }) as RefreshTokenData;
		if (!refreshToken) {throw new Errors.MoleculerError("No token with this ID found", 404);}
		if (!(await ctx.call("v1.refresh-token.isActive", { token }) as boolean)) {throw new Errors.MoleculerError("This token is invalid.", 400);}
		return refreshToken;
	}

	public async getToken(ctx: Context<GetToken>): Promise<RefreshTokenData> {
		const token = ctx.params.token;
		this.logger.info(`RefreshToken[${token}] Getting RefreshTokenData`);
		try {
			return (await ctx.call("v1.refresh-token.find", { query: { token }}) as RefreshTokenData[])[0];
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to find token by ID.", error.code || 500, this.name);
		}
	}

	private compareExpireDate(refreshToken: RefreshTokenData): boolean {
		return Date.now() >= refreshToken.expires.getTime();
	}
}
