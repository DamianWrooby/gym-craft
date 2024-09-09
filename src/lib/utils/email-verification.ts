export function generateEmailTemplate(baseUrl: string, userId: string, token: string): string {
	return `<p>Thank you for registering for the GymCraft app.</p>
			</br>
			<p>Click the link below to activate your account:</p>
			</br>
			<a style="" href="${baseUrl}/verify/${userId}/${token}">Activate your account</a>`;
}