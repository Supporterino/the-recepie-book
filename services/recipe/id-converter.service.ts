"use strict";

import { Service, ServiceBroker} from "moleculer";
import { RatingData, RecipeData } from "../../shared";
import { Units, Recipe, Tag, User } from "../../types";

export default class IDConverterService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "id-converter",
            version: 1,
			actions:{
				/**
				 * Converts a recipe from the internal data foramt with ids to the sendable object with all datas by resolving the ids.
				 *
				 * @method
				 * @param {RecipeData} recipe - The recipe to process
				 * @returns {Recipe}
				 */
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
					async handler(ctx): Promise<Recipe> {
						return await this.convertRecipe(ctx.params.recipe);
					},
				},
				/**
				 * Convert an array of recipes by converting one by one.
				 *
				 * @method
				 * @param {Array<RecipeData>} recipes
				 * @returns {Array<Recipe>}
				 */
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
					async handler(ctx): Promise<Recipe> {
						return await this.convertRecipes(ctx.params.recipes);
					},
				},
				/**
				 * Converts the tags of a recipe to their ids via the tags service
				 *
				 * @method
				 * @param {Array<string>} tagNames - The tag names to convert
				 * @param {Array<string>}
				 */
				convertTagsToID: {
					params: {
						tagNames: { type: "array", items: "string" },
					},
					async handler(ctx): Promise<string[]> {
						return await this.parseTagsToID(ctx.params.tagNames);
					},
				},
				/**
				 * Converts the tag ids of a recipe to their name via the tags service
				 *
				 * @method
				 * @param {Array<string>} tagIDs - The tag ids to convert
				 * @param {Array<string>}
				 */
				convertTagsToName: {
					params: {
 						tagIDs: { type: "array", items: "string" },
					},
					async handler(ctx): Promise<string[]> {
						return await this.parseTagsToName(ctx.params.tagIDs);
					},
				},
				/**
				 * Convert a rating id to the avg rating for this id
				 *
				 * @method
				 * @param {String} ratingID
				 * @returns {number}
				 */
				convertRatingIDtoRating: {
					params: {
						ratingID: "string",
					},
					async handler(ctx): Promise<number> {
						return await this.getRatingForRatingID(ctx.params.ratingID);
					},
				},
			},
		});
	}

	public async parseTagsToID(tagNames: string[]): Promise<string[]> {
		this.logger.info("[Converter] Parse tags to id.", tagNames);
		const output: string[] = [];
		for (const tagName of tagNames) {
			this.logger.debug(`Converting tag (${tagName}) to id`);
			output.push(await this.broker.call("v1.tags.checkForTag", {name: tagName}));
		}
		return output;
	}

	public async parseTagsToName(tagIDs: string[]): Promise<string[]> {
		this.logger.info("[Converter] Parse tag ids into name.", tagIDs);
		const output: string[] = [];
		for (const tagID of tagIDs) {
			this.logger.debug(`Getting tag (${tagID})`);
			output.push((await this.broker.call("v1.tags.get", { id: tagID }) as Tag).name);
		}
		return output;
	}

	public async getRatingForRatingID(ratingID: string): Promise<number> {
		this.logger.info(`[Converter] Getting avg rating for rating id: ${ratingID}`);
		if (ratingID === "") {return 0;}
		else {
			const ratingPayload = await this.broker.call("v1.rating.get", { id: ratingID }) as RatingData;
			return ratingPayload.avgRating;
		}
	}

	public async convertRecipes(recipes: RecipeData[]): Promise<Recipe[]> {
		const out = new Array<Recipe>();
        for (const recipe of recipes) {
            out.push(await this.broker.call("v1.id-converter.convertRecipe", {recipe}));
        }
        return out;
    }

    public async convertRecipe(recipe: RecipeData): Promise<Recipe> {
		this.logger.info(`[Converter] Converting recipe: ${recipe.id}`);
		const [ tags, user, rating ] = await Promise.all([this.getTagPromise(recipe.tags), this.getOwnerPromise(recipe.owner), this.getRatingPromise(recipe.rating as string)]);
		const out = {
			id: recipe.id,
			name: recipe.name,
			description: recipe.description,
			ingredients: recipe.ingredients,
			steps: recipe.steps,
			rating,
			tags,
			owner: user.username,
			creationTimestamp: recipe.creationTimestamp,
			updateTimestamp: recipe.updateTimestamp,
		} as Recipe;
        return out;
    }

	private getTagPromise(tagIDs: string[]): Promise<string[]> {
		return this.broker.call("v1.id-converter.convertTagsToName", { tagIDs });
	}

	private getOwnerPromise(userID: string): Promise<User> {
		return this.broker.call("v1.user.get", { id: userID });
	}

	private getRatingPromise(ratingID: string): Promise<number> {
		return this.broker.call("v1.id-converter.convertRatingIDtoRating", { ratingID });
	}
}
