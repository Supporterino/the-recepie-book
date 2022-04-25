"use strict";

import { Context, Service, ServiceBroker} from "moleculer";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { AuthError, BaseError, RecipeData, ServiceMeta } from "../../shared";
import { UpdateResponse, Units, UpdateData } from "../../types";

export default class RecipeUpdaterService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "recipe-updater",
            version: 1,
			mixins: [ErrorMixin],
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
					handler: async (ctx: Context<UpdateData, ServiceMeta>): Promise<UpdateResponse> => await this.updateRecipe(ctx),
				},
			},
		});
	}

	public async updateRecipe(ctx: Context<UpdateData, ServiceMeta>): Promise<UpdateResponse> {
		const [ updatedRecipe, userID ] = [ ctx.params, ctx.meta.user.id ];
		if (!(await ctx.call("v1.user.ownsRecipe", { recipeID: updatedRecipe.id }, { meta: { user: { id: userID}}}) as boolean)) {throw new AuthError("User doesn't own this recipe.", 403);}

		const updateData: UpdateData = { ...updatedRecipe };

		try {
			if (updateData.tags) {updateData.tags = await ctx.call("v1.id-converter.convertTagsToID", { tagNames: updateData.tags });}
			(updateData as RecipeData).updateTimestamp = new Date();
			const recipe = await ctx.call("v1.data-store.update", (updateData as RecipeData)) as RecipeData;
			return {
				recipeID: `${recipe.id}`,
				msg: `Recipe (${recipe.name}) succesfully updated`,
			} as UpdateResponse;
		} catch (error) {
			if (error instanceof BaseError) {throw error;}
			else {
				throw new BaseError(error.message || "Failed to update a recipe.", error.code || 500);
			}
		}
	}
}
