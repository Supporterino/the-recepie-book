import { Context, Service, ServiceBroker, ServiceSchema } from "moleculer";
import {
	AddToCookListParams,
	IsOnCookListParams,
	RecipeDeletionParams,
	RemoveFromCookListParams,
	ServiceMeta,
} from "../../shared";
import { CookListResponse, Recipe } from "../../types";

declare class CookListService extends Service {
	public constructor(broker: ServiceBroker, schema: ServiceSchema<{}>);

	/**
	 * Check if a recipe is on cook list
	 *
	 * @method
	 * @param {String} recipeID - The id of the recipe to check.
	 * @returns {boolean}
	 */
	public isOnCookList(
		ctx: Context<IsOnCookListParams, ServiceMeta>
	): Promise<boolean>;

	/**
	 * Get's the to cook list for user making the request. User id is sourced from meta payload.
	 *
	 * @method
	 * @returns {Array<Recipe>} - The to cook recipes of the user
	 */
	public getCookList(ctx: Context<null, ServiceMeta>): Promise<Recipe[]>;

	/**
	 * Adds a new recipe to the cook list of the user.
	 *
	 * @method
	 * @param {String} recipeID - The id of the recipe to add.
	 * @returns {CookListResponse}
	 */
	public addToCookList(
		ctx: Context<AddToCookListParams, ServiceMeta>
	): Promise<CookListResponse>;

	/**
	 * Remove a new recipe fromt the cook list of the user.
	 *
	 * @method
	 * @param {String} recipeID - The id of the recipe to remove.
	 * @returns {CookListResponse}
	 */
	public removeFromCookList(
		ctx: Context<RemoveFromCookListParams, ServiceMeta>
	): Promise<CookListResponse>;

	/**
	 * Event to handle the deletion of {@link CookListData} when a recipe is deleted.
	 *
	 * @event
	 */
	public "recipe.deletion"(ctx: Context<RecipeDeletionParams>): Promise<void>;
}

export = CookListService;
