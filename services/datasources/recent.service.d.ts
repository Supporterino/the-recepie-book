import { Context, Service, ServiceBroker, ServiceSchema } from "moleculer";
import { AddRecent, RecipeDeletion, ServiceMeta } from "../../shared";
import { Recipe } from "../../types";

declare class RecentService extends Service {
	public constructor(broker: ServiceBroker, schema: ServiceSchema<{}>);

	/**
	 * Get's the recents for the user.
	 *
	 * @method
	 * @returns {Array<Recipe>} - The recent recipes of the user
	 */
	public getRecents(ctx: Context<null, ServiceMeta>): Promise<Recipe[]>;

	/**
	 * Event to handle the add event of a recent element to a user
	 *
	 * @event
	 */
	public addRecent(ctx: Context<AddRecent>): Promise<void>;
	/**
	 * Handles a deletion event by deleting the recipe from the affected users recents.
	 *
	 * @event
	 */
	public "recipe.deletion"(ctx: Context<RecipeDeletion, ServiceMeta>): Promise<void>;
}

export = RecentService;
