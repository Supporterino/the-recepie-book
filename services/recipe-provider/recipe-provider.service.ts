"use strict";

import { Service, ServiceBroker} from "moleculer";
import { Recipe } from "../../types/recipe";
import { Tag } from "../../types/tag";

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
				 * @returns {Recipe} - The recipe as JSON string
				 */
				getById: {
					rest: {
						path: "/getById",
						method: "POST",
					},
					params: {
						id: {type: "string", min: 2},
					},
					async handler(ctx): Promise<string> {
						return await this.getRecipeByID(ctx.params.id);
					},
				},
				/**
				 * Returns a list of recipes matching the provided string in their title
				 *
				 * @method
				 * @param {String} name - The string to search inside of the recipe titles
				 * @returns {Array<Recipe>} - A list of matching recipes as JSON string
				 */
				getByName: {
					rest: {
						path: "/getByName",
						method: "POST",
					},
					params: {
						name: {type: "string", min: 2},
					},
					async handler(ctx): Promise<string> {
						return await this.getRecipesByName(ctx.params.name);
					},
				},
				/**
				 * Return a list of recipes matching one or all tags depending on the `intersect` parameter
				 *
				 * @method
				 * @param {Array<string>} tags - A list of tag names to match against the database
				 * @param {Boolean} intersect - Indicator if all or just one tag needs to be matched
				 * @returns {Array<Recipe>} - A list of matching recipes as JSON string
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
					async handler(ctx): Promise<string> {
						return await this.getRecipesByTags(ctx.params.tags, ctx.params.intersect);
					},
				},
				/**
				 * Returns all recipes with a higher rating than the provided number
				 *
				 * @method
				 * @param {number} rating - The minium rating of the recipes
				 * @returns {Array<Recipe>} - A list of matching recipes as JSON string
				 */
				getByMinRating: {
					rest: {
						path: "/getByMinRating",
						method: "POST",
					},
					params: {
						rating: {type: "number"},
					},
					async handler(ctx): Promise<string> {
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
				 * @returns {Array<Recipe>} - A list of matching recipes as JSON string
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
					async handler(ctx): Promise<string> {
						return await this.filterRecipes(ctx.params.text, ctx.params.ratingMin, ctx.params.tags);
					},
				},
			},
		});
	}

	public async filterRecipes(name: string, rating: number, tags: string[]) {
		if (name !== "" && tags.length === 0) {return await this.getByNameAndRating(name, rating);}
		else if (name !== "" && tags.length > 0) {return await this.getByNameAndRatingAndTags(name, rating, tags);}
		else if (name === "" && tags.length === 0) {return await this.broker.call("v1.recipe-provider.getByMinRating", { rating });}
		else if (name === "" && tags.length > 0) {return await this.getByRatingAndTags(rating, tags);}
		else {return new Error("Invalid filter provided.");}
	}

	public async getRecipesByRating(rating: number) {
		this.logger.info(`Returning recipes with rating over ${rating}`);
		try {
			const recipes = await this.broker.call("v1.data-store.find", { query: { rating: { $gt: rating } } }) as Recipe[];
			if (recipes.length > 0) {return recipes;}
			else {return `No matchfing recipes found with rating > ${rating}`;}
		} catch (error) {
			return `Error during fetching: Error: ${error}.`;
		}
	}

	public async getRecipesByTags(tags: string[], intersect: boolean) {
		const tagIDs = await this.convertTagsInIDs(tags);
		this.logger.info(`Returning recipes for multiple tags (intersected=${intersect}): ${tags}`);
		let out = Array<Recipe>();
		for (const tag of tagIDs) {
			out = out.concat(await this.getRecipesByTag(tag));
		}
		if (intersect) {
			this.logger.debug("Intersecting all tags in array", out);
			out = this.intersectArray(out, tagIDs);
		}
		return out;
	}

	public async getRecipesByName(name: string) {
		this.logger.info(`Returning recipes with name which includes: ${name}`);
		try {
			const recipes = await this.broker.call("v1.data-store.find", { query: { name: { $regex: name } } }) as Recipe[];
			if (recipes.length > 0) {return recipes;}
			else {return `No matchfing recipes found with name (${name})`;}
		} catch (error) {
			return `Error during fetching: Error: ${error}.`;
		}
	}

	public async getRecipeByID(id: string) {
		this.logger.info(`Returning recipe with ID: ${id}`);
		try {
			return await this.broker.call("v1.data-store.get", { id }) as Recipe;
		} catch (error) {
			return `No Recipe with id (${id}) found.`;
		}
	}

	private async getByNameAndRating(name: string, rating: number) {
		try {
			const recipes = await this.broker.call("v1.data-store.find", { query: { rating: { $gt: rating }, name: { $regex: name } } }) as Recipe[];
			if (recipes.length > 0) {return recipes;}
			else {return "No matchfing recipes found";}
		} catch (error) {
			return `Error during fetching: Error: ${error}.`;
		}
	}

	private async getByNameAndRatingAndTags(name: string, rating: number, tagNames: string[]) {
		try {
			const tagIDs = await this.convertTagsInIDs(tagNames);
			const recipes = await this.broker.call("v1.data-store.find", { query: { rating: { $gt: rating }, name: { $regex: name }, tags: { $all: tagIDs } } }) as Recipe[];
			if (recipes.length > 0) {return recipes;}
			else {return "No matchfing recipes found";}
		} catch (error) {
			return `Error during fetching: Error: ${error}.`;
		}
	}

	private async getByRatingAndTags(rating: number, tagNames: string[]) {
		try {
			const tagIDs = await this.convertTagsInIDs(tagNames);
			const recipes = await this.broker.call("v1.data-store.find", { query: { rating: { $gt: rating }, tags: { $all: tagIDs } } }) as Recipe[];
			if (recipes.length > 0) {return recipes;}
			else {return "No matchfing recipes found";}
		} catch (error) {
			return `Error during fetching: Error: ${error}.`;
		}
	}

	private async convertTagsInIDs(tags: string[]): Promise<string[]> {
		this.logger.debug("Converting tags to their matching ids.", tags);
		const ids = new Array<string>();
		for (const tag of tags) {
			ids.push((await this.broker.call("v1.tags.getByString", { name: tag }) as Tag[])[0]._id);
		}
		return ids;
	}

	private async getRecipesByTag(tagID: string) {
		this.logger.debug(`Returning recipes with tag: ${tagID}`);
		return await this.broker.call("v1.data-store.find", { query: { tags: { $regex: tagID } } }) as Recipe[];
	}

	private intersectArray(recipes: Recipe[], tags: string[]): Recipe[] {
		const toReturn = new Array<Recipe>();
		recipes.forEach((recipe: Recipe) => {
			if (tags.every(tag => recipe.tags.includes(tag))) {toReturn.push(recipe);}
		});
		return toReturn;
	}
}
