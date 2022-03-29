import {IncomingMessage} from "http";
import {Service, ServiceBroker, Context} from "moleculer";
import ApiGateway, { Errors } from "moleculer-web";
import { AuthPayload } from "../../types/authToken";

export default class ApiService extends Service {

	public constructor(broker: ServiceBroker) {
		super(broker);
		// @ts-ignore
		this.parseServiceSchema({
			name: "api",
			mixins: [ApiGateway],
			// More info about settings: https://moleculer.services/docs/0.14/moleculer-web.html
			settings: {
				port: process.env.PORT || 3000,

				cors: {
					origin: "*",
					methods: ["GET", "OPTIONS", "POST", "PUT", "DELETE", "PATCH"],
					allowedHeaders: "*",
					exposedHeaders: [],
					credentials: false,
					maxAge: 3600,
				},

				routes: [{
					path: "/secureApi",
					whitelist: [
						"v1.tags.*",
						"v1.recipe-updater.*",
						"v1.recipe-provider.*",
						"v1.recipe-creation.*",
						"v1.data-store.list",
						"v1.user.*",
						"v1.auth.*",
						"api.*",
						"v1.rating.*",
					],
					use: [],
					mergeParams: true,
					authentication: false,
					authorization: true,
					autoAliases: true,
					aliases:{},
					callingOptions: {},
					bodyParsers: {
						json: {
							strict: false,
							limit: "1MB",
						},
						urlencoded: {
							extended: true,
							limit: "1MB",
						},
					},
					mappingPolicy: "all", // Available values: "all", "restrict"
					logging: true,
				},{
					path: "/api",
					whitelist: [
						"v1.auth.*",
						"v1.recipe-provider.*",
						"v1.tags.getByString",
						"v1.tags.list",
						"v1.rating.get",
					],
					use: [],
					mergeParams: true,
					authentication: false,
					authorization: false,
					autoAliases: true,
					aliases:{},
					callingOptions: {},
					bodyParsers: {
						json: {
							strict: false,
							limit: "1MB",
						},
						urlencoded: {
							extended: true,
							limit: "1MB",
						},
					},
					mappingPolicy: "all", // Available values: "all", "restrict"
					logging: true,
				}],
				log4XXResponses: false,
				logRequestParams: null,
				logResponseData: null,
				assets: {
					folder: "public",
					// Options to `server-static` module
					options: {},
				},
			},

			methods: {
				/**
				 * Authorize the request. Check that the authenticated user has right to access the resource.
				 *
				 *
				 * @param {Context} ctx
				 * @param {Object} route
				 * @param {IncomingMessage} req
				 * @returns {Promise}
				 */
				authorize(ctx: Context<any, any>, route: object, req: IncomingMessage): Promise<any> {
					let token;
					if (req.headers.authorization) {
						const type = req.headers.authorization.split(" ")[0];
						if (type === "Token") {
							token = req.headers.authorization.split(" ")[1];
						}
					}
					if (!token) {
						return Promise.reject(new Errors.UnAuthorizedError(Errors.ERR_NO_TOKEN, ""));
					}
					// Verify JWT token
					return ctx.call("v1.auth.resolveToken", { token })
						.then((authPayload: AuthPayload) => {
							if (!authPayload)
								{return Promise.reject(new Errors.UnAuthorizedError(Errors.ERR_INVALID_TOKEN, ""));}

							ctx.meta.user = authPayload;
						});
				},
			},
		});
	}
}
