import { Service, Context } from "moleculer";
import {
	AddFavoriteParams,
	GetFavoriteParams,
	IsFavoriteParams,
	RecipeDeletionParams,
	RemoveFavoriteParams,
	ServiceMeta,
} from "../../shared";
import { Recipe, FavoriteResponse } from "../../types";

declare class FavoriteService extends Service {
	/**
	 * Event to handle the deletion of {@link FavoriteData} when a recipe is deleted.
	 *
	 * @event
	 */
	public "recipe.deletion"(ctx: Context<RecipeDeletionParams>): Promise<void>;

	/**
	 * Check if a recipe is favorited
	 *
	 * @method
	 * @param {String} recipeID - The id of the recipe to check.
	 * @returns {FavoriteResponse}
	 */
	public isFavorite(
		ctx: Context<IsFavoriteParams, ServiceMeta>
	): Promise<boolean>;

	/**
	 * Get the favorites of any user. or the user itself if no id is provided
	 *
	 * @method
	 * @param {String} id - the user id to fetch favorites from [OPTIONAL]
	 * @returns {Array<Recipe>} - The favorited recipes of the user
	 */
	public getFavorites(
		ctx: Context<GetFavoriteParams, ServiceMeta>
	): Promise<Recipe[]>;

	/**
	 * Adds a new recipe to the favorites of the user.
	 *
	 * @method
	 * @param {String} recipeID - The id of the recipe to add.
	 * @returns {FavoriteResponse}
	 */
	public addFavorite(
		ctx: Context<AddFavoriteParams, ServiceMeta>
	): Promise<FavoriteResponse>;

	/**
	 * Remove a new recipe fromt the favorites of the user.
	 *
	 * @method
	 * @param {String} recipeID - The id of the recipe to remove.
	 * @returns {FavoriteResponse}
	 */
	public removeFavorite(
		ctx: Context<RemoveFavoriteParams, ServiceMeta>
	): Promise<FavoriteResponse>;
}

export = FavoriteService;
