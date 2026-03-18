export interface UserNotification {
    id: number;
    time: string;
    subject: string;
    body: string;
    read: 0 | 1;
    user_id: number;
}