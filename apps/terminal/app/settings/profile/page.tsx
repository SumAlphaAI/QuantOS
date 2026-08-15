import { ui104SettingsFixture } from "../../../src/settings/fixture"; import { SettingsWorkspace } from "../_components/ui104-settings-workspace";
export default function ProfileSettingsPage() { return <SettingsWorkspace section="profile" initialData={ui104SettingsFixture} />; }
