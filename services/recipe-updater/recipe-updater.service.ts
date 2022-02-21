"use strict";

import { Service, ServiceBroker} from "moleculer";
import { CreationAndUpdateResponse } from "../../types/creation-and-update-response";
import { Recipe } from "../../types/recipe";
import { Tag } from "../../types/tag";

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
						ingredients: {type: "array", items: {type: "object", strict: true, props: {name: "string", amount: "number", unit: "string"}}, optional: true},
						steps: {type: "array", items: "string", optional: true},
						rating: {type: "number", optional: true},
						tags: {type: "array", items: "string", optional: true},
						owner: {type: "string", optional: true},
					},
					async handler(ctx): Promise<string> {
						return await this.updateRecipe(ctx.params);
					},
				},
			},
		});
	}

	public async updateRecipe(updatedRecipe: any) {
		updatedRecipe.updateTimestamp = new Date();
		const recipe = await this.broker.call("v1.data-store.update", updatedRecipe) as Recipe;
		return {
			recipeId: `${recipe._id}`,
			msg: `Recipe (${recipe.name}) succesfully updated`,
		} as CreationAndUpdateResponse;
	}
}
