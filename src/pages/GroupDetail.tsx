import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { mates, groups } from "@/data/mockData";
import { MateRow } from "@/components/MateComponents";
import { useParams } from "react-router-dom";

const GroupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const group = groups.find((g) => g.id === id);

  if (!group) return null;

  const groupMates = mates.filter((m) => group.mates.includes(m.id));

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="px-5 pt-12 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">{groupMates.length} mates</p>
      </div>

      <div className="px-5 pb-16">
        <div className="nuj-card p-4">
          {groupMates.map((mate) => (
            <MateRow
              key={mate.id}
              mate={mate}
              onClick={() => navigate(`/mate/${mate.id}`)}
              showGroup={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default GroupDetail;
