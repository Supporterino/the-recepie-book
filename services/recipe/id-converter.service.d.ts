import { Context, Service, ServiceBroker } from "moleculer";
import { Recipe, RatingInfo } from "../../types";
import {
	ConvertRatingIDtoRatingParams,
	ConvertRecipeParams,
	ConvertRecipesParams,
	ConvertTagsToIDParams,
	ConvertTagsToNameParams,
	ServiceMeta,
} from "../../shared";

declare class IDConverterService extends Service {
	public constructor(broker: ServiceBroker);

	/**
	 * Converts the tags of a recipe to their ids via the tags service
	 *
	 * @method
	 * @param {Array<string>} tagNames - The tag names to convert
	 * @param {Array<string>}
	 */
	public convertTagsToID(
		ctx: Context<ConvertTagsToIDParams>
	): Promise<string[]>;

	/**
	 * Converts the tag ids of a recipe to their name via the tags service
	 *
	 * @method
	 * @param {Array<string>} tagIDs - The tag ids to convert
	 * @param {Array<string>}
	 */
	public convertTagsToName(
		ctx: Context<ConvertTagsToNameParams>
	): Promise<string[]>;

	/**
	 * Convert a rating id to the avg rating for this id
	 *
	 * @method
	 * @param {String} ratingID
	 * @returns {number}
	 */
	public convertRatingIDtoRating(
		ctx: Context<ConvertRatingIDtoRatingParams>
	): Promise<RatingInfo>;

	/**
	 * Convert an array of recipes by converting one by one.
	 *
	 * @method
	 * @param {Array<RecipeData>} recipes
	 * @returns {Array<Recipe>}
	 */
	public convertRecipes(
		ctx: Context<ConvertRecipesParams, ServiceMeta>
	): Promise<Recipe[]>;

	/**
	 * Converts a recipe from the internal data foramt with ids to the sendable object with all datas by resolving the ids.
	 *
	 * @method
	 * @param {RecipeData} recipe - The recipe to process
	 * @returns {Recipe}
	 */
	public convertRecipe(
		ctx: Context<ConvertRecipeParams, ServiceMeta>
	): Promise<Recipe>;
}

export = IDConverterService;
