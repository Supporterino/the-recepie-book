"use strict";

import {Service, ServiceBroker} from "moleculer";
import { CreationAndUpdateResponse } from "../../types/creation-and-update-response";
import { Ingredient } from "../../types/ingredient";
import { Recipe } from "../../types/recipe";
import { Units } from "../../types/units";

export default class RecipeCreationService extends Service {

	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "recipe-creation",
            version: 1,
			actions:{
				/**
				 * Validates the input and converts the tags to ids and sends a creation request to the `data-store` service
				 *
				 * @method
				 * @param {String} name - The name of the recipe
				 * @param {String} description - The description for the recipe
				 * @param {Array<string>} steps - The steps to make the recipe. Each step should be one element of the array
				 * @param {Array<Ingredient>} ingredients - A list of ingredients needed to make the recipe
				 * @param {Array<string} tags - A list of tag names to link to the recipe
				 * @param {String} owner - Name of the recipe owner
				 */
				createRecipe: {
					rest: {
						method: "POST",
						path: "/createRecipe",
					},
					params: {
						name: "string",
						description: {type: "string", optional: true},
						ingredients: {type: "array", items: {type: "object", strict: true, props: {name: "string", amount: "number", unit: { type: "enum", values: Object.values(Units) }}}},
						steps: {type: "array", items: "string"},
						rating: {type: "number", optional: true},
						tags: {type: "array", items: "string"},
						owner: "string",
					},
					async handler(ctx): Promise<CreationAndUpdateResponse> {
						return await this.createRecipe(ctx.params);
					},
				},
			},
		});
	}

	public async createRecipe(params: any): Promise<CreationAndUpdateResponse> {
		const now = new Date();
		params.tags = await this.parseTagsToID(params.tags);
		params.creationTimestamp = now;
		params.updateTimestamp = now;
		this.logger.info(`Creating recipe (${params.name}) by ${params.owner}`);
		const recipe = await this.broker.call("v1.data-store.create", params) as Recipe;
		return {
			recipeId: `${recipe.id}`,
			msg: `Saved recipe (${params.name}) by ${params.owner}`,
		} as CreationAndUpdateResponse;
	}

	private async parseTagsToID(tags: string[]): Promise<string[]> {
		const output: string[] = [];
		for (const tag of tags) {
			this.logger.debug(`Converting tag (${tag}) to id`);
			output.push(await this.broker.call("v1.tags.checkForTag", {name: tag}));
		}
		return output;
	}
}
