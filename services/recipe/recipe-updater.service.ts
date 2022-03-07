"use strict";

import { Service, ServiceBroker} from "moleculer";
import { CreationAndUpdateResponse } from "../../types/creation-and-update-response";
import { Recipe } from "../../types/recipe";
import { Tag } from "../../types/tag";
import { Units } from "../../types/units";

export default class RecipeUpdaterService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "recipe-updater",
            version: 1,
			actions:{
				updateRecipe: {
					rest: {
						path: "/updateRecipe",
						method: "PATCH",
					},
					params: {
						id: "string",
						name: {type: "string", optional: true},
						description: {type: "string", optional: true},
						ingredients: {type: "array", items: {type: "object", strict: true, props: {name: "string", amount: "number", unit: { type: "enum", values: Object.values(Units) }}}, optional: true},
						steps: {type: "array", items: "string", optional: true},
						rating: {type: "number", optional: true},
						tags: {type: "array", items: "string", optional: true},
					},
					async handler(ctx): Promise<CreationAndUpdateResponse> {
						return await this.updateRecipe(ctx.params);
					},
				},
			},
		});
	}

	public async updateRecipe(updatedRecipe: any): Promise<CreationAndUpdateResponse> {
		if (updatedRecipe.tags) {updatedRecipe.tags = await this.broker.call("v1.id-converter.convertTagsToID", { tagNames: updatedRecipe.tags });}
		updatedRecipe.updateTimestamp = new Date();
		const recipe = await this.broker.call("v1.data-store.update", updatedRecipe) as Recipe;
		return {
			recipeId: `${recipe.id}`,
			msg: `Recipe (${recipe.name}) succesfully updated`,
		} as CreationAndUpdateResponse;
	}
}
