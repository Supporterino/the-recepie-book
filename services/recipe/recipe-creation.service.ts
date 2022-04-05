"use strict";

import {Service, ServiceBroker} from "moleculer";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { BaseError, RecipeData } from "../../shared";
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
					async handler(ctx): Promise<CreationResponse> {
						return await this.createRecipe(ctx.params, ctx.meta.user.id);
					},
				},
			},
		});
	}

	public async createRecipe(params: any, userID: string): Promise<CreationResponse> {
		const now = new Date();
		const creationData: CreationData = { ...params };

		try {
			creationData.tags = await this.broker.call("v1.id-converter.convertTagsToID", { tagNames: params.tags });
			(creationData as RecipeData).creationTimestamp = now;
			(creationData as RecipeData).updateTimestamp = now;
			(creationData as RecipeData).owner = userID;
			this.logger.info(`Creating recipe (${params.name}) by ${params.owner}`);
			const recipe = await this.broker.call("v1.data-store.create", (creationData as RecipeData)) as RecipeData;
			return {
				recipeID: `${recipe.id}`,
				msg: `Saved recipe (${params.name}) by ${params.owner}`,
			} as CreationResponse;
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
		}
	}
}
