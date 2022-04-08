export interface GetByIdParams {
	recipeID: string;
}

export interface GetByNameParams {
	name: string;
}

export interface GetByTagsParams {
	tags: string[];
	intersect: boolean;
}

export interface GetByMinRatingParams {
	rating: number;
}

export interface FilterParams {
	text: string;
	ratingMin: number;
	tags: string[];
}

export interface GetFromUserParams {
	userID: string;
}
