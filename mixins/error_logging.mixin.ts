import { ServiceSchema, Service, Context } from "moleculer";

export const ErrorMixin: Partial<ServiceSchema>&ThisType<Service> = {
	hooks: {
		error: {
			"*"(ctx: Context<any, any>, err: Error): void {
				this.logger.error(`Error occured in ${ctx.action.name}`, err);
				throw err;
			},
		},
	},
};
