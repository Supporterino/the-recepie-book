import { Context, Service, ServiceBroker } from "moleculer";
import { Auth, LoginResponse } from "../../types";
import {
	Authenticate,
	RefreshToken,
	RegisterParams,
	RevokeToken,
	ServiceMeta,
} from "../../shared";

declare class AuthService extends Service {
	public constructor(broker: ServiceBroker);

	/**
	 * Checks if the user already exists. If not the password is hashed and the new user is safed in the user database.
	 *
	 * @method
	 * @param {String} username - The name of the new account
	 * @param {String} password - The password for the new account
	 * @param {String} email - The email to link to the account, has to be unique over all accounts
	 * @returns {String}
	 */
	public register(ctx: Context<RegisterParams>): Promise<string>;

	/**
	 * Checks if a JWT token is valid and if it isn't expired it returns the encoded {@link Auth} data.
	 *
	 * @method
	 * @param {String} token - The token to validate and extract
	 * @returns {Auth} - The decoded {@link Auth} data
	 */
	public resolveToken(ctx: Context<any>): Promise<Auth>;

	/**
	 * REST endpoint to trigger a token refresh
	 *
	 * @method
	 * @param {String} token
	 * @returns {LoginResponse}
	 */
	public refreshToken(ctx: Context<RefreshToken>): Promise<LoginResponse>;

	/**
	 * REST endpoint to trigger a revokation of a refresh token
	 *
	 * @method
	 * @param {String} token
	 */
	public revokeToken(ctx: Context<RevokeToken, ServiceMeta>): Promise<void>;

	/**
	 * Logs a user in by giving him a valid JWT token. A user is authenticated, when the password matches the one stored in the database for that email.
	 *
	 * @method
	 * @param {String} email - the email address of the user
	 * @param {String} password - the password to check against the salt in the DB
	 * @returns {LoginResponse}
	 */
	public login(ctx: Context<Authenticate>): Promise<LoginResponse>;
}

export = AuthService;
