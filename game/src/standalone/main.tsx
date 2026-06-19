import "../main.css";

import { createRoot } from "react-dom/client";
import { NeonGame } from "../game/NeonGame.js";

createRoot(document.getElementById("root")!).render(<NeonGame />);
