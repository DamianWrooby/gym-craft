import { emailRegex } from '@/constants/app.constants';

export function validateRegisterFormData({
    username,
    email,
    password,
    confirmPassword,
}: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
}) {
    if (!username || typeof username !== 'string') return { invalidUsername: true };
    if (!email || typeof email !== 'string') return { invalidEmail: true };
    if (!password || typeof password !== 'string') return { invalidPassword: true };
    if (!confirmPassword || typeof confirmPassword !== 'string') return { invalidConfirmPassword: true };

    if (!isValidEmailFormat(email)) return { emailInvalid: true };
    if (password !== confirmPassword) return { passwordsExact: true };
    if (!validatePasswordComplexity(password)) return { passwordComplexity: true };

    return null;
}

export function validatePasswordComplexity(password: string) {
    const hasLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasNonalphas = /\W/.test(password);
    return hasLength && hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas;
}

export function isString(value: FormDataEntryValue | null) {
    return typeof value === 'string';
}

function isValidEmailFormat(email: string) {
    return emailRegex.test(email);
}
