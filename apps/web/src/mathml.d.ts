import type { HTMLAttributes } from "react";

type MathMLElementAttributes = HTMLAttributes<HTMLElement> & Readonly<{
  display?: "block" | "inline";
  stretchy?: string;
  mathvariant?: string;
  width?: string;
}>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      math: MathMLElementAttributes;
      mrow: MathMLElementAttributes;
      mfrac: MathMLElementAttributes;
      mi: MathMLElementAttributes;
      mo: MathMLElementAttributes;
      mn: MathMLElementAttributes;
      msup: MathMLElementAttributes;
      msub: MathMLElementAttributes;
      mspace: MathMLElementAttributes;
      munder: MathMLElementAttributes;
      mover: MathMLElementAttributes;
      munderover: MathMLElementAttributes;
      msubsup: MathMLElementAttributes;
      msqrt: MathMLElementAttributes;
      mstyle: MathMLElementAttributes;
    }
  }
}
