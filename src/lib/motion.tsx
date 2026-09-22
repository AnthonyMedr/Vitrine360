/* eslint-disable react-refresh/only-export-components */
import { createElement, forwardRef, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";

const motionPropNames = new Set([
  "animate",
  "exit",
  "initial",
  "layout",
  "transition",
  "variants",
  "viewport",
  "whileFocus",
  "whileHover",
  "whileInView",
  "whileTap",
]);

type MotionLikeProps<T extends ElementType> = ComponentPropsWithoutRef<T> & Record<string, unknown>;

function createMotionComponent<T extends ElementType>(element: T) {
  return forwardRef<HTMLElement, MotionLikeProps<T>>(function MotionShim(props, ref) {
    const forwardedProps: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(props)) {
      if (motionPropNames.has(key)) continue;
      forwardedProps[key] = value;
    }

    return createElement(element, { ...forwardedProps, ref });
  });
}

const componentCache = new Map<string, ReturnType<typeof createMotionComponent>>();

export const motion = new Proxy({}, {
  get(_target, element: string) {
    if (!componentCache.has(element)) {
      componentCache.set(element, createMotionComponent(element as ElementType));
    }

    return componentCache.get(element);
  },
}) as Record<string, ReturnType<typeof createMotionComponent>>;

export function AnimatePresence({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
