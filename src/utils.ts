/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @param immediate Whether to invoke the function immediately on the leading edge of the timeout
 * @returns A debounced version of the input function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number,
    immediate = false
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null; // Store the timeout ID

    return function(this: ThisParameterType<T>, ...args: Parameters<T>): void {
        // Function to execute after the debounce delay
        const later = () => {
            timeout = null; // Clear the timeout
            if (!immediate) func.apply(this, args); // Execute the function if not immediate
        };

        const callNow = immediate && !timeout; // Determine if the function should be called immediately
        if (timeout) clearTimeout(timeout); // Clear any existing timeout
        timeout = setTimeout(later, wait); // Set a new timeout

        if (callNow) func.apply(this, args); // Execute immediately if requested
    };
}