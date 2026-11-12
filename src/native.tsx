import { createRoot } from "react-dom/client";
import { RobotApp } from "./Prototype";
import "./native.css";
createRoot(document.getElementById("root")!).render(<RobotApp native />);
