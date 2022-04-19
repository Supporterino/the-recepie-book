import { BaseError } from "./base-error";

export class TokenError extends BaseError {
	public constructor(message: string, code: number, method: string) {
		super(message, code);
	}
}
