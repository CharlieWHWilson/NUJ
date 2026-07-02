import { Share2, MessageSquare, Mail, ClipboardCopy, Phone } from "lucide-react";
import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { addCurrentUserMate, buildMateInitials, searchProfileById } from "@/lib/supabaseData";
import { supabase } from "@/lib/supabase";

interface AddMateSheetProps {
  open: boolean;
  onClose: () => void;
  onMateAdded?: () => void;
}

export const AddMateSheet = ({ open, onClose, onMateAdded }: AddMateSheetProps) => {
  const [tab, setTab] = useState<'share' | 'find'>('share');
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<null | { name: string; id: string }>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const user = useCurrentUser();

  if (!open) return null;

  // Share logic (same as Profile page)
  const shareMsg = user
    ? `Join me on NUJ - an easy way to stay connected.\n\nSign up at https://nuj-omega.vercel.app/auth\n\nAdd me as a 'mate' by using my ID: ${user.id}`
    : `Join me on NUJ - an easy way to stay connected.\n\nSign up at https://nuj-omega.vercel.app/auth\n\nAdd me as a 'mate' by using my User ID!`;

  const handleSearch = async () => {
    setSearchError('');
    setSearchResult(null);
    setIsSearching(true);

    try {
      const data = await searchProfileById(searchId.trim());

      if (!data) {
        setSearchError('No user found with that ID.');
        setIsSearching(false);
        return;
      }

      setSearchResult({ name: data.username, id: data.id });
    } catch (err) {
      const message = err instanceof Error && err.message.includes('permission')
        ? 'Profile lookup blocked by Supabase RLS. Please allow public SELECT on profiles.'
        : 'Search failed. Please try again.';
      setSearchError(message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMate = async () => {
    setAddSuccess(false);
    if (!searchResult) return;

    if (user?.id && searchResult.id === user.id) {
      setSearchError('You cannot add yourself as a mate.');
      return;
    }

    try {
      const { data: existingMate } = await supabase
        .from('mates')
        .select('id')
        .eq('user_id', user?.id)
        .eq('mate_user_id', searchResult.id)
        .maybeSingle();

      if (existingMate) {
        setSearchError('Mate already added.');
        return;
      }

      await addCurrentUserMate({
        mateUserId: searchResult.id,
        name: searchResult.name,
        initials: buildMateInitials(searchResult.name),
      });

      setAddSuccess(true);
      setSearchError('');
      onMateAdded?.();
      setTimeout(() => {
        setSearchResult(null);
        setSearchId('');
        setAddSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error adding mate:', err);
      setSearchError(err instanceof Error ? err.message : 'Unable to add mate right now.');
    }
  };

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
                disabled={isSearching}
              />
              <button
                className="nuj-btn-primary px-4 rounded-lg disabled:opacity-50"
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            {searchResult && (
              <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-primary/30">
                <p className="font-medium mb-3">{searchResult.name}</p>
                <button
                  onClick={handleAddMate}
                  className="w-full nuj-btn-primary px-4 py-2 rounded-lg text-sm"
                >
                  Add mate
                </button>
              </div>
            )}
            {addSuccess && (
              <div className="mt-2 text-sm text-green-600">Mate added!</div>
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
