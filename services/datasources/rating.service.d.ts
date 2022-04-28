import { Context, Service, ServiceBroker, ServiceSchema } from "moleculer";
import {
	AddRating,
	GetRatingForUser,
	RecipeDeletion,
	RemoveRating,
	ServiceMeta, UpdateRating,
} from "../../shared";
import { RatingResponse } from "../../types";

declare class RatingService extends Service {
	public constructor(broker: ServiceBroker, schema: ServiceSchema<{}>);

	/**
	 * Event to handle the deletion of {@link RatingData} when a recipe is deleted.
	 *
	 * @event
	 */
	public "recipe.deletion"(ctx: Context<RecipeDeletion>): Promise<void>;

	/**
	 * Get the rating of a user from a specific recipe.
	 *
	 * @method
	 * @param {String} recipeID
	 * @returns {Number}
	 */
	public getRatingForUser(
		ctx: Context<GetRatingForUser, ServiceMeta>
	): Promise<number>;

	/**
	 * Remove a rating from a recipe.
	 *
	 * @method
	 * @param {String} recipeID - The recipe id to remove the rating from
	 * @returns {RatingResponse}
	 */
	public removeRating(
		ctx: Context<RemoveRating, ServiceMeta>
	): Promise<RatingResponse>;

	/**
	 * Add a new rating to a recipe.
	 *
	 * @method
	 * @param {String} recipeID - The recipe id to add a new rating
	 * @param {Number} rating - The value of the new rating
	 * @returns {RatingResponse}
	 */
	public addRating(
		ctx: Context<AddRating, ServiceMeta>
	): Promise<RatingResponse>;

	/**
	 * Update a rating of a recipe.
	 *
	 * @method
	 * @param {String} recipeID - The recipe id to modify the rating of
	 * @param {Number} rating - The updated rating value
	 * @returns {RatingResponse}
	 */
	public updateRating(
		ctx: Context<UpdateRating, ServiceMeta>
	): Promise<RatingResponse>;
}

export = RatingService;
