import { ui104SettingsFixture } from "../../../src/settings/fixture"; import { SettingsWorkspace } from "../_components/ui104-settings-workspace";
export default function NotificationSettingsPage() { return <SettingsWorkspace section="notifications" initialData={ui104SettingsFixture} />; }
