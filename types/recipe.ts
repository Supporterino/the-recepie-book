import { Ingredient } from "./ingredient";

export class Recipe {
	constructor(public name: string, public description: string, public ingredients: Ingredient[], public steps: string[], public rating: number, public tags: string[], public owner: string) {}
}
