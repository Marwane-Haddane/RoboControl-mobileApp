import { mergeConfig } from "vite";
import base from "./vite.config";

// Native build outputs can be locked by Android packaging tools on Windows.
// Leave the template configuration intact and exclude only generated artifacts.
export default mergeConfig(base, {
  server: {
    watch: { ignored: ["**/android/**", "**/releases/**", "**/dist/**", "**/test-results/**", "**/docs/screenshots/**"] },
  },
});
