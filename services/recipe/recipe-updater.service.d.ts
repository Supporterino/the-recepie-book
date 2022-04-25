import { Context, Service, ServiceBroker } from "moleculer";
import { UpdateResponse, UpdateData } from "../../types";
import { ServiceMeta } from "../../shared";

declare class RecipeUpdaterService extends Service {
	public constructor(broker: ServiceBroker);

	/**
	 * Update fields of a recipe
	 *
	 * @method
	 * @param {Number} id
	 * @param {String} description - optional
	 * @param {Array<Ingredient>} ingredients - optionak
	 * @param {Array<String>} steps - optional
	 * @param {Array<String>} tags - optional
	 * @returns {UpdateResponse}
	 */
	public updateRecipe(
		ctx: Context<UpdateData, ServiceMeta>
	): Promise<UpdateResponse>;
}

export = RecipeUpdaterService;
