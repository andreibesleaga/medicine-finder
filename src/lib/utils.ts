import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** The URL when it is a web address (http or https), otherwise undefined: record links come from other sites. */
export function webUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return ["https:", "http:"].includes(new URL(url).protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}
