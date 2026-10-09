"use client";
import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

// A textarea that grows with its content, so posts read like text, not like a scroll box.
export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + 2}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [props.value]);
  return <textarea ref={ref} rows={3} {...props} />;
}
