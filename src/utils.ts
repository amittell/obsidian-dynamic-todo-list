/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @param immediate Whether to invoke the function immediately
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate = false
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return function(this: any, ...args: Parameters<T>): void {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        
        const callNow = immediate && !timeout;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) func.apply(this, args);
    };
}