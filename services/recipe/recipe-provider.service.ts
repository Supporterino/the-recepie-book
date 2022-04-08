"use strict";

import { Context, Service, ServiceBroker} from "moleculer";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { BaseError, DatabaseError, FilterError, FilterParams, FilterType, GetByIdParams, GetByMinRatingParams, GetByNameParams, GetByTagsParams, RatingData, RecipeData } from "../../shared";
import { Recipe, Tag } from "../../types";


export default class RecipeProviderService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "recipe-provider",
            version: 1,
			mixins: [ErrorMixin],
			actions:{
				/**
				 * Returns a recipe by its ID inside the DB
				 *
				 * @method
				 * @param {String} recipeID - The id of the recipe to return
				 * @returns {RecipeData} - The recipe as JSON string
				 */
				getById: {
					rest: {
						path: "/getById",
						method: "POST",
					},
					params: {
						recipeID: {type: "string", min: 2},
					},
					async handler(ctx: Context<GetByIdParams>): Promise<RecipeData> {
						return await this.getRecipeByID(ctx.params.recipeID);
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
					async handler(ctx: Context<GetByNameParams>): Promise<RecipeData[]> {
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
					async handler(ctx: Context<GetByTagsParams>): Promise<RecipeData[]> {
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
					async handler(ctx: Context<GetByMinRatingParams>): Promise<RecipeData[]> {
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
					async handler(ctx: Context<FilterParams>): Promise<RecipeData[]> {
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
					async handler(ctx: Context<null>): Promise<RecipeData[]> {
						return await this.getFeatured();
					},
				},
			},
			hooks: {
				after: {
					"*"(ctx, res): Promise<Recipe | Recipe[]> {
						return this.recipeDataConversion(ctx, res);
					},
				},
			},
		});
	}

	public async recipeDataConversion(ctx: Context<any, any>, res: RecipeData[] | RecipeData): Promise<Recipe | Recipe[]> {
		if (res.constructor.name === "Array") {return await this.broker.call("v1.id-converter.convertRecipes", { recipes: res }) as Recipe[];}
		else {return await this.broker.call("v1.id-converter.convertRecipe", { recipe: res }) as Recipe;}
	}

	public async getFeatured(): Promise<RecipeData[]> {
		try {
			// Develop cool idea to get good recipes for requesting user
			const count = await this.broker.call("v1.data-store.count");
			if (count <= 25) {
				return await this.broker.call("v1.data-store.find");
			} else {
				return await this.broker.call("v1.data-store.find", { limit: 25 });
			}
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to fetch featured recipes.", error.code || 500, "data-store");
		}
	}

	public async filterRecipes(name: string, rating: number, tags: string[]): Promise<RecipeData[]> {
		this.logger.info("Filtering with following settings:", name, rating, tags);
		if (name === "" && tags.length === 0 && rating === 0) {return await this.getFeatured();}
		else if (name === "" && tags.length === 0 && rating > 0) {return await this.getRecipesByRating(rating);}
		else if (name !== "" && tags.length === 0 && rating === 0) {return await this.getRecipesByName(name);}
		else if (name !== "" && tags.length === 0 && rating > 0) {return await this.getByNameAndRating(name, rating);}
		else if (name === "" && tags.length > 0 && rating === 0) {return await this.getRecipesByTags(tags, true);}
		else if (name === "" && tags.length > 0 && rating > 0) {return await this.getByRatingAndTags(rating, tags);}
		else if (name !== "" && tags.length > 0 && rating === 0) {return await this.getByNameAndTags(name, tags);}
		else if (name !== "" && tags.length > 0 && rating > 0) {return await this.getByNameAndRatingAndTags(name, rating, tags);}
		else {
			throw new FilterError("The provided filters do not match any allowed combination.", 400, FilterType.FULL);
		}
	}

	public async getRecipesByRating(rating: number): Promise<RecipeData[]> {
		this.logger.info(`Fetching recipes with rating over ${rating}`);
		try {
			const possibleIDs = await this.getPossibleIDsForRating(rating);
			return await this.broker.call("v1.data-store.get", { id: possibleIDs }) as RecipeData[];
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.RATING);
			}
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

	public async getRecipesByName(name: string): Promise<RecipeData[]> {
		this.logger.info(`Fetching recipes with name which includes: ${name}`);
		try {
			return await this.broker.call("v1.data-store.find", { query: { name: { $regex: name, $options: "i" } } }) as RecipeData[];
		} catch (error) {
			throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.NAME);
		}
	}

	public async getRecipeByID(id: string): Promise<RecipeData> {
		this.logger.info(`Fetching recipe with ID: ${id}`);
		try {
			return  await this.broker.call("v1.data-store.get", { id }) as RecipeData;
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to fetch RecipeData by ID.", error.code || 500, "data-store");
		}
	}

	private async getByNameAndRating(name: string, rating: number): Promise<RecipeData[]> {
		this.logger.debug(`Fetching recipe with Name: ${name} and rating over: ${rating}`);
		try {
			const possibleIDs = await this.getPossibleIDsForRating(rating);
			return  await this.broker.call("v1.data-store.findOverID", { query: { _id: { $in: possibleIDs }, name: { $regex: name, $options: "i" } } }) as RecipeData[];
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.RATING_AND_NAME);
			}
		}
	}

	private async getByNameAndRatingAndTags(name: string, rating: number, tagNames: string[]): Promise<RecipeData[]> {
		this.logger.debug(`Fetching recipe with Name: ${name} and rating over: ${rating} and tags: ${tagNames}`);
		try {
			const [tagIDs, possibleIDs] = await Promise.all([this.convertTagsInIDs(tagNames), this.getPossibleIDsForRating(rating)]);
			return  await this.broker.call("v1.data-store.findOverID", { query: { _id: { $in: possibleIDs }, name: { $regex: name, $options: "i" }, tags: { $all: tagIDs } } }) as RecipeData[];
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.RATING_AND_NAME_AND_TAGS);
			}
		}
	}

	private async getByNameAndTags(name: string, tagNames: string[]): Promise<RecipeData[]> {
		this.logger.debug(`Fetching recipe with Name: ${name} and tags: ${tagNames}`);
		try {
			const tagIDs = await this.convertTagsInIDs(tagNames);
			return  await this.broker.call("v1.data-store.find", { query: { name: { $regex: name, $options: "i" }, tags: { $all: tagIDs } } }) as RecipeData[];
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.NAME_AND_TAGS);
			}
		}
	}

	private async getByRatingAndTags(rating: number, tagNames: string[]): Promise<RecipeData[]> {
		this.logger.debug(`Fetching recipe with rating over: ${rating} and tags: ${tagNames}`);
		try {
			const [tagIDs, possibleIDs] = await Promise.all([this.convertTagsInIDs(tagNames), this.getPossibleIDsForRating(rating)]);
			return await this.broker.call("v1.data-store.findOverID", { query: { _id: { $in: possibleIDs }, tags: { $all: tagIDs } } }) as RecipeData[];
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.RATING_AND_TAGS);
			}
		}
	}

	private async getPossibleIDsForRating(rating: number): Promise<string[]> {
		try {
			this.logger.debug(`[Provider] Getting possible ids for rating > ${rating}`);
			return (await this.broker.call("v1.rating.find", { query: { avgRating: { $gte: rating } } }) as RatingData[]).map(e => e.recipeID);
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to fetch recipe IDs by rating.", error.code || 500, "rating");
		}
	}

	private async convertTagsInIDs(tags: string[]): Promise<string[]> {
		this.logger.debug("Converting tags to their matching ids.", tags);
		try {
			const ids = new Array<string>();
			for (const tag of tags) {
				ids.push((await this.broker.call("v1.tags.getByString", { name: tag }) as Tag[])[0].id);
			}
			return ids;
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new FilterError(error.message || "Failed to convert tags to their ID", error.code || 500, FilterType.INTERNAL);
			}
		}
	}

	private async getRecipesByTag(tagID: string): Promise<RecipeData[]> {
		try {
			this.logger.debug(`Fetching recipes with tag: ${tagID}`);
			return await this.broker.call("v1.data-store.find", { query: { tags: { $regex: tagID, $options: "i" } } }) as RecipeData[];
		} catch (error) {
			throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.TAG);
		}
	}

	private intersectArray(recipes: RecipeData[], tags: string[]): RecipeData[] {
		const toReturn = new Array<RecipeData>();
		recipes.forEach((recipe: RecipeData) => {
			if (tags.every(tag => recipe.tags.includes(tag))) {toReturn.push(recipe);}
		});
		return toReturn;
	}
}
