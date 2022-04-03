"use strict";

import { Errors, Service, ServiceBroker} from "moleculer";
import { UpdateData } from "../../shared/interfaces/updateData";
import { UpdateResponse, Recipe, Units, Ingredient } from "../../types";

export default class RecipeUpdaterService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "recipe-updater",
            version: 1,
			actions:{
				/**
				 * Update fields of a recipe
				 *
				 * @method
				 * @param {Number} id
				 * @param {String} description - optional
				 * @param {Array<Ingredient>} ingredients - optionak
				 * @param {Array<String>} steps - optional
				 * @param {Array<String>} tags - optional
				 * @returns {UpdateResponse | Errors.MoleculerError}
				 */
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
					async handler(ctx): Promise<UpdateResponse | Errors.MoleculerError> {
						return await this.updateRecipe(ctx.params, ctx.meta.user.id);
					},
				},
			},
		});
	}

	public async updateRecipe(updatedRecipe: any, userID: string): Promise<UpdateResponse | Errors.MoleculerError> {
		if (!(await this.broker.call("v1.user.ownsRecipe", { userID, recipeID: updatedRecipe.id }) as boolean)) {return new Errors.MoleculerError("User doesn't own this recipe.", 403);}

		const updateData: UpdateData = { ...updatedRecipe };

		if (updateData.tags) {updateData.tags = await this.broker.call("v1.id-converter.convertTagsToID", { tagNames: updateData.tags });}
		(updateData as Recipe).updateTimestamp = new Date();
		const recipe = await this.broker.call("v1.data-store.update", (updateData as Recipe)) as Recipe;
		return {
			recipeID: `${recipe.id}`,
			msg: `Recipe (${recipe.name}) succesfully updated`,
		} as UpdateResponse;
	}
}
