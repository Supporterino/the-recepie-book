import { Ingredients } from "../../types";

export interface RecipeData {
	id?: string;
	name: string;
	description: string;
	ingredients: Ingredients;
	steps: string[];
	tags: string[];
	rating?: string;
	owner: string;
	picture: string;
	creationTimestamp: Date;
	updateTimestamp: Date;
}
