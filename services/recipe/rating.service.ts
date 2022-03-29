"use strict";

import {Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { RatingOperations, RatingResponse } from "../../types/rating-response";
import { User } from "../../types/user";

export default class RatingService extends Service {
    private DBConnection = new Connection("ratings").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "rating",
            version: 1,
            mixins: [this.DBConnection],
			settings: {
				idField: "id",
				pageSize: 2147483647,
				maxPageSize: 2147483647,
				fields: [
					"id",
					"recipeID",
					"ratings",
					"avgRating",
				],
				entityValidator: {
					recipeID: "string",
					ratings: { type: "array", items: { type: "object", strict: true, props: { userID: "string", rating: "number" }}},
					avgRating: { type: "number", nullable: true },
				},
			},
			actions: {
				addRating: {
					rest: {
						path: "/addRating",
						method: "POST",
					},
					params: {
						recipeID: "string",
						rating: "number",
					},
					async handler(ctx): Promise<RatingResponse> {
						return await this.addRating(ctx.meta.user.id, ctx.params.recipeID, ctx.params.rating);
					},
				},
				updateRating: {
					rest: {
						path: "/updateRating",
						method: "PATCH",
					},
					params: {
						recipeID: "string",
						rating: "number",
					},
					async handler(ctx): Promise<RatingResponse> {
						return await this.updateRating(ctx.meta.user.id, ctx.params.recipeID, ctx.params.rating);
					},
				},
				removeRating: {
					rest: {
						path: "/removeRating",
						method: "DELETE",
					},
					params: {
						recipeID: "string",
					},
					async handler(ctx): Promise<RatingResponse> {
						return await this.removeRating(ctx.meta.user.id, ctx.params.recipeID);
					},
				},
			},
		}, schema));
	}

	public async removeRating(userID: string, recipeID: string): Promise<RatingResponse> {
		const recipeRating = await this.getByRecipeID(recipeID);
		if (!recipeRating) {return { success: false, method: RatingOperations.REMOVE, recipeID, userID, msg: "The recipe has no ratings yet" } as RatingResponse;}

		const index = this.getIndexOfUserRating(recipeRating, userID);
		if (index === -1) {return { success: false, method: RatingOperations.REMOVE, recipeID, userID, msg: `The user(${userID}) hasn't rated recipe so updating is not possible` } as RatingResponse;}

		recipeRating.ratings.splice(index, 1);
		const newRecipeRating = this.calculateAvgRating(recipeRating);
		await this.broker.call("v1.rating.update", newRecipeRating);
		return { success: true, method: RatingOperations.REMOVE, recipeID, userID, msg: "Removed users rating from recipe" } as RatingResponse;
	}

	public async addRating(userID: string, recipeID: string, rating: number): Promise<RatingResponse> {
		let recipeRating: RatingPayload = null;
		const existingRating = await this.getByRecipeID(recipeID);
		if (existingRating) {recipeRating = existingRating;}
		else {
			this.logger.info("No rating for recipe present, creting new one.", recipeID);
			recipeRating = await this.createNewRatingPayload(recipeID);
		}

		const index = this.getIndexOfUserRating(recipeRating, userID);
		if (index !== -1) {
			if (recipeRating.ratings[index].rating === rating) {return { success: false, method: RatingOperations.UPDATE, recipeID, userID, msg: "This rating is already present" } as RatingResponse;}

			this.logger.warn("Rating add was called but user already rated. Triggering update", recipeID, userID, rating);
			const newRecipeRating = this.replaceRatingAndRecalculate(recipeRating, index, rating);
			await this.broker.call("v1.rating.update", newRecipeRating);
			return { success: true, method: RatingOperations.UPDATE, recipeID, userID, msg: "User already rated recipe. Updated instead" } as RatingResponse;
		}

		const newRecipeRating = this.addRatingAndRecalculate(recipeRating, userID, rating);
		await this.broker.call("v1.rating.update", newRecipeRating);
		return { success: true, method: RatingOperations.UPDATE, recipeID, userID, msg: "User rated recipe" } as RatingResponse;
	}

	public async updateRating(userID: string, recipeID: string, rating: number): Promise<RatingResponse> {
		const recipeRating = await this.getByRecipeID(recipeID);
		if (!recipeRating) {return { success: false, method: RatingOperations.UPDATE, recipeID, userID, msg: "The recipe has no ratings yet" } as RatingResponse;}

		const index = this.getIndexOfUserRating(recipeRating, userID);
		if (index === -1) {return { success: false, method: RatingOperations.UPDATE, recipeID, userID, msg: `The user(${userID}) hasn't rated recipe so updating is not possible` } as RatingResponse;}

		const newRecipeRating = this.replaceRatingAndRecalculate(recipeRating, index, rating);
		await this.broker.call("v1.rating.update", newRecipeRating);
		return { success: true, method: RatingOperations.UPDATE, recipeID, userID, msg: `Updated recipe new avgRating of: ${newRecipeRating.avgRating}`} as RatingResponse;
	}

	private async createNewRatingPayload(recipeID: string): Promise<RatingPayload> {
		const newRatingPayload = await this.broker.call("v1.rating.create", { recipeID, ratings: new Array<RatingEntry>(), avgRating: null }) as RatingPayload;
		return newRatingPayload;
	}

	private replaceRatingAndRecalculate(ratingPayload: RatingPayload, index: number, rating: number): RatingPayload {
		ratingPayload.ratings[index].rating = rating;
		return this.calculateAvgRating(ratingPayload);
	}

	private getIndexOfUserRating(ratingPayload: RatingPayload, userID: string) {
		return ratingPayload.ratings.findIndex((e: RatingEntry) => e.userID === userID);
	}

	private addRatingAndRecalculate(ratingPayload: RatingPayload, userID: string, rating: number): RatingPayload {
		ratingPayload.ratings.push({ userID, rating } as RatingEntry);
		return this.calculateAvgRating(ratingPayload);
	}

	private calculateAvgRating(ratingPayload: RatingPayload): RatingPayload {
		const avgRating = ratingPayload.ratings.reduce((prev, current) => prev + current.rating, 0) / ratingPayload.ratings.length;
		ratingPayload.avgRating = avgRating;
		return ratingPayload;
	}

	private async getByRecipeID(recipeID: string): Promise<RatingPayload | undefined> {
		const possibleRating = (await this.broker.call("v1.rating.find", { query: { recipeID }}) as RatingPayload[])[0];
		if (possibleRating) {return possibleRating;}
		else {return undefined;}
	}
}

export interface RatingPayload {
	id: string;
	recipeID: string;
	ratings: RatingEntry[];
	avgRating: number;
}

export interface RatingEntry {
	userID: string;
	rating: number;
}
