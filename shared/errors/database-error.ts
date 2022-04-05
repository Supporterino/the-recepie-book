import { BaseError } from "./base-error";

export class DatabaseError extends BaseError {
	public constructor(message: string, code: number, public database: string) {
		super(message, code);
	}
}
