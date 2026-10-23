import {defineConfig} from "@playwright/test";
import config from "./playwright.frontend-g3.config";
export default defineConfig({...config,testMatch:["fep3-function.spec.ts","ui301.spec.ts","ui302.spec.ts","ui303.spec.ts","ui-p07.spec.ts"]});
