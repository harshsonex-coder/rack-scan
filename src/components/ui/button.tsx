import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "icon";
};

// Small replacement for the shadcn Button. It sets no colours or sizes,
// so the classes you pass in always decide how the button looks.
export function Button({
    variant = "default",
    size = "default",
    className = "",
    ...props
}: ButtonProps) {
    const variantClass = variant === "outline" ? "border" : "";
    const sizeClass = size === "icon" ? "" : "";

    return (
        <button
            type="button"
            className={`inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${variantClass} ${sizeClass} ${className}`}
            {...props}
        />
    );
}
