import { IncomingMessage, ServerResponse } from "http";
import moleculer, {Service, ServiceBroker, Context } from "moleculer";
import ApiGateway, { Errors } from "moleculer-web";
import { Auth } from "../../types";

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
						"v1.recipe-deletion.*",
						"v1.user.*",
						"v1.auth.*",
						"api.*",
						"v1.rating.*",
						"v1.favorite.*",
						"v1.recent.getRecents",
						"v1.cooklist.*",
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
				},
				{
					path: "/photosUpload",
					bodyParsers: {
						json: false,
						urlencoded: false,
					},
					authorization: true,
					aliases: {
						"POST /": "multipart:v1.photo.save",
					},
					busboyConfig: {
						limits: {
							files: 1,
						},
					},
					callOptions: {
						timeout: 20000,
						retries: 3,
					},
					mappingPolicy: "restrict",
				},
				{
					path: "/photos",
					bodyParsers: {
						json: false,
						urlencoded: false,
					},
					aliases: {
						"GET /:name": "v1.photo.get",
					},
					busboyConfig: {
						limits: {
							files: 1,
						},
					},
					callOptions: {
						timeout: 20000,
						retries: 3,
					},
					mappingPolicy: "restrict",
				}],
				log4XXResponses: false,
				logRequestParams: null,
				logResponseData: null,
				assets: {
					folder: "public",
					// Options to `server-static` module
					options: {},
				},
				onError: (req: IncomingMessage, res: ServerResponse, err: moleculer.Errors.MoleculerError) => {
					res.setHeader("Content-type", "application/json; charset=utf-8");
					res.writeHead(err.code || 500);
					const outError = {
						name: err.name,
						message: err.message,
						code: err.code,
						type: err.type || "NO_TYPE",
						data: err.data || null,
					};
					res.end(JSON.stringify(outError, null, 2));
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
				authorize: (ctx: Context<any, any>, route: object, req: IncomingMessage): Promise<any> => {
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
						.then((authPayload: Auth) => {
							if (!authPayload)
								{return Promise.reject(new Errors.UnAuthorizedError(Errors.ERR_INVALID_TOKEN, ""));}

							ctx.meta.user = authPayload;
						});
				},
			},
		});
	}
}
