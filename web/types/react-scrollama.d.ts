declare module "react-scrollama" {
  import type { ReactNode } from "react";

  interface StepResponse<T = unknown> {
    element: HTMLElement;
    data: T;
    direction: "up" | "down";
    entry: IntersectionObserverEntry;
  }

  interface ScrollamaProps<T = unknown> {
    onStepEnter?: (response: StepResponse<T>) => void;
    onStepExit?: (response: StepResponse<T>) => void;
    onStepProgress?: (
      response: StepResponse<T> & { progress: number },
    ) => void;
    debug?: boolean;
    offset?: number;
    threshold?: number;
    children: ReactNode;
  }

  interface StepProps<T = unknown> {
    data?: T;
    children: ReactNode;
  }

  export function Scrollama<T = unknown>(
    props: ScrollamaProps<T>,
  ): JSX.Element;
  export function Step<T = unknown>(props: StepProps<T>): JSX.Element;
}
