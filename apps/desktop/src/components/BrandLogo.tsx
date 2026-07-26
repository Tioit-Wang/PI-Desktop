import brandLogoUrl from "../../build/icon_1024.png";

export function BrandLogo({ size = 16 }: { size?: number }) {
  return (
    <img
      className="brand-logo"
      src={brandLogoUrl}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
    />
  );
}
