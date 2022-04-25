"use strict";

import { Context, Service, ServiceBroker} from "moleculer";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { BaseError, ConvertRatingIDtoRatingParams, ConvertRecipeParams, ConvertRecipesParams, ConvertTagsToIDParams, ConvertTagsToNameParams, DatabaseError, RatingData, RecipeData, ServiceMeta } from "../../shared";
import { Units, Recipe, Tag, User, RatingInfo } from "../../types";

export default class IDConverterService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "id-converter",
            version: 1,
			mixins: [ErrorMixin],
			actions:{
				convertRecipe: {
					params: {
						recipe: { type: "object", props: {
							id: "string",
							name: "string",
							description: {type: "string"},
							ingredients: {type: "array", items: {type: "object", strict: true, props: {name: "string", amount: "number", unit: { type: "enum", values: Object.values(Units) }}}},
							steps: {type: "array", items: "string"},
							rating: {type: "string"},
							tags: {type: "array", items: "string"},
							owner: "string",
							creationTimestamp: { type: "date", convert: true },
							updateTimestamp: { type: "date", convert: true },
						} },
					},
					handler: async (ctx: Context<ConvertRecipeParams, ServiceMeta>): Promise<Recipe> => await this.convertRecipe(ctx),
				},
				convertRecipes: {
					params: {
						recipes: { type: "array", items: {type: "object", props: {
							id: "string",
							name: "string",
							description: {type: "string"},
							ingredients: {type: "array", items: {type: "object", strict: true, props: {name: "string", amount: "number", unit: { type: "enum", values: Object.values(Units) }}}},
							steps: {type: "array", items: "string"},
							rating: {type: "string"},
							tags: {type: "array", items: "string"},
							owner: "string",
							creationTimestamp: { type: "date", convert: true },
							updateTimestamp: { type: "date", convert: true },
						}} },
					},
					handler: async (ctx: Context<ConvertRecipesParams, ServiceMeta>): Promise<Recipe[]> => await this.convertRecipes(ctx),
				},
				convertTagsToID: {
					params: {
						tagNames: { type: "array", items: "string" },
					},
					handler: async (ctx: Context<ConvertTagsToIDParams>): Promise<string[]> => await this.convertTagsToID(ctx),
				},
				convertTagsToName: {
					params: {
 						tagIDs: { type: "array", items: "string" },
					},
					handler: async (ctx: Context<ConvertTagsToNameParams>): Promise<string[]> => await this.convertTagsToName(ctx),
				},
				convertRatingIDtoRating: {
					params: {
						ratingID: "string",
					},
					handler: async (ctx: Context<ConvertRatingIDtoRatingParams>): Promise<RatingInfo> => await this.convertRatingIDtoRating(ctx),
				},
			},
		});
	}

	public async convertTagsToID(ctx: Context<ConvertTagsToIDParams>): Promise<string[]> {
		const tagNames = ctx.params.tagNames;
		this.logger.info("[Converter] Parse tags to id.", tagNames);
		try {
			const output: string[] = [];
			for (const tagName of tagNames) {
				this.logger.debug(`Converting tag (${tagName}) to id`);
				output.push(await ctx.call("v1.tags.checkForTag", {name: tagName}));
			}
			return output;
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new DatabaseError(error.message || "Failed to get ID for tag", error.code || 500, "tag");
			}
		}
	}

	public async convertTagsToName(ctx: Context<ConvertTagsToNameParams>): Promise<string[]> {
		const tagIDs = ctx.params.tagIDs;
		this.logger.info("[Converter] Parse tag ids into name.", tagIDs);
		try {
			const output: string[] = [];
			for (const tagID of tagIDs) {
				this.logger.debug(`Getting tag (${tagID})`);
				output.push((await ctx.call("v1.tags.get", { id: tagID }) as Tag).name);
			}
			return output;
		} catch (error) {
			throw new DatabaseError(error.message || "Couldn't load tag by ID.", error.code || 500, "tag");
		}
	}

	public async convertRatingIDtoRating(ctx: Context<ConvertRatingIDtoRatingParams>): Promise<RatingInfo> {
		const ratingID = ctx.params.ratingID;
		this.logger.info(`[Converter] Getting avg rating for rating id: ${ratingID}`);
 		if (ratingID === "") {return { avgRating: 0, numOfRatings: 0} as RatingInfo;}
		else {
			try {
				const ratingPayload = await ctx.call("v1.rating.get", { id: ratingID }) as RatingData;
				return { avgRating: ratingPayload.avgRating, numOfRatings: ratingPayload.ratings.length } as RatingInfo;
			} catch (error) {
				throw new DatabaseError(error.message || "Failed to load RatingData by ID.", error.code || 500, "rating");
			}
		}
	}

	public async convertRecipes(ctx: Context<ConvertRecipesParams, ServiceMeta>): Promise<Recipe[]> {
		const recipes = ctx.params.recipes;
		const promises = new Array<Promise<Recipe>>();
        for (const recipe of recipes) {
            promises.push(ctx.call("v1.id-converter.convertRecipe", { recipe }) as Promise<Recipe>);
        }
		return Promise.all(promises).then(recepies => recepies);
    }

    public async convertRecipe(ctx: Context<ConvertRecipeParams, ServiceMeta>): Promise<Recipe> {
		const [ recipe, userID ] = [ ctx.params.recipe, ctx.meta.user?.id ];
		this.logger.info(`[Converter] Converting recipe: ${recipe.id}`);
		try {
			if (userID) {ctx.emit("user.recentAdd", { userID, recipeID: recipe.id });}
			const [ tags, user, rating, isFavorite, myRating, isCookList, picture ] = await Promise.all([this.getTagPromise(recipe.tags, ctx), this.getOwnerPromise(recipe.owner, ctx), this.getRatingPromise(recipe.rating as string, ctx), this.getFavoritePromise(recipe.id, userID, ctx), this.getMyRatingPromise(recipe.id, userID, ctx), this.getCookListPromise(recipe.id, userID, ctx), this.getImageUrlPromise(recipe.picture, ctx)]);
			const out = {
				id: recipe.id,
				name: recipe.name,
				description: recipe.description,
				ingredients: recipe.ingredients,
				steps: recipe.steps,
				rating,
				tags,
				owner: user,
				picture,
				creationTimestamp: recipe.creationTimestamp,
				updateTimestamp: recipe.updateTimestamp,
				isFavorite,
				myRating,
				isCookList,
			} as Recipe;
			return out;
		} catch (error) {
			throw new BaseError(error.message || "Conversion of RecipeData failed.", error.code || 500);
		}
    }

	private getTagPromise(tagIDs: string[], ctx: Context<any, any>): Promise<string[]> {
		return ctx.call("v1.id-converter.convertTagsToName", { tagIDs });
	}

	private getOwnerPromise(userID: string, ctx: Context<any, any>): Promise<User> {
		return ctx.call("v1.user.getSanitizedUser", { userID });
	}

	private getRatingPromise(ratingID: string, ctx: Context<any, any>): Promise<RatingInfo> {
		return ctx.call("v1.id-converter.convertRatingIDtoRating", { ratingID });
	}

	private getFavoritePromise(recipeID: string, userID: string, ctx: Context<any, any>): Promise<boolean> {
		if (userID) {return ctx.call("v1.favorite.isFavorite", {recipeID }, { meta: { user: { id: userID }}});}
		else {return new Promise((resolve, reject) => {resolve(false);});}
	}

	private getCookListPromise(recipeID: string, userID: string, ctx: Context<any, any>): Promise<boolean> {
		if (userID) {return ctx.call("v1.cooklist.isOnCookList", {recipeID }, { meta: { user: { id: userID }}});}
		else {return new Promise((resolve, reject) => {resolve(false);});}
	}

	private getMyRatingPromise(recipeID: string, userID: string, ctx: Context<any, any>): Promise<number> {
		if (userID) {return ctx.call("v1.rating.getRatingForUser", {recipeID }, { meta: { user: { id: userID }}});}
		else {return new Promise((resolve, reject) => {resolve(0);});}
	}

	private getImageUrlPromise(imageName: string, ctx: Context<any, any>): Promise<string> {
		if (imageName === "NO_PIC") {return new Promise((resolve, reject) => {resolve("");});}
		return ctx.call("v1.photo.getImageUrl", { filename: imageName });
	}
}
