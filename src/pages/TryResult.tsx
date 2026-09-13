import { Link, useParams } from "react-router-dom";
import { TryonView } from "@/components/TryonView";

export default function TryResult() {
  const { id } = useParams();
  return (
    <div className="grid gap-10">
      <TryonView id={id!} />
      <div className="flex gap-6">
        <Link to="/fitting-room" className="label text-ink underline underline-offset-4">Back to the fitting room</Link>
        <Link to="/wardrobe" className="label text-ink underline underline-offset-4">All your try-ons</Link>
      </div>
    </div>
  );
}
