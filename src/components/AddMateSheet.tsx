import { Share2, MessageSquare, Mail, Link, UserSearch, ClipboardCopy, Phone } from "lucide-react";
import { useState } from "react";
import { getCurrentUser } from "@/lib/auth";
import { loadUsers } from "@/lib/auth";

interface AddMateSheetProps {
  open: boolean;
  onClose: () => void;
}

export const AddMateSheet = ({ open, onClose }: AddMateSheetProps) => {
  const [tab, setTab] = useState<'share' | 'find'>('share');
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<null | { name: string; id: string }>(null);
  const [searchError, setSearchError] = useState('');

  if (!open) return null;

  // Share logic (same as Profile page)
  const user = getCurrentUser();
  const shareMsg = user
    ? `Join me on NUJ - an easy way to stay connected.\n\nSign up at https://charliewhwilson.github.io/NUJ\n\nThen add me by using the ID: ${user.id}`
    : `Join me on NUJ - an easy way to stay connected.\n\nSign up at https://charliewhwilson.github.io/NUJ\n\nThen add me by using my User ID!`;

  return (
    <>
      <div className="fixed inset-0 bg-foreground/20 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-card rounded-t-3xl p-6 pb-10 border border-border" style={{ boxShadow: "0 -4px 40px hsl(215 28% 13% / 0.12)" }}>
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />
        <div className="flex items-center gap-2 mb-6">
          <Share2 size={16} className="text-muted-foreground" />
          <h2 className="font-semibold">Add a mate</h2>
        </div>
        <div className="flex gap-2 mb-6">
          <button
            className={`flex-1 py-2 rounded-lg font-medium ${tab === 'share' ? 'bg-muted text-foreground' : 'bg-background text-muted-foreground border'}`}
            onClick={() => setTab('share')}
          >
            Invite mate
          </button>
          <button
            className={`flex-1 py-2 rounded-lg font-medium ${tab === 'find' ? 'bg-muted text-foreground' : 'bg-background text-muted-foreground border'}`}
            onClick={() => setTab('find')}
          >
            Find mate
          </button>
        </div>
        {tab === 'share' && (
          <div>
            {/* Share message removed from card, only in share options */}
            <div className="space-y-2">
              <button
                onClick={() => { navigator.clipboard.writeText(shareMsg); }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors text-left"
              >
                <ClipboardCopy size={18} className="text-muted-foreground" />
                <span className="font-medium text-sm">Copy message</span>
              </button>
              <button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, "_blank")}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors text-left"
              >
                <MessageSquare size={18} className="text-muted-foreground" />
                <span className="font-medium text-sm">WhatsApp</span>
              </button>
              <button
                onClick={() => window.open(`sms:?&body=${encodeURIComponent(shareMsg)}`, "_blank")}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors text-left"
              >
                <Phone size={18} className="text-muted-foreground" />
                <span className="font-medium text-sm">SMS</span>
              </button>
              <button
                onClick={() => window.open(`mailto:?subject=${encodeURIComponent("Join me on NUJ!")}&body=${encodeURIComponent(shareMsg)}`, "_blank")}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors text-left"
              >
                <Mail size={18} className="text-muted-foreground" />
                <span className="font-medium text-sm">Email</span>
              </button>
            </div>
          </div>
        )}
        {tab === 'find' && (
          <div>
            <label className="block text-sm font-medium mb-2">Enter User ID</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                className="flex-1 rounded-lg border px-3 py-2 text-sm"
                placeholder="Paste User ID here"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
              />
              <button
                className="nuj-btn-primary px-4 rounded-lg"
                onClick={() => {
                  setSearchError('');
                  setSearchResult(null);
                  const users = loadUsers();
                  const found = users.find(u => u.id === searchId.trim());
                  if (found) {
                    setSearchResult({ name: found.name, id: found.id });
                  } else {
                    setSearchError('No user found with that ID.');
                  }
                }}
              >Search</button>
            </div>
            {searchResult && (
              <div className="mt-2 p-3 rounded-lg bg-muted/50">
                <span className="font-medium">{searchResult.name}</span>
                <span className="block text-xs text-muted-foreground mt-1">User ID: {searchResult.id}</span>
              </div>
            )}
            {searchError && (
              <div className="mt-2 text-sm text-red-500">{searchError}</div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
