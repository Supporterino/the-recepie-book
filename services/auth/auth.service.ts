"use strict";

import {Context, Errors, Service, ServiceBroker} from "moleculer";
import { sign, verify, VerifyErrors } from "jsonwebtoken";
import { hash, compare } from "bcrypt";
import { Auth, LoginResponse, User } from "../../types";
import { DatabaseError } from "../../shared";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { UserData } from "../../shared/interfaces/userData";

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
				/**
				 * Logs a user in by giving him a valid JWT token. A user is authenticated, when the password matches the one stored in the database for that email.
				 *
				 * @method
				 * @param {String} email - the email address of the user
				 * @param {String} password - the password to check against the salt in the DB
				 * @returns {String | Errors.MoleculerError} - The JWT token or a invalid credentrials error
				 */
				login: {
					rest: {
						path: "/login",
						method: "POST",
					},
					params: {
						email: { type: "email", normalize: true },
						password: "string",
					},
					async handler(ctx): Promise<LoginResponse | Errors.MoleculerError> {
						return await this.login(ctx);
					},
				},
				/**
				 * Checks if the user already exists. If not the password is hashed and the new user is safed in the user database.
				 *
				 * @method
				 * @param {String} username - The name of the new account
				 * @param {String} password - The password for the new account
				 * @param {String} email - The email to link to the account, has to be unique over all accounts
				 * @returns {String | Errors.MoleculerError} - A string to indicate successful registration or an error if the email is already in use
				 */
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
					async handler(ctx): Promise<string | Errors.MoleculerError> {
						return await this.register(ctx);
					},
				},
				/**
				 * Checks if a JWT token is valid and if it isn't expired it returns the encoded {@link Auth} data.
				 *
				 * @method
				 * @param {String} token - The token to validate and extract
				 * @returns {Auth} - The decoded {@link Auth} data
				 */
				resolveToken: {
					cache: {
						keys: ["token"],
						ttl: 60 * 60,
					},
					params: {
						token: "string",
					},
					handler(ctx): PromiseLike<Auth | Promise<Auth>> {
						return this.resolveToken(ctx);
					},
				},
			},
		});
	}

	public async register(ctx: Context<any>): Promise<string | Errors.MoleculerError> {
		this.logger.info("Checking if user is already registered.", ctx.params.email);
		const oldUser = await this.getUser(ctx.params.email);

		if (oldUser) {
			this.logger.warn(`${oldUser.email} has already a registered account.`);
			return Promise.reject(new Errors.MoleculerError("E-Mail already exists. Please login!", 409));
		}
		const user = {
			username: ctx.params.username,
			password: await hash(ctx.params.password, this.SALT_ROUNDS),
			email: ctx.params.email,
			joinedAt: new Date(),
		} as UserData;
		try {
			this.logger.info(`Creating new account(${user.username}) for email: ${user.email}`);
			await this.broker.call("v1.user.create", { username: user.username, password: user.password, email: user.email, joinedAt: user.joinedAt });
			return `User[${user.username}] created.`;
		} catch (error) {
			throw new DatabaseError(error.message || "Creation of user failed.", error.code || 500, "user");
		}
	}

	public resolveToken(ctx: Context<any>): PromiseLike<Auth | Promise<Auth>> {
		return new this.Promise((resolve, reject) => {
			verify(ctx.params.token, this.JWT_SECRET, (err: VerifyErrors, decoded: Auth) => {
				if (err) {
					return reject(err);
				}
				resolve(decoded);
			});
		}).then(async (decoded: Auth) => {
			if (decoded.id && await this.broker.call("v1.user.isLegitUser", { userID: decoded.id, email: decoded.email })) {
				return decoded;
			}
		});
	}

	public async login(ctx: Context<any>): Promise<LoginResponse | Errors.MoleculerError> {
		const user = await this.getUser(ctx.params.email);

		if (user && await compare(ctx.params.password, user.password)) {
			this.logger.info(`${ctx.params.email} logged in.`);
			return {
				token: this.generateToken(user),
				userID: user.id,
				msg: "Login successful",
			} as LoginResponse;
		} else {
			this.logger.warn("Wrong password for user.", ctx.params.email);
			return Promise.reject(new Errors.MoleculerError("Invalid Credentials", 400));
		}
	}

	private generateToken(user: UserData): string {
		this.logger.info(`Generating token for ${user.email}`);
		return sign({ id:user.id, email: user.email } as Auth, this.JWT_SECRET, { expiresIn: "6h" });
	}

	private async getUser(email: string): Promise<UserData> {
		this.logger.info(`Loading user data for user: ${email}`);
		try {
			const user = (await this.broker.call("v1.user.find", { query: { email } }) as UserData[])[0];
			return user;
		} catch (error) {
			throw new DatabaseError(error.message || "Couldn't load user via its email address.", error.code || 500, "user");
		}
	}
}
