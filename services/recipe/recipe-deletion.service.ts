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
				deleteRecipe: {
					rest: {
						path: "/deleteRecipe",
						method: "DELETE",
					},
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<RecipeDeletionParams, ServiceMeta>): Promise<DeletionResponse> => await this.deleteRecipe(ctx),
				},
			},
		});
	}

	public async deleteRecipe(ctx: Context<RecipeDeletionParams, ServiceMeta>): Promise<DeletionResponse> {
		const [ recipeID, userID ] = [ ctx.params.recipeID, ctx.meta.user.id ];
		if (!(await ctx.call("v1.user.ownsRecipe", { recipeID }, { meta: { user: { id: userID}}}) as boolean)) {throw new AuthError("User doesn't own this recipe.", 403);}
		this.logger.info(`[Deletion] Fireing event for deletion of recipe: ${recipeID}`);
		ctx.emit("recipe.deletion", { recipeID });
		return { recipeID, msg: "Asynchronous deletion triggered."} as DeletionResponse;
	}
}
