import { createContext, useContext } from "react";

/**
 * Which layout the tree renders in. "phone" is the PWA (430 px column,
 * bottom sheets, swipe rows); "desk" is One-Page, where the same components
 * present as centred dialogs, alert-style choices and hover row actions.
 */
export type Layout = "phone" | "desk";

export const LayoutContext = createContext<Layout>("phone");

export const useIsDesk = () => useContext(LayoutContext) === "desk";
