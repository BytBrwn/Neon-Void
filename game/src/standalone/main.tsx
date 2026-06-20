import "../main.css";

import { Capacitor } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import { NeonGame } from "../game/NeonGame.js";
import type { IPersistence } from "../game/persistence/IPersistence.js";
import { defaultPersistence } from "../game/persistence/LocalStoragePersistence.js";

async function loadPersistence(): Promise<IPersistence> {
  if (!Capacitor.isNativePlatform()) return defaultPersistence;

  const [{ CapacitorPersistence }, { StatusBar, Style }] = await Promise.all([
    import("../game/persistence/CapacitorPersistence.js"),
    import("@capacitor/status-bar"),
  ]);
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  void StatusBar.setBackgroundColor({ color: "#030014" }).catch(() => {});
  return CapacitorPersistence.create();
}

loadPersistence().then((store) => {
  createRoot(document.getElementById("root")!).render(<NeonGame store={store} />);
});
