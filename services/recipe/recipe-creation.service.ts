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
					handler: async (ctx: Context<CreationData, ServiceMeta>): Promise<CreationResponse> => await this.createRecipe(ctx),
				},
			},
		});
	}

	public async createRecipe(ctx: Context<CreationData, ServiceMeta>): Promise<CreationResponse> {
		const [ rawRecipe, userID, now ] = [ ctx.params, ctx.meta.user.id, new Date() ];
		const recipeData = this.creationDataToRecipeData(rawRecipe, now, userID);

		try {
			recipeData.tags = await ctx.call("v1.id-converter.convertTagsToID", { tagNames: recipeData.tags });
			this.logger.info(`Creating recipe (${recipeData.name}) by ${recipeData.owner}`);
			const recipe = await ctx.call("v1.data-store.create", recipeData) as RecipeData;
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
