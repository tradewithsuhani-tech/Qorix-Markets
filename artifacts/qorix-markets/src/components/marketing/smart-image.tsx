import { ImgHTMLAttributes } from "react";

/**
 * Drop-in <img> replacement that defaults to lazy-loading and async
 * decoding. Use everywhere on the marketing site so above-the-fold images
 * can opt into eager loading explicitly while every other image stays
 * out of the critical path.
 */
export function SmartImage({
  alt,
  loading = "lazy",
  decoding = "async",
  ...rest
}: ImgHTMLAttributes<HTMLImageElement>) {
  return <img alt={alt ?? ""} loading={loading} decoding={decoding} {...rest} />;
}
