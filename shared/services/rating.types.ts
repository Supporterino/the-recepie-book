export interface AddRatingParams {
	recipeID: string;
	rating: number;
}

export interface UpdateRatingParams {
	recipeID: string;
	rating: number;
}

export interface RemoveRatingParams {
	recipeID: string;
}

export interface GetRatingForUserParams {
	recipeID: string;
}
