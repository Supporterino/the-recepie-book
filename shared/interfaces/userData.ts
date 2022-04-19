import { Role } from "../../types";

export interface UserData {
    id?: string;
    username: string;
    email: string;
    password: string;
	joinedAt: Date;
	avatar: string;
	role: Role;
}
