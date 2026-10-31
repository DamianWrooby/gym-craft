import { m } from '$lib/paraglide/messages.js';

// Written in the request's locale (ADR 0028): at signup that is the Accept-Language pick.
export function generateEmailTemplate(baseUrl: string, userId: string, token: string): string {
    return `<p>${m.email_verify_thanks()}</p>
			</br>
			<p>${m.email_verify_click()}</p>
			</br>
			<a style="" href="${baseUrl}/verify/${userId}/${token}">${m.email_verify_link()}</a>`;
}
