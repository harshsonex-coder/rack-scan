import type { ReactNode } from "react";

// Simple page heading wrapper (replaces the heading component of your website).
export default function Heading({ children }: { children: ReactNode }) {
    return <div className="w-full">{children}</div>;
}
