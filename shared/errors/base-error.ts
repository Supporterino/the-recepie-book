import { Errors } from "moleculer";

export class BaseError extends Errors.MoleculerError {
	public constructor(public message: string, public code: number) {
		super(message, code);
	}
}
