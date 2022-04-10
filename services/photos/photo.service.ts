"use strict";

import { Transform } from "stream";
import { Context, Service, ServiceBroker} from "moleculer";
import {v4 as uuidv4} from "uuid";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { BASE_URL, GetImageUrlParams, GetPhotoParams, PhotoDeletionParams, PhotoUploadMeta, PREFIX } from "../../shared";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MongoClient = require("mongodb").MongoClient;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GridFSBucket = require("mongodb").GridFSBucket;

export default class PhotoService extends Service {
	private mongoClient = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
	private bucket: any;

	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "photo",
            version: 1,
            mixins: [ErrorMixin],
			actions: {
				get: {
					params: {
						name: "string",
					},
					handler: (ctx: Context<GetPhotoParams>) => this.getImage(ctx.params.name),
				},
				save: {
					handler: (ctx: Context<Transform, PhotoUploadMeta>) => this.saveImage(ctx),
				},
				getImageUrl: {
					params: {
						filename: "string",
					},
					handler: (ctx: Context<GetImageUrlParams>): string => `${BASE_URL}${PREFIX}${ctx.params.filename}`,
				},
			},
			events: {
				"photo.delete": {
					params: {
						fileName: "string",
					},
					handler: (ctx: Context<PhotoDeletionParams>) => {
						this.deleteImage(ctx.params.fileName);
					},
				},
			},
		});
		this.mongoClient.connect().then(() => {
			const db = this.mongoClient.db();
			this.bucket = new GridFSBucket(db, { bucketName: "photos" });
		});
	}

	public getImage(fileName: string) {
		return this.bucket.openDownloadStreamByName(fileName);
	}

	public deleteImage(name: string) {
		this.bucket.find({ filename: name }).toArray().then((data: any[]) => {
			// eslint-disable-next-line no-underscore-dangle
			this.bucket.delete(data[0]._id);
		});
	}

	public saveImage(ctx: Context<Transform, PhotoUploadMeta>) {
		return new this.Promise(async (resolve: (value: string) => void, reject: (reason?: any) => void) => {

			const fileName = `${uuidv4()}.${ctx.meta.filename.split(".").pop()}`;
			const upStream = this.bucket.openUploadStream(fileName);
			const target = ctx.meta.$multipart.target;

			upStream.on("finish", () => {
				if (target === "user") {ctx.emit("user.newAvatar", { userID: ctx.meta.$multipart.userID, imageName: fileName });}
				if (target === "recipe") {ctx.emit("recipe.newPicutre", { recipeID: ctx.meta.$multipart.recipeID, imageName: fileName });}
				resolve(fileName);
			});

			upStream.on("error", (err: Error) => {
				reject(err);
			});

			ctx.params.on("error", (err: Error) => {
				reject(err);
			});

			ctx.params.pipe(upStream);
		});
	}
}
