"use strict";

import { Context, Service, ServiceBroker} from "moleculer";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { BaseError, DatabaseError, FilterError, FilterParams, FilterType, GetByIdParams, GetByMinRatingParams, GetByNameParams, GetByTagsParams, GetFromUserParams, RatingData, RecipeData, ServiceMeta } from "../../shared";
import { Recipe, Tag } from "../../types";


export default class RecipeProviderService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "recipe-provider",
            version: 1,
			mixins: [ErrorMixin],
			actions:{
				getById: {
					rest: {
						path: "/getById",
						method: "POST",
					},
					params: {
						recipeID: {type: "string", min: 2},
					},
					handler: async (ctx: Context<GetByIdParams, ServiceMeta>): Promise<RecipeData> => await this.getById(ctx),
				},
				 getFromUser: {
					rest: {
						path: "/getFromUser",
						method: "POST",
					},
					params: {
						userID: "string",
					},
					handler: async (ctx: Context<GetFromUserParams, ServiceMeta>): Promise<RecipeData[]> => await this.getFromUser(ctx),
				},
				 getMyRecipes: {
					rest: {
						path: "/getMyRecipes",
						method: "GET",
					},
					handler: async (ctx: Context<null, ServiceMeta>): Promise<RecipeData[]> => await this.getFromUser(ctx),
				},
				getByName: {
					rest: {
						path: "/getByName",
						method: "POST",
					},
					params: {
						name: {type: "string", min: 2},
					},
					handler: async (ctx: Context<GetByNameParams, ServiceMeta>): Promise<RecipeData[]> => await this.getByName(ctx),
				},
				getByTags: {
					rest: {
						path: "/getByTags",
						method: "POST",
					},
					params: {
						tags: {type: "array", min: 1, items: "string"},
						intersect: {type: "boolean", optional: true, default: false},
					},
					handler: async (ctx: Context<GetByTagsParams, ServiceMeta>): Promise<RecipeData[]> => await this.getByTags(ctx),
				},
				getByMinRating: {
					rest: {
						path: "/getByMinRating",
						method: "POST",
					},
					params: {
						rating: {type: "number"},
					},
					handler: async (ctx: Context<GetByMinRatingParams, ServiceMeta>): Promise<RecipeData[]> => await this.getByMinRating(ctx),
				},
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
					handler: async (ctx: Context<FilterParams, ServiceMeta>): Promise<RecipeData[]> => await this.filterRecipes(ctx),
				},
				getFeaturedRecipes: {
					rest: {
						path: "/featuredRecipes",
						method: "GET",
					},
					handler: async (ctx: Context<null, ServiceMeta>): Promise<RecipeData[]> => await this.getFeaturedRecipes(ctx),
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
		if (res.constructor.name === "Array") {return await ctx.call("v1.id-converter.convertRecipes", { recipes: res }, { meta: ctx.meta }) as Recipe[];}
		else {return await ctx.call("v1.id-converter.convertRecipe", { recipe: res }, { meta: ctx.meta }) as Recipe;}
	}

	public async getFromUser(ctx: Context<GetFromUserParams, ServiceMeta>): Promise<RecipeData[]> {
		const userID = ctx.params.userID || ctx.meta.user.id;
		this.logger.info(`Fetching recipe for user: ${userID}`);
		try {
			return  await ctx.call("v1.data-store.find", { query: { owner: userID } }) as RecipeData[];
		} catch (error) {
			throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.USER);
		}
	}

	public async getFeaturedRecipes(ctx: Context<null, ServiceMeta>): Promise<RecipeData[]> {
		try {
			// Develop cool idea to get good recipes for requesting user
			const count = await ctx.call("v1.data-store.count");
			if (count <= 25) {
				return await ctx.call("v1.data-store.find");
			} else {
				return await ctx.call("v1.data-store.find", { limit: 25 });
			}
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to fetch featured recipes.", error.code || 500, "data-store");
		}
	}

	public async filterRecipes(ctx: Context<FilterParams, ServiceMeta>): Promise<RecipeData[]> {
		const [ name, rating, tags ] = [ ctx.params.text, ctx.params.ratingMin, ctx.params.tags ];
		this.logger.info("Filtering with following settings:", name, rating, tags);
		if (name === "" && tags.length === 0 && rating === 0) {return await ctx.call("v1.recipe-provider.getFeaturedRecipes");}
		else if (name === "" && tags.length === 0 && rating > 0) {return await this.getRecipesByRating(rating);}
		else if (name !== "" && tags.length === 0 && rating === 0) {return await this.getRecipesByName(name);}
		else if (name !== "" && tags.length === 0 && rating > 0) {return await this.getByNameAndRating(name, rating, ctx);}
		else if (name === "" && tags.length > 0 && rating === 0) {return await ctx.call("v1.recipe-provider.getByTags", { tags, intersect: true });}
		else if (name === "" && tags.length > 0 && rating > 0) {return await this.getByRatingAndTags(rating, tags, ctx);}
		else if (name !== "" && tags.length > 0 && rating === 0) {return await this.getByNameAndTags(name, tags, ctx);}
		else if (name !== "" && tags.length > 0 && rating > 0) {return await this.getByNameAndRatingAndTags(name, rating, tags, ctx);}
		else {
			throw new FilterError("The provided filters do not match any allowed combination.", 400, FilterType.FULL);
		}
	}

	public async getByMinRating(ctx: Context<GetByMinRatingParams, ServiceMeta>): Promise<RecipeData[]> {
		const rating = ctx.params.rating;
		this.logger.info(`Fetching recipes with rating over ${rating}`);
		try {
			const possibleIDs = await this.getPossibleIDsForRating(rating, ctx);
			return await ctx.call("v1.data-store.get", { id: possibleIDs }) as RecipeData[];
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.RATING);
			}
		}
	}

	public async getByTags(ctx: Context<GetByTagsParams, ServiceMeta>): Promise<RecipeData[]> {
		const [ tags, intersect ] = [ ctx.params.tags, ctx.params.intersect ];
		const tagIDs = await this.convertTagsInIDs(tags, ctx);
		this.logger.info(`Fetching recipes for multiple tags (intersected=${intersect}): ${tags}`);
		let out = Array<RecipeData>();
		for (const tag of tagIDs) {
			out = out.concat(await this.getRecipesByTag(tag, ctx));
		}
		if (intersect) {
			this.logger.debug("Intersecting all tags in array", out);
			out = this.intersectArray(out, tagIDs);
		}
		return  out;
	}

	public async getByName(ctx: Context<GetByNameParams, ServiceMeta>): Promise<RecipeData[]> {
		const name = ctx.params.name;
		this.logger.info(`Fetching recipes with name which includes: ${name}`);
		try {
			return await ctx.call("v1.data-store.find", { query: { name: { $regex: name, $options: "i" } } }) as RecipeData[];
		} catch (error) {
			throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.NAME);
		}
	}

	public async getById(ctx: Context<GetByIdParams, ServiceMeta>): Promise<RecipeData> {
		const recipeID = ctx.params.recipeID;
		this.logger.info(`Fetching recipe with ID: ${recipeID}`);
		try {
			return  await ctx.call("v1.data-store.get", { id: recipeID }) as RecipeData;
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to fetch RecipeData by ID.", error.code || 500, "data-store");
		}
	}

	private async getByNameAndRating(name: string, rating: number, ctx: Context<any, any>): Promise<RecipeData[]> {
		this.logger.debug(`Fetching recipe with Name: ${name} and rating over: ${rating}`);
		try {
			const possibleIDs = await this.getPossibleIDsForRating(rating, ctx);
			return  await ctx.call("v1.data-store.findOverID", { query: { _id: { $in: possibleIDs }, name: { $regex: name, $options: "i" } } }) as RecipeData[];
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.RATING_AND_NAME);
			}
		}
	}

	private async getByNameAndRatingAndTags(name: string, rating: number, tagNames: string[], ctx: Context<any, any>): Promise<RecipeData[]> {
		this.logger.debug(`Fetching recipe with Name: ${name} and rating over: ${rating} and tags: ${tagNames}`);
		try {
			const [tagIDs, possibleIDs] = await Promise.all([this.convertTagsInIDs(tagNames, ctx), this.getPossibleIDsForRating(rating, ctx)]);
			return  await ctx.call("v1.data-store.findOverID", { query: { _id: { $in: possibleIDs }, name: { $regex: name, $options: "i" }, tags: { $all: tagIDs } } }) as RecipeData[];
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.RATING_AND_NAME_AND_TAGS);
			}
		}
	}

	private async getByNameAndTags(name: string, tagNames: string[], ctx: Context<any, any>): Promise<RecipeData[]> {
		this.logger.debug(`Fetching recipe with Name: ${name} and tags: ${tagNames}`);
		try {
			const tagIDs = await this.convertTagsInIDs(tagNames, ctx);
			return  await ctx.call("v1.data-store.find", { query: { name: { $regex: name, $options: "i" }, tags: { $all: tagIDs } } }) as RecipeData[];
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.NAME_AND_TAGS);
			}
		}
	}

	private async getByRatingAndTags(rating: number, tagNames: string[], ctx: Context<any, any>): Promise<RecipeData[]> {
		this.logger.debug(`Fetching recipe with rating over: ${rating} and tags: ${tagNames}`);
		try {
			const [tagIDs, possibleIDs] = await Promise.all([this.convertTagsInIDs(tagNames, ctx), this.getPossibleIDsForRating(rating, ctx)]);
			return await ctx.call("v1.data-store.findOverID", { query: { _id: { $in: possibleIDs }, tags: { $all: tagIDs } } }) as RecipeData[];
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new FilterError(error.message || "Failed to fetch RecipeData from data-store", error.code || 500, FilterType.RATING_AND_TAGS);
			}
		}
	}

	private async getPossibleIDsForRating(rating: number, ctx: Context<any, any>): Promise<string[]> {
		try {
			this.logger.debug(`[Provider] Getting possible ids for rating > ${rating}`);
			return (await ctx.call("v1.rating.find", { query: { avgRating: { $gte: rating } } }) as RatingData[]).map(e => e.recipeID);
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to fetch recipe IDs by rating.", error.code || 500, "rating");
		}
	}

	private async convertTagsInIDs(tags: string[], ctx: Context<any, any>): Promise<string[]> {
		this.logger.debug("Converting tags to their matching ids.", tags);
		try {
			const ids = new Array<string>();
			for (const tag of tags) {
				ids.push((await ctx.call("v1.tags.getByString", { name: tag }) as Tag[])[0].id);
			}
			return ids;
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new FilterError(error.message || "Failed to convert tags to their ID", error.code || 500, FilterType.INTERNAL);
			}
		}
	}

	private async getRecipesByTag(tagID: string, ctx: Context<any, any>): Promise<RecipeData[]> {
		try {
			this.logger.debug(`Fetching recipes with tag: ${tagID}`);
			return await ctx.call("v1.data-store.find", { query: { tags: { $regex: tagID, $options: "i" } } }) as RecipeData[];
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
