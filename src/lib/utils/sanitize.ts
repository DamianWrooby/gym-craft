export function sanitizeObject<T extends object, K extends keyof T>(obj: T, filter: K[] | { [P in K]: unknown }): Pick<T, K> {
    // Get allowed properties based on input type
    const allowedProps = Array.isArray(filter) ? filter : (Object.keys(filter) as K[]);

    // Create a new object with only allowed properties
    const sanitized = {} as Pick<T, K>;

    for (const prop of allowedProps) {
        if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            sanitized[prop] = obj[prop];
        }
    }

    return sanitized;
}
