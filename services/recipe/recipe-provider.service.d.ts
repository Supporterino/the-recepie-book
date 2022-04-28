import { Context, Service, ServiceBroker } from "moleculer";
import {
	Filter,
	GetById,
	GetByMinRating,
	GetByName,
	GetByTags,
	GetFromUser,
	RecipeData,
	ServiceMeta,
} from "../../shared";
import { Recipe } from "../../types";

declare class RecipeProviderService extends Service {
	public constructor(broker: ServiceBroker);

	public recipeDataConversion(
		ctx: Context<any, any>,
		res: RecipeData[] | RecipeData
	): Promise<Recipe | Recipe[]>;

	/**
	 * Returns all recipes of a user
	 *
	 * @method
	 * @param {String} recipeID - The id of the user to return from
	 * @returns {RecipeData} - The recipe as JSON string
	 */
	public getFromUser(
		ctx: Context<GetFromUser, ServiceMeta>
	): Promise<RecipeData[]>;

	/**
	 * Get's a list of 25 featured recipes from the data-store
	 *
	 * @method
	 * @returns {Array<RecipeData>}
	 */
	public getFeaturedRecipes(
		ctx: Context<null, ServiceMeta>
	): Promise<RecipeData[]>;

	/**
	 * Filters all recipes by multiple parameters
	 *
	 * @method
	 * @param {String} text - String to be inside the name of a recipe
	 * @param {Number} ratingMin - The minium rating a recipe should have
	 * @param {Array<string>} tags - A list of tags the recipe should habe
	 * @returns {Array<RecipeData>} - A list of matching recipes as JSON string
	 */
	public filterRecipes(
		ctx: Context<Filter, ServiceMeta>
	): Promise<RecipeData[]>;

	/**
	 * Returns all recipes with a higher rating than the provided number
	 *
	 * @method
	 * @param {number} rating - The minium rating of the recipes
	 * @returns {Array<RecipeData>} - A list of matching recipes as JSON string
	 */
	public getByMinRating(
		ctx: Context<GetByMinRating, ServiceMeta>
	): Promise<RecipeData[]>;

	/**
	 * Return a list of recipes matching one or all tags depending on the `intersect` parameter
	 *
	 * @method
	 * @param {Array<string>} tags - A list of tag names to match against the database
	 * @param {Boolean} intersect - Indicator if all or just one tag needs to be matched
	 * @returns {Array<RecipeData>} - A list of matching recipes as JSON string
	 */
	public getByTags(
		ctx: Context<GetByTags, ServiceMeta>
	): Promise<RecipeData[]>;

	/**
	 * Returns a list of recipes matching the provided string in their title
	 *
	 * @method
	 * @param {String} name - The string to search inside of the recipe titles
	 * @returns {Array<RecipeData>} - A list of matching recipes as JSON string
	 */
	public getByName(
		ctx: Context<GetByName, ServiceMeta>
	): Promise<RecipeData[]>;

	/**
	 * Returns a recipe by its ID inside the DB
	 *
	 * @method
	 * @param {String} recipeID - The id of the recipe to return
	 * @returns {RecipeData} - The recipe as JSON string
	 */
	public getById(
		ctx: Context<GetById, ServiceMeta>
	): Promise<RecipeData>;
}

export = RecipeProviderService;
