import { Context, Service, ServiceBroker } from "moleculer";
import { Authenticate, LoginServiceResponse, RefreshToken, RevokeToken, ServiceMeta } from "../../shared";

declare class LoginService extends Service {
	public constructor(broker: ServiceBroker)

	/**
	 * Try to login a user via its email and password and return a valid JWT and refresh token.
	 *
	 * @method
	 * @param {string} email
	 * @param {string} password
	 * @returns {LoginServiceResponse}
	 */
	public authenticate(ctx: Context<Authenticate>): Promise<LoginServiceResponse>

	/**
	 * Check if a refresh token is valid and owned by the user. if true return new JWT and refresh token.
	 *
	 * @method
	 * @param {string} token - the refreshtoken to renew
	 * @returns {LoginServiceResponse}
	 */
	public refreshToken(ctx: Context<RefreshToken>): Promise<LoginServiceResponse>

	/**
	 * Invalidate a refresh token if it is owned by the user.
	 *
	 * @method
	 * @param {string} token - the refreshtoken to renew
	 * @returns {LoginServiceResponse}
	 */
	public revokeToken(ctx: Context<RevokeToken, ServiceMeta>)
}
