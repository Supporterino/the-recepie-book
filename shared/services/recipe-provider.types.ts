export interface GetById {
	recipeID: string;
}

export interface GetByName {
	name: string;
}

export interface GetByTags {
	tags: string[];
	intersect: boolean;
}

export interface GetByMinRating {
	rating: number;
}

export interface Filter {
	text: string;
	ratingMin: number;
	tags: string[];
}

export interface GetFromUser {
	userID: string;
}
