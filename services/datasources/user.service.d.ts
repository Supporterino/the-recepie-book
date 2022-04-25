import { Context, Service, ServiceBroker, ServiceSchema } from "moleculer";
import {
	GetSanitizedUserParams,
	IsLegitUserParams,
	OwnsRecipeParams,
	ServiceMeta,
	UserAvatarUpdateParams,
	ChangeUsernameParams,
} from "../../shared";
import { User } from "../../types";

declare class UserService extends Service {
	public constructor(broker: ServiceBroker, schema: ServiceSchema<{}>);

	public "user.newAvatar"(
		ctx: Context<UserAvatarUpdateParams>
	): Promise<void>;

	public changeUsername(
		ctx: Context<ChangeUsernameParams, ServiceMeta>
	): Promise<boolean>;

	public getSanitizedUser(
		ctx: Context<GetSanitizedUserParams, ServiceMeta>
	): Promise<User>;

	/**
	 * Check if a given pair of userid and email match the entry in the database
	 *
	 * @method
	 * @param {String} id - The user id
	 * @param {String} email
	 * @returns {Boolean}
	 */
	public isLegitUser(ctx: Context<IsLegitUserParams>): Promise<boolean>;

	/**
	 * Checks if the userID matches the owner of the recipe
	 *
	 * @method
	 * @param {String} userID
	 * @param {String} recipeID
	 * @returns {boolean}
	 */
	public ownsRecipe(
		ctx: Context<OwnsRecipeParams, ServiceMeta>
	): Promise<boolean>;
}

export = UserService;
