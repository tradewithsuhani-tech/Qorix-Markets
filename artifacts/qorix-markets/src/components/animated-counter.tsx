import { useState, useEffect, useRef } from "react";
import { motion, useSpring } from "framer-motion";

function useAnimatedNumber(value: number) {
  const spring = useSpring(value, { 
    stiffness: 55, 
    damping: 18, 
    mass: 0.8
  });
  useEffect(() => { spring.set(value); }, [spring, value]);
  return spring;
}

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
  const springValue = useAnimatedNumber(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const unsub = springValue.on("change", (latest) => setDisplay(latest));
    return unsub;
  }, [springValue]);

  return (
    <span className={`number-scroll inline-block font-variant-numeric tabular-nums ${className}`}>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

export function BigBalanceCounter({
  value,
  prefix = "$",
  className = ""
}: {
  value: number;
  prefix?: string;
  className?: string;
}) {
  const springValue = useAnimatedNumber(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const unsub = springValue.on("change", (latest) => setDisplay(latest));
    return unsub;
  }, [springValue]);

  const formatted = display.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [intPart, decPart] = formatted.split(".");

  return (
    <span className={`number-scroll inline-flex items-end gap-0.5 ${className}`}>
      <span className="text-muted-foreground text-lg font-medium mb-0.5">{prefix}</span>
      <span className="font-bold tracking-tight">{intPart}</span>
      <span className="text-muted-foreground text-xl font-medium mb-0.5">.{decPart}</span>
    </span>
  );
}
