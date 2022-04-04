import { Ingredient } from "../../types";

export interface RecipeData {
	id?: string;
	name: string;
	description: string;
	ingredients: Ingredient[];
	steps: string[];
	tags: string[];
	rating?: string;
	owner: string;
	creationTimestamp: Date;
	updateTimestamp: Date;
}
