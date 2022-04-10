"use strict";

import {Context, Service, ServiceBroker} from "moleculer";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { BaseError, RecipeData, ServiceMeta } from "../../shared";
import { CreationData, CreationResponse, Units } from "../../types";

export default class RecipeCreationService extends Service {

	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "recipe-creation",
            version: 1,
			mixins: [ErrorMixin],
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
						description: {type: "string", default: "", optional: true},
						ingredients: {type: "array", items: {type: "object", strict: true, props: {name: "string", amount: "number", unit: { type: "enum", values: Object.values(Units) }}}},
						steps: {type: "array", items: "string"},
						tags: {type: "array", items: "string"},
					},
					handler: async (ctx: Context<CreationData, ServiceMeta>): Promise<CreationResponse> => await this.createRecipe(ctx.params, ctx.meta.user.id),
				},
			},
		});
	}

	public async createRecipe(params: CreationData, userID: string): Promise<CreationResponse> {
		const now = new Date();
		const recipeData = this.creationDataToRecipeData(params, now, userID);

		try {
			recipeData.tags = await this.broker.call("v1.id-converter.convertTagsToID", { tagNames: recipeData.tags });
			this.logger.info(`Creating recipe (${recipeData.name}) by ${recipeData.owner}`);
			const recipe = await this.broker.call("v1.data-store.create", recipeData) as RecipeData;
			return {
				recipeID: `${recipe.id}`,
				msg: `Saved recipe (${recipe.name}) by ${recipe.owner}`,
			} as CreationResponse;
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
		}
	}

	private creationDataToRecipeData(data: CreationData, date: Date, userID: string): RecipeData {
		return {
			name: data.name,
			description: data.description,
			ingredients: data.ingredients,
			steps: data.steps,
			tags: data.tags,
			creationTimestamp: date,
			updateTimestamp: date,
			owner: userID,
		} as RecipeData;
	}
}
