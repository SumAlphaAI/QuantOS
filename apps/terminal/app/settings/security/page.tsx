import { ui104SettingsFixture } from "../../../src/settings/fixture"; import { SettingsWorkspace } from "../_components/ui104-settings-workspace";
export default function SecuritySettingsPage() { return <SettingsWorkspace section="security" initialData={ui104SettingsFixture} />; }
