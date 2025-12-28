
import { User } from '../models/user.model';

export interface UserLoginRequest {
    username: string;
    password: string;
}

export interface AuthSession {
    user: User;
    token: string;
}
