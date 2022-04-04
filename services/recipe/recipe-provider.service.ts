"use strict";

import { Context, Service, ServiceBroker} from "moleculer";
import { RatingData, RecipeData } from "../../shared/interfaces";
import { Recipe, FilterError, Tag } from "../../types";


export default class RecipeProviderService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "recipe-provider",
            version: 1,
			actions:{
				/**
				 * Returns a recipe by its ID inside the DB
				 *
				 * @method
				 * @param {String} id - The id of the recipe to return
				 * @returns {RecipeData} - The recipe as JSON string
				 */
				getById: {
					rest: {
						path: "/getById",
						method: "POST",
					},
					params: {
						id: {type: "string", min: 2},
					},
					async handler(ctx): Promise<RecipeData | FilterError> {
						return await this.getRecipeByID(ctx.params.id);
					},
				},
				/**
				 * Returns a list of recipes matching the provided string in their title
				 *
				 * @method
				 * @param {String} name - The string to search inside of the recipe titles
				 * @returns {Array<RecipeData>} - A list of matching recipes as JSON string
				 */
				getByName: {
					rest: {
						path: "/getByName",
						method: "POST",
					},
					params: {
						name: {type: "string", min: 2},
					},
					async handler(ctx): Promise<RecipeData[] | FilterError> {
						return await this.getRecipesByName(ctx.params.name);
					},
				},
				/**
				 * Return a list of recipes matching one or all tags depending on the `intersect` parameter
				 *
				 * @method
				 * @param {Array<string>} tags - A list of tag names to match against the database
				 * @param {Boolean} intersect - Indicator if all or just one tag needs to be matched
				 * @returns {Array<RecipeData>} - A list of matching recipes as JSON string
				 */
				getByTags: {
					rest: {
						path: "/getByTags",
						method: "POST",
					},
					params: {
						tags: {type: "array", min: 1, items: "string"},
						intersect: {type: "boolean", optional: true, default: false},
					},
					async handler(ctx): Promise<RecipeData[] | FilterError> {
						return await this.getRecipesByTags(ctx.params.tags, ctx.params.intersect);
					},
				},
				/**
				 * Returns all recipes with a higher rating than the provided number
				 *
				 * @method
				 * @param {number} rating - The minium rating of the recipes
				 * @returns {Array<RecipeData>} - A list of matching recipes as JSON string
				 */
				getByMinRating: {
					rest: {
						path: "/getByMinRating",
						method: "POST",
					},
					params: {
						rating: {type: "number"},
					},
					async handler(ctx): Promise<RecipeData[] | FilterError> {
						return await this.getRecipesByRating(ctx.params.rating);
					},
				},
				/**
				 * Filters all recipes by multiple parameters
				 *
				 * @method
				 * @param {String} text - String to be inside the name of a recipe
				 * @param {Number} ratingMin - The minium rating a recipe should have
				 * @param {Array<string>} tags - A list of tags the recipe should habe
				 * @returns {Array<RecipeData>} - A list of matching recipes as JSON string
				 */
				filter: {
					rest: {
						path: "/filter",
						method: "POST",
					},
					params: {
						text: {type: "string"},
						ratingMin: {type: "number"},
						tags: {type: "array", items:"string"},
					},
					async handler(ctx): Promise<RecipeData[] | FilterError> {
						return await this.filterRecipes(ctx.params.text, ctx.params.ratingMin, ctx.params.tags);
					},
				},
				/**
				 * Get's a list of 25 featured recipes from the data-store
				 *
				 * @method
				 * @returns {Array<RecipeData>}
				 */
				getFeaturedRecipes: {
					rest: {
						path: "/featuredRecipes",
						method: "GET",
					},
					async handler(ctx): Promise<RecipeData[]> {
						return await this.getFeatured();
					},
				},
			},
			hooks: {
				after: {
					"*"(ctx, res): Promise<Recipe | Recipe[] | FilterError> {
						return this.recipeDataConversion(ctx, res);
					},
				},
			},
		});
	}

	public async recipeDataConversion(ctx: Context<any, any>, res: RecipeData[] | RecipeData | FilterError): Promise<Recipe | Recipe[] | FilterError> {
		if (res instanceof FilterError) {return res;}
		if (res.constructor.name === "Array") {return await this.broker.call("v1.id-converter.convertRecipes", { recipes: res }) as Recipe[];}
		else {return await this.broker.call("v1.id-converter.convertRecipe", { recipe: res }) as Recipe;}

	}

	public async getFeatured(): Promise<RecipeData[]> {
		// Develop cool idea to get good recipes for requesting user
		const count = await this.broker.call("v1.data-store.count");
		if (count <= 25) {
			return await this.broker.call("v1.data-store.find");
		} else {
			return await this.broker.call("v1.data-store.find", { limit: 25 });
		}
	}

	public async filterRecipes(name: string, rating: number, tags: string[]): Promise<RecipeData[] | FilterError> {
		this.logger.info("Filtering with following settings:", name, rating, tags);
		if (name === "" && tags.length === 0 && rating === 0) {return await this.getFeatured();}
		else if (name !== "" && tags.length === 0) {return await this.getByNameAndRating(name, rating);}
		else if (name !== "" && tags.length > 0) {return await this.getByNameAndRatingAndTags(name, rating, tags);}
		else if (name === "" && tags.length === 0) {return await this.broker.call("v1.recipe-provider.getByMinRating", { rating });}
		else if (name === "" && tags.length > 0) {return await this.getByRatingAndTags(rating, tags);}
		else {return {
			name: "FilterError",
			message: "No valid filter provided.",
		} as FilterError;}
	}

	public async getRecipesByRating(rating: number): Promise<RecipeData[] | FilterError> {
		this.logger.info(`Fetching recipes with rating over ${rating}`);
		try {
			const possibleIDs = await this.getPossibleIDsForRating(rating);
			return await this.broker.call("v1.data-store.get", { id: possibleIDs }) as RecipeData[];
		} catch (error) {
			return {
				name: "FilterError",
				message: `${error.message}`,
				filterType: "byRating",
			} as FilterError;
		}
	}

	public async getRecipesByTags(tags: string[], intersect: boolean): Promise<RecipeData[]> {
		const tagIDs = await this.convertTagsInIDs(tags);
		this.logger.info(`Fetching recipes for multiple tags (intersected=${intersect}): ${tags}`);
		let out = Array<RecipeData>();
		for (const tag of tagIDs) {
			out = out.concat(await this.getRecipesByTag(tag));
		}
		if (intersect) {
			this.logger.debug("Intersecting all tags in array", out);
			out = this.intersectArray(out, tagIDs);
		}
		return  out;
	}

	public async getRecipesByName(name: string): Promise<RecipeData[] | FilterError> {
		this.logger.info(`Fetching recipes with name which includes: ${name}`);
		try {
			return await this.broker.call("v1.data-store.find", { query: { name: { $regex: name, $options: "i" } } }) as RecipeData[];
		} catch (error) {
			return {
				name: "FilterError",
				message: `${error.message}`,
				filterType: "byName",
			} as FilterError;
		}
	}

	public async getRecipeByID(id: string): Promise<RecipeData | FilterError> {
		this.logger.info(`Fetching recipe with ID: ${id}`);
		try {
			return  await this.broker.call("v1.data-store.get", { id }) as RecipeData;
		} catch (error) {
			return {
				name: "FilterError",
				message: `${error.message}`,
				filterType: "byID",
			} as FilterError;
		}
	}

	private async getByNameAndRating(name: string, rating: number): Promise<RecipeData[] | FilterError> {
		this.logger.debug(`Fetching recipe with Name: ${name} and rating over: ${rating}`);
		try {
			const possibleIDs = await this.getPossibleIDsForRating(rating);
			return  await this.broker.call("v1.data-store.find", { query: { id: { $in: possibleIDs }, name: { $regex: name, $options: "i" } } }) as RecipeData[];
		} catch (error) {
			return {
				name: "FilterError",
				message: `${error.message}`,
				filterType: "byNameAndRating",
			} as FilterError;
		}
	}

	private async getByNameAndRatingAndTags(name: string, rating: number, tagNames: string[]): Promise<RecipeData[] | FilterError> {
		this.logger.debug(`Fetching recipe with Name: ${name} and rating over: ${rating} and tags: ${tagNames}`);
		try {
			const [tagIDs, possibleIDs] = await Promise.all([this.convertTagsInIDs(tagNames), this.getPossibleIDsForRating(rating)]);
			return  await this.broker.call("v1.data-store.find", { query: { id: { $in: possibleIDs }, name: { $regex: name, $options: "i" }, tags: { $all: tagIDs } } }) as RecipeData[];
		} catch (error) {
			return {
				name: "FilterError",
				message: `${error.message}`,
				filterType: "byNameAndRatingAndTags",
			} as FilterError;
		}
	}

	private async getByRatingAndTags(rating: number, tagNames: string[]): Promise<RecipeData[] | FilterError> {
		this.logger.debug(`Fetching recipe with rating over: ${rating} and tags: ${tagNames}`);
		try {
			const [tagIDs, possibleIDs] = await Promise.all([this.convertTagsInIDs(tagNames), this.getPossibleIDsForRating(rating)]);
			return  await this.broker.call("v1.data-store.find", { query: { id: { $in: possibleIDs }, tags: { $all: tagIDs } } }) as RecipeData[];
		} catch (error) {
			return {
				name: "FilterError",
				message: `${error.message}`,
				filterType: "byRatingAndTags",
			} as FilterError;
		}
	}

	private async getPossibleIDsForRating(rating: number): Promise<string[]> {
		this.logger.debug(`[Provider] Getting possible ids for rating > ${rating}`);
		return (await this.broker.call("v1.rating.find", { query: { avgRating: { $gte: rating } } }) as RatingData[]).map(e => e.recipeID);
	}

	private async convertTagsInIDs(tags: string[]): Promise<string[]> {
		this.logger.debug("Converting tags to their matching ids.", tags);
		const ids = new Array<string>();
		for (const tag of tags) {
			ids.push((await this.broker.call("v1.tags.getByString", { name: tag }) as Tag[])[0].id);
		}
		return ids;
	}

	private async getRecipesByTag(tagID: string): Promise<RecipeData[]> {
		this.logger.debug(`Fetching recipes with tag: ${tagID}`);
		return await this.broker.call("v1.data-store.find", { query: { tags: { $regex: tagID, $options: "i" } } }) as RecipeData[];
	}

	private intersectArray(recipes: RecipeData[], tags: string[]): RecipeData[] {
		const toReturn = new Array<RecipeData>();
		recipes.forEach((recipe: RecipeData) => {
			if (tags.every(tag => recipe.tags.includes(tag))) {toReturn.push(recipe);}
		});
		return toReturn;
	}
}
