declare module "react-scrollama" {
  import type { ReactNode } from "react";

  interface ScrollamaProps {
    offset?: number;
    onStepEnter?: (args: { data: number; direction: "up" | "down" }) => void;
    onStepExit?: (args: { data: number; direction: "up" | "down" }) => void;
    children: ReactNode;
  }

  interface StepProps {
    data: number;
    children: ReactNode;
  }

  export function Scrollama(props: ScrollamaProps): JSX.Element;
  export function Step(props: StepProps): JSX.Element;
}
