export interface AddRating {
	recipeID: string;
	rating: number;
}

export interface UpdateRating {
	recipeID: string;
	rating: number;
}

export interface RemoveRating {
	recipeID: string;
}

export interface GetRatingForUser {
	recipeID: string;
}
