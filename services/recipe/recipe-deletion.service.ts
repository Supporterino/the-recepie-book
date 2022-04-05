"use strict";

import { Context, Service, ServiceBroker} from "moleculer";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { AuthError, RecipeDeletionParams, ServiceMeta } from "../../shared";
import { DeletionResponse } from "../../types";

export default class RecipeDeletionService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "recipe-deletion",
            version: 1,
			mixins: [ErrorMixin],
			actions:{
				/**
				 * Checks if the requesting user owns the recipe. If the user owns it the deletion event for this recipe is fired.
				 *
				 * @method
				 * @param {String} recipeID
				 * @returns {DeletionResponse}
				 */
				deleteRecipe: {
					rest: {
						path: "/deleteRecipe",
						method: "DELETE",
					},
					params: {
						recipeID: "string",
					},
					async handler(ctx: Context<RecipeDeletionParams, ServiceMeta>): Promise<DeletionResponse> {
						return await this.delete(ctx.params.recipeID, ctx.meta.user.id);
					},
				},
			},
		});
	}

	public async delete(recipeID: string, userID: string): Promise<DeletionResponse> {
		if (!(await this.broker.call("v1.user.ownsRecipe", { userID, recipeID }) as boolean)) {throw new AuthError("User doesn't own this recipe.", 403);}
		this.logger.info(`[Deletion] Fireing event for deletion of recipe: ${recipeID}`);
		this.broker.emit("recipe.deletion", { recipeID });
		return { recipeID, msg: "Asynchronous deletion triggered."} as DeletionResponse;
	}
}
