"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: "default" | "primary" | "danger"; loading?: boolean; children: ReactNode }
export function Button({ variant = "default", loading = false, disabled, children, className, ...props }: ButtonProps) { return <button {...props} className={`q-button q-button--${variant}${className ? ` ${className}` : ""}`} disabled={disabled || loading} aria-busy={loading || undefined}>{loading ? <><span aria-hidden="true">↻</span> {children}</> : children}</button>; }
