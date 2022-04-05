import { BaseError } from "./base-error";

export class AuthError extends BaseError {
	public constructor(message: string, code: number) {
		super(message, code);
	}
}
