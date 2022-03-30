"use strict";

import {Context, Errors, Service, ServiceBroker} from "moleculer";
import { sign, verify, VerifyErrors } from "jsonwebtoken";
import { hash, compare } from "bcrypt";
import { AuthPayload } from "../../types/authToken";
import { User } from "../../types/user";

export default class AuthService extends Service {
	private JWT_SECRET: string = "Rp2ipMvMT6zXUx%dLDdSGEo2Unehu5o%h5FPRYEG3sbbSAtT5ky&5zdmc3!7xCdn";
	private SALT_ROUNDS: number = 10;

	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "auth",
            version: 1,
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
					async handler(ctx) {
						return await this.login(ctx);
					},
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
					async handler(ctx) {
						return await this.register(ctx);
					},
				},
				resolveToken: {
					cache: {
						keys: ["token"],
						ttl: 60 * 60,
					},
					params: {
						token: "string",
					},
					handler(ctx) {
						return this.resolveToken(ctx);
					},
				},
				verifyToken: {
					params: {
						token: "string",
					},
					handler(ctx) {
						return verify(ctx.params.token, this.JWT_SECRET);
					},
				},
			},
		});
	}

	public async register(ctx: Context<any>) {
		const oldUser = (await this.broker.call("v1.user.find", { query: { email: ctx.params.email } }) as User[])[0];

		if (oldUser) {
			return Promise.reject(new Errors.MoleculerError("E-Mail already exists. Please login!", 409));
		}
		const user: User = {
			username: ctx.params.username,
			password: await hash(ctx.params.password, this.SALT_ROUNDS),
			email: ctx.params.email,
		};
		await this.broker.call("v1.user.create", { username: user.username, password: user.password, email: user.email });
		return `User (${user.username}) created.`;
	}

	public resolveToken(ctx: Context<any>) {
		return new this.Promise((resolve, reject) => {
			verify(ctx.params.token, this.JWT_SECRET, (err: VerifyErrors, decoded: User) => {
				if (err) {
					return reject(err);
				}
				resolve(decoded);
			});
		}).then(async (decoded: AuthPayload) => {
			if (decoded.id && await this.broker.call("v1.user.isLegitUser", { id: decoded.id, email: decoded.email })) {
				return decoded;
			}
		});
	}

	public async login(ctx: Context<any>): Promise<unknown> {
		const user = (await this.broker.call("v1.user.find", { query: { email: ctx.params.email } }) as User[])[0];

		if (user && await compare(ctx.params.password, user.password)) {
			return this.generateToken(user);
		} else {
			return Promise.reject(new Errors.MoleculerError("Invalid Credentials", 400));
		}
	}

	private generateToken(user: User) {
		return sign({ id:user.id, email: user.email } as AuthPayload, this.JWT_SECRET, { expiresIn: "6h" });
	}
}
