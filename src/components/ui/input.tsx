import { forwardRef, type InputHTMLAttributes } from "react";

// Small replacement for the shadcn Input.
export const Input = forwardRef<
    HTMLInputElement,
    InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", type = "text", ...props }, ref) {
    return (
        <input
            ref={ref}
            type={type}
            className={`flex w-full min-w-0 border bg-white px-3 py-1 text-base outline-none placeholder:text-slate-400 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
            {...props}
        />
    );
});
