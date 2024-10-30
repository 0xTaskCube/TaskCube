import React from "react";

interface LoadingProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "success" | "warning" | "error";
}

export const Loading: React.FC<LoadingProps> = ({ className = "", size = "md", color = "primary" }) => {
  return <span className={`loading loading-bars text-${color} loading-${size} ${className}`} />;
};
