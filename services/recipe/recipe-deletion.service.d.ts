import { Context, Service, ServiceBroker } from "moleculer";
import { RecipeDeletionParams, ServiceMeta } from "../../shared";
import { DeletionResponse } from "../../types";

declare class RecipeDeletionService extends Service {
	public constructor(broker: ServiceBroker);

	/**
	 * Checks if the requesting user owns the recipe. If the user owns it the deletion event for this recipe is fired.
	 *
	 * @method
	 * @param {String} recipeID
	 * @returns {DeletionResponse}
	 */
	public deleteRecipe(
		ctx: Context<RecipeDeletionParams, ServiceMeta>
	): Promise<DeletionResponse>;
}

export = RecipeDeletionService;
