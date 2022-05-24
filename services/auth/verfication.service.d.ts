import { Context, Service, ServiceBroker, ServiceSchema } from "moleculer";
import {
	CompletePasswordReset,
	CompleteVerification,
	ServiceMeta,
	StartPasswordReset,
} from "../../shared";

declare class VerificationService extends Service {
	public constructor(broker: ServiceBroker, schema: ServiceSchema<{}>);

	/**
	 * Second part of the password reset. The user is loaded via it's ID and the token is checked for a match. The new password gets set for the user.
	 * @param {string} userID
	 * @param {string} token
	 * @param {string} newPassword
	 */
	public completePasswordReset(
		ctx: Context<CompletePasswordReset>
	): Promise<void>;

	/**
	 * Starts a password reset for a user via its email address. If the user's email is verified a email is sent to it to start the reset procedure
	 * @param {string} email
	 */
	public startPasswordReset(ctx: Context<StartPasswordReset>): Promise<void>;

	/**
	 * Second part of the verification process. The a paramter is the linked VerificationData's ID and b is the token. If both match the user is verified.
	 * @param {string} a
	 * @param {string} b
	 */
	public completeVerification(
		ctx: Context<CompleteVerification>
	): Promise<void>;

	/**
	 * Start the verification process for a user's email address by sending a verfication link to it. Email is loaded over the {@link Auth} object.
	 */
	public startEmailVerification(
		ctx: Context<null, ServiceMeta>
	): Promise<void>;
}

export = VerificationService;
