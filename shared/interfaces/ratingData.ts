import { RatingEntry } from "./ratingEntry";

export interface RatingData {
	id: string;
	recipeID: string;
	ratings: RatingEntry[];
	avgRating: number;
}
