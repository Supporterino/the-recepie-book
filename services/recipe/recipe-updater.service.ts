"use strict";

import { Service, ServiceBroker} from "moleculer";
import { Errors } from "moleculer-web";
import { CreationAndUpdateResponse } from "../../types/creation-and-update-response";
import { Ingredient } from "../../types/ingredient";
import { Recipe } from "../../types/recipe";
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
						tags: {type: "array", items: "string", optional: true},
					},
					async handler(ctx): Promise<CreationAndUpdateResponse | Error> {
						return await this.updateRecipe(ctx.params, ctx.meta.user.id);
					},
				},
			},
		});
	}

	public async updateRecipe(updatedRecipe: any, userID: string): Promise<CreationAndUpdateResponse | Error> {
		if (userID !== (await this.broker.call("v1.data-store.get", { id: updatedRecipe.id }) as Recipe).owner) {return new Errors.UnAuthorizedError(Errors.ERR_INVALID_TOKEN, "Not the owner of the recipe");}

		const updateData: UpdateData = { ...updatedRecipe };

		if (updateData.tags) {updateData.tags = await this.broker.call("v1.id-converter.convertTagsToID", { tagNames: updateData.tags });}
		(updateData as Recipe).updateTimestamp = new Date();
		const recipe = await this.broker.call("v1.data-store.update", (updateData as Recipe)) as Recipe;
		return {
			recipeId: `${recipe.id}`,
			msg: `Recipe (${recipe.name}) succesfully updated`,
		} as CreationAndUpdateResponse;
	}
}

interface UpdateData {
	id: string;
	name?: string;
	description?: string;
	ingredients?: Ingredient[];
	steps?: string[];
	tags?: string[];
}
