import { Button, Icon, Sheet } from "../../../ui";
import s from "./Settings.module.css";

/** iPhone Safari has no install prompt: Share → Add to Home Screen. */
export function InstallInstructionsSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Install 4TURA Home">
      <ol className={s.steps}>
        <li><span className={s.stepIcon}><Icon name="share" size={22} /></span> Tap <strong>Share</strong> in Safari's toolbar.</li>
        <li><span className={s.stepIcon}><Icon name="plusCircle" size={22} /></span> Choose <strong>Add to Home Screen</strong>.</li>
        <li><span className={s.stepIcon}><Icon name="check" size={22} /></span> Tap <strong>Add</strong>, then open 4TURA Home from your home screen.</li>
      </ol>
      <div className={s.stepsFoot}>
        <Button variant="filled" size="large" block onClick={onClose}>Done</Button>
      </div>
    </Sheet>
  );
}
