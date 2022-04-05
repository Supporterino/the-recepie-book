import { FilterType } from "../enums";
import { BaseError } from "./base-error";

export class FilterError extends BaseError {
	public constructor(message: string, code: number, public filterType: FilterType) {
		super(message, code);
	}
}
