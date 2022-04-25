import { Context, Service, ServiceBroker, ServiceSchema } from "moleculer";
import {
	GetToken,
	GetTokenAndValidate,
	IsActive,
	IsExpired,
	RefreshTokenData,
} from "../../shared";

declare class RefreshTokenService extends Service {
	constructor(broker: ServiceBroker, schema: ServiceSchema<{}>);
	/**
	 * Check if a {@link RefreshTokenData}'s expiration date is reached.
	 *
	 * @method
	 * @param {string} token - The refresh token to check expration of.
	 * @returns {boolean}
	 */
	public isExpired(ctx: Context<IsExpired>): Promise<boolean>;

	/**
	 * Check if a refresh token is still active by checking if it is expired or replaced by a new token.
	 *
	 * @method
	 * @param {string} token - The refresh token to check expration of.
	 * @returns {boolean}
	 */
	public isActive(ctx: Context<IsActive>): Promise<boolean>;

	/**
	 * Get the {@link RefreshTokenData} for a refresh token.
	 *
	 * @method
	 * @param {string} token - The refresh token to check expration of.
	 * @returns {RefreshTokenData}
	 */
	public getToken(ctx: Context<GetToken>): Promise<RefreshTokenData>;

	/**
	 * Get the {@link RefreshTokenData} for a refresh token if it is still active.
	 *
	 * @method
	 * @param {string} token - The refresh token to check expration of.
	 * @returns {RefreshTokenData}
	 */
	public getTokenAndValidate(
		ctx: Context<GetTokenAndValidate>
	): Promise<RefreshTokenData>;
}

export = RefreshTokenService;
