import React from "react";
import { createRoot } from "react-dom/client";
import AUTClock from "./index";

const el = document.getElementById("root")!;
createRoot(el).render(<AUTClock />);
