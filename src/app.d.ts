import { User } from './models/user.model';

declare global {
    declare namespace App {
        interface Locals {
            user: User;
        }

        interface Platform {}

        interface Session {}

        interface Stuff {}

        interface PageData {}
    }
}
