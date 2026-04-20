type Props = {
  size?: number;
  className?: string;
};

export function QorixLogo({ size = 32, className = "" }: Props) {
  const src = `${import.meta.env.BASE_URL}qorix-logo.png`;
  return (
    <img
      src={src}
      alt="Qorix Markets"
      width={size}
      height={size}
      className={`object-contain select-none ${className}`}
      draggable={false}
    />
  );
}
