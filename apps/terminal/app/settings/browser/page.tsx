import { ui104SettingsFixture } from "../../../src/settings/fixture"; import { SettingsWorkspace } from "../_components/ui104-settings-workspace";
export default function BrowserSettingsPage() { return <SettingsWorkspace section="browser" initialData={ui104SettingsFixture} />; }
