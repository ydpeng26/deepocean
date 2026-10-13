import { useState } from "react";
import { Flag, MoreHorizontal, Pencil, Trash2, UserX, X } from "lucide-react";

type Labels = {
  more: string;
  report: string;
  block: string;
  edit: string;
  delete: string;
  confirmDelete: string;
  confirm: string;
  cancel: string;
};

type ForumPostMenuProps = {
  isOwn: boolean;
  labels: Labels;
  onReport?: () => void;
  onBlock?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function ForumPostMenu({ isOwn, labels, onReport, onBlock, onEdit, onDelete }: ForumPostMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function run(action?: () => void) {
    action?.();
    setOpen(false);
    setConfirmingDelete(false);
  }

  return <div className="do-forum-more-menu">
    <button type="button" className="do-forum-more-trigger" aria-label={labels.more} aria-expanded={open} onClick={() => { setOpen((value) => !value); setConfirmingDelete(false); }}><MoreHorizontal /></button>
    {open && <div className="do-forum-more-popover" role="menu">
      <div className="do-forum-more-popover-head"><span>{labels.more}</span><button type="button" aria-label={labels.cancel} onClick={() => setOpen(false)}><X /></button></div>
      {isOwn ? confirmingDelete ? <div className="do-forum-more-confirm"><p>{labels.confirmDelete}</p><div><button type="button" onClick={() => setConfirmingDelete(false)}>{labels.cancel}</button><button type="button" onClick={() => run(onDelete)}>{labels.confirm}</button></div></div> : <><button type="button" role="menuitem" onClick={() => run(onEdit)}><Pencil /><span>{labels.edit}</span></button><button type="button" role="menuitem" className="do-forum-more-danger" onClick={() => setConfirmingDelete(true)}><Trash2 /><span>{labels.delete}</span></button></> : <><button type="button" role="menuitem" onClick={() => run(onReport)}><Flag /><span>{labels.report}</span></button><button type="button" role="menuitem" className="do-forum-more-danger" onClick={() => run(onBlock)}><UserX /><span>{labels.block}</span></button></>}
    </div>}
  </div>;
}
