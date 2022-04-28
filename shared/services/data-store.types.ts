export interface FirstRating {
	recipeID: string;
	ratingID: string;
}

export interface RecipeDeletion {
	recipeID: string;
}

export interface RecipePictureUpdate {
	recipeID: string;
	imageName: string;
}
