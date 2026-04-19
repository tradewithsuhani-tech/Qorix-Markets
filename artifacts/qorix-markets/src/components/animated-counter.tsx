import { useState, useEffect } from "react";
import { animate } from "framer-motion";

export function AnimatedCounter({ 
  value, 
  prefix = "", 
  suffix = "", 
  decimals = 2,
  className = ""
}: { 
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(displayValue, value, {
      duration: 1,
      ease: "easeOut",
      onUpdate: (v) => {
        setDisplayValue(v);
      },
    });
    return controls.stop;
  }, [value]);

  return (
    <span className={className}>
      {prefix}
      {displayValue.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
