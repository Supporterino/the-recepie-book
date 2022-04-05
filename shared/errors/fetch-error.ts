import { FetchTarget } from "../enums";
import { BaseError } from "./base-error";

export class FetchError extends BaseError {
	public constructor(message: string, code: number, target: FetchTarget) {
		super(message, code);
	}
}
