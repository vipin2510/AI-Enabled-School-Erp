"use client";

import { createContext, useContext, useState } from "react";

// Shared open/closed state for the mobile sidebar drawer. The hamburger lives
// in the Topbar and the drawer is the Sidebar — both client components nested
// under this provider in the layout, so they share one piece of state.
type ShellNav = { open: boolean; setOpen: (v: boolean) => void };

const ShellNavCtx = createContext<ShellNav>({ open: false, setOpen: () => {} });

export function ShellNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <ShellNavCtx.Provider value={{ open, setOpen }}>{children}</ShellNavCtx.Provider>;
}

export const useShellNav = () => useContext(ShellNavCtx);
