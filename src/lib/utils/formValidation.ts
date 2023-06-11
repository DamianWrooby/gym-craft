export function validatePasswordComplexity(password: string) {
    const hasLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasNonalphas = /\W/.test(password);
    return hasLength && hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas;
}
